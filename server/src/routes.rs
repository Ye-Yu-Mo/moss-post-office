use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use axum::{
    extract::State,
    http::{header, HeaderMap},
    Json,
};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::{auth, error::ApiError, AppState};

const MAX_SAVE_BYTES: usize = 512 * 1024;
const MAX_EVENT_BYTES: usize = 8 * 1024;
const MAX_EVENTS_PER_BATCH: usize = 50;

fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}

struct Player {
    id: String,
}

pub async fn health() -> Json<Value> {
    Json(json!({ "ok": true, "version": env!("CARGO_PKG_VERSION") }))
}

#[derive(Serialize)]
pub struct PlayerCreated {
    pub player_id: String,
    pub token: String,
    pub recovery_code: String,
}

pub async fn create_player(
    State(state): State<Arc<AppState>>,
) -> Result<Json<PlayerCreated>, ApiError> {
    let player_id = auth::new_player_id();
    let token = auth::new_token();
    let recovery_code = auth::new_recovery_code();
    let token_hash = auth::sha256_hex(&token);
    let recovery_hash = auth::sha256_hex(&auth::normalize_recovery(&recovery_code));
    let created_at = now();

    let id = player_id.clone();
    state
        .db
        .call(move |conn| {
            conn.execute(
                "INSERT INTO players (id, token_hash, recovery_hash, created_at, last_seen)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![id, token_hash, recovery_hash, created_at, created_at],
            )?;
            Ok(())
        })
        .await?;

    Ok(Json(PlayerCreated {
        player_id,
        token,
        recovery_code,
    }))
}

#[derive(Deserialize)]
pub struct RecoverRequest {
    pub player_id: String,
    pub recovery_code: String,
}

#[derive(Serialize)]
pub struct TokenResponse {
    pub player_id: String,
    pub token: String,
}

pub async fn recover_player(
    State(state): State<Arc<AppState>>,
    Json(request): Json<RecoverRequest>,
) -> Result<Json<TokenResponse>, ApiError> {
    let player_id = request.player_id.to_ascii_lowercase();
    if player_id.len() != 32 || !player_id.chars().all(|ch| ch.is_ascii_hexdigit()) {
        return Err(ApiError::BadRequest("invalid player_id"));
    }
    let normalized = auth::normalize_recovery(&request.recovery_code);
    if normalized.len() != 16 {
        return Err(ApiError::BadRequest("invalid recovery_code"));
    }

    let lookup_id = player_id.clone();
    let stored_hash = state
        .db
        .call(move |conn| {
            conn.query_row(
                "SELECT recovery_hash FROM players WHERE id = ?1",
                [lookup_id],
                |row| row.get::<_, String>(0),
            )
            .optional()
        })
        .await?;

    let Some(stored_hash) = stored_hash else {
        return Err(ApiError::Unauthorized);
    };
    if !auth::constant_time_eq(&stored_hash, &auth::sha256_hex(&normalized)) {
        return Err(ApiError::Unauthorized);
    }

    let token = auth::new_token();
    let token_hash = auth::sha256_hex(&token);
    let touched = now();
    let id = player_id.clone();
    state
        .db
        .call(move |conn| {
            conn.execute(
                "UPDATE players SET token_hash = ?1, last_seen = ?2 WHERE id = ?3",
                params![token_hash, touched, id],
            )?;
            Ok(())
        })
        .await?;

    Ok(Json(TokenResponse { player_id, token }))
}

async fn require_player(state: &AppState, headers: &HeaderMap) -> Result<Player, ApiError> {
    let header = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .ok_or(ApiError::Unauthorized)?;
    let token = header
        .strip_prefix("Bearer ")
        .or_else(|| header.strip_prefix("bearer "))
        .map(str::trim)
        .filter(|token| !token.is_empty() && token.len() <= 128)
        .ok_or(ApiError::Unauthorized)?;

    let token_hash = auth::sha256_hex(token);
    let seen_at = now();
    let player_id = state
        .db
        .call(move |conn| {
            let id: Option<String> = conn
                .query_row(
                    "SELECT id FROM players WHERE token_hash = ?1",
                    [token_hash],
                    |row| row.get(0),
                )
                .optional()?;
            if let Some(ref id) = id {
                conn.execute(
                    "UPDATE players SET last_seen = ?1 WHERE id = ?2",
                    params![seen_at, id],
                )?;
            }
            Ok(id)
        })
        .await?;

    player_id
        .map(|id| Player { id })
        .ok_or(ApiError::Unauthorized)
}

#[derive(Serialize)]
pub struct SaveResponse {
    pub revision: u64,
    pub payload: Value,
    pub updated_at: i64,
}

pub async fn get_save(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<SaveResponse>, ApiError> {
    let player = require_player(&state, &headers).await?;

    let row = state
        .db
        .call(move |conn| {
            conn.query_row(
                "SELECT revision, payload, updated_at FROM saves WHERE player_id = ?1",
                [player.id],
                |row| {
                    Ok((
                        row.get::<_, i64>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, i64>(2)?,
                    ))
                },
            )
            .optional()
        })
        .await?;

    let (revision, payload, updated_at) = row.ok_or(ApiError::NotFound("save"))?;
    let payload: Value = serde_json::from_str(&payload)?;
    Ok(Json(SaveResponse {
        revision: revision.max(0) as u64,
        payload,
        updated_at,
    }))
}

#[derive(Deserialize)]
pub struct SaveRequest {
    #[serde(default)]
    pub base_revision: u64,
    pub payload: Value,
    #[serde(default)]
    pub client_ts: i64,
}

pub async fn put_save(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<SaveRequest>,
) -> Result<Json<Value>, ApiError> {
    let player = require_player(&state, &headers).await?;

    let payload_text = serde_json::to_string(&request.payload)?;
    if payload_text.len() > MAX_SAVE_BYTES {
        return Err(ApiError::TooLarge);
    }

    let base_revision = request.base_revision;
    let client_ts = request.client_ts.clamp(0, now() + 86_400);
    let updated_at = now();
    let player_id = player.id;

    let outcome = state
        .db
        .call(move |conn| -> rusqlite::Result<Result<u64, u64>> {
            let tx = conn.transaction()?;
            let current: Option<i64> = tx
                .query_row(
                    "SELECT revision FROM saves WHERE player_id = ?1",
                    [&player_id],
                    |row| row.get(0),
                )
                .optional()?;
            let current = current.unwrap_or(0).max(0) as u64;
            if current != base_revision {
                return Ok(Err(current));
            }
            let next = current + 1;
            tx.execute(
                "INSERT INTO saves (player_id, revision, payload, client_ts, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT(player_id) DO UPDATE SET
                     revision = excluded.revision,
                     payload = excluded.payload,
                     client_ts = excluded.client_ts,
                     updated_at = excluded.updated_at",
                params![player_id, next as i64, payload_text, client_ts, updated_at],
            )?;
            tx.commit()?;
            Ok(Ok(next))
        })
        .await?;

    match outcome {
        Ok(revision) => Ok(Json(json!({ "revision": revision }))),
        Err(revision) => Err(ApiError::Conflict(revision)),
    }
}

#[derive(Deserialize)]
pub struct EventItem {
    pub name: String,
    #[serde(default)]
    pub ts: i64,
    #[serde(default)]
    pub data: Option<Value>,
}

#[derive(Deserialize)]
pub struct EventsRequest {
    pub events: Vec<EventItem>,
}

pub async fn post_events(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<EventsRequest>,
) -> Result<Json<Value>, ApiError> {
    let player = require_player(&state, &headers).await?;

    if request.events.is_empty() || request.events.len() > MAX_EVENTS_PER_BATCH {
        return Err(ApiError::BadRequest("events must contain 1..=50 items"));
    }

    let mut rows = Vec::with_capacity(request.events.len());
    for event in request.events {
        let name = event.name.trim().to_string();
        if name.is_empty() || name.len() > 64 {
            return Err(ApiError::BadRequest("invalid event name"));
        }
        let payload = match event.data {
            Some(data) => {
                let text = serde_json::to_string(&data)?;
                if text.len() > MAX_EVENT_BYTES {
                    return Err(ApiError::TooLarge);
                }
                Some(text)
            }
            None => None,
        };
        rows.push((name, payload, event.ts.clamp(0, now() + 86_400)));
    }

    let accepted = rows.len();
    let created_at = now();
    let player_id = player.id;
    state
        .db
        .call(move |conn| {
            let tx = conn.transaction()?;
            {
                let mut statement = tx.prepare(
                    "INSERT INTO events (player_id, name, payload, client_ts, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5)",
                )?;
                for (name, payload, client_ts) in rows {
                    statement.execute(params![player_id, name, payload, client_ts, created_at])?;
                }
            }
            tx.commit()?;
            Ok(())
        })
        .await?;

    Ok(Json(json!({ "accepted": accepted })))
}
