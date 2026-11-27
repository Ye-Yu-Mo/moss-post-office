use std::sync::Arc;

use axum::{
    extract::State,
    http::{header, HeaderMap},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::{
    api::{now, public_stats, MAX_SAVE_BYTES, SESSION_SECONDS},
    auth,
    db::SessionUser,
    error::ApiError,
    AppState,
};

const CHALLENGE_SECONDS: i64 = 120;

#[derive(Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    /// 32-byte client-derived verifier, hex encoded. The password itself never
    /// leaves the browser.
    pub verifier: String,
    #[serde(default)]
    pub save: Option<Value>,
}

#[derive(Deserialize)]
pub struct ChallengeRequest {
    pub username: String,
}

#[derive(Serialize)]
pub struct ChallengeResponse {
    pub nonce: String,
    pub expires_at: i64,
    pub algorithm: &'static str,
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub nonce: String,
    pub proof: String,
}

#[derive(Serialize)]
pub struct AuthResponse {
    pub user_id: String,
    pub username: String,
    pub token: String,
    pub save_revision: u64,
}

#[derive(Serialize)]
pub struct MeResponse {
    pub user_id: String,
    pub username: String,
    pub save_revision: u64,
}

pub async fn register(
    State(state): State<Arc<AppState>>,
    Json(request): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>, ApiError> {
    let (username, username_key) = validate_username(&request.username)?;
    if !auth::is_hex_64(&request.verifier) {
        return Err(ApiError::BadRequest("verifier must be 64 hex characters"));
    }

    let stats = request.save.as_ref().map(public_stats);
    let save_payload = match request.save {
        Some(save) => {
            let text = serde_json::to_string(&save)?;
            if text.len() > MAX_SAVE_BYTES {
                return Err(ApiError::TooLarge);
            }
            Some(text)
        }
        None => None,
    };
    let has_save = save_payload.is_some();

    let user_id = auth::new_user_id();
    let token = auth::new_token();
    let token_hash = auth::sha256_hex(&token);
    let created_at = now();
    let expires_at = created_at + SESSION_SECONDS;

    state
        .db
        .register_account(crate::db::NewAccount {
            user_id: user_id.clone(),
            username: username.clone(),
            username_key,
            verifier: request.verifier.to_ascii_lowercase(),
            friend_code: auth::new_friend_code(),
            token_hash,
            now: created_at,
            expires_at,
            save_payload,
        })
        .await?;

    if let Some((total_stamps, expedition_wins, night_best)) = stats {
        state
            .db
            .update_stats(user_id.clone(), total_stamps, expedition_wins, night_best, created_at)
            .await?;
    }

    Ok(Json(AuthResponse {
        user_id,
        username,
        token,
        save_revision: if has_save { 1 } else { 0 },
    }))
}

pub async fn challenge(
    State(state): State<Arc<AppState>>,
    Json(request): Json<ChallengeRequest>,
) -> Result<Json<ChallengeResponse>, ApiError> {
    if request.username.trim().chars().count() > 24 {
        return Err(ApiError::BadRequest("username is too long"));
    }

    let nonce = auth::new_nonce();
    let created_at = now();
    let expires_at = created_at + CHALLENGE_SECONDS;
    state
        .db
        .create_challenge(nonce.clone(), created_at, expires_at)
        .await?;

    Ok(Json(ChallengeResponse {
        nonce,
        expires_at,
        algorithm: "HMAC-SHA256",
    }))
}

pub async fn login(
    State(state): State<Arc<AppState>>,
    Json(request): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, ApiError> {
    let nonce = request.nonce.trim();
    let proof = request.proof.trim();
    if nonce.len() < 20 || nonce.len() > 128 || !auth::is_hex_64(proof) {
        return Err(ApiError::InvalidCredentials);
    }

    // Consume first: a proof cannot be replayed even if the username is wrong.
    if !state.db.consume_challenge(nonce.to_string(), now()).await? {
        return Err(ApiError::InvalidCredentials);
    }

    let username_key = auth::normalize_username(&request.username);
    let mut user = state.db.user_by_username(username_key.clone()).await?;
    if user.is_none() {
        let legacy_key = auth::legacy_username_key(&request.username);
        if legacy_key != username_key {
            user = state.db.user_by_username(legacy_key).await?;
        }
    }
    let user = user.ok_or(ApiError::InvalidCredentials)?;
    if !auth::verify_proof(&user.verifier, nonce, proof) {
        return Err(ApiError::InvalidCredentials);
    }

    let token = auth::new_token();
    let token_hash = auth::sha256_hex(&token);
    let created_at = now();
    state
        .db
        .create_session(
            token_hash,
            user.id.clone(),
            created_at,
            created_at + SESSION_SECONDS,
        )
        .await?;
    state.db.touch_login(user.id.clone(), created_at).await?;
    let save_revision = state.db.save_revision(user.id.clone()).await?;

    Ok(Json(AuthResponse {
        user_id: user.id,
        username: user.username,
        token,
        save_revision,
    }))
}

pub(crate) struct AuthContext {
    pub user: SessionUser,
    pub token_hash: String,
}

pub(crate) async fn require_user(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<AuthContext, ApiError> {
    let token = bearer_token(headers)?;
    let token_hash = auth::sha256_hex(token);
    let user = state
        .db
        .user_by_session(token_hash.clone(), now())
        .await?
        .ok_or(ApiError::Unauthorized)?;
    Ok(AuthContext { user, token_hash })
}

pub async fn logout(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    let context = require_user(&state, &headers).await?;
    state.db.delete_session(context.token_hash).await?;
    Ok(Json(json!({ "ok": true })))
}

pub async fn me(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<MeResponse>, ApiError> {
    let context = require_user(&state, &headers).await?;
    let save_revision = state.db.save_revision(context.user.id.clone()).await?;
    Ok(Json(MeResponse {
        user_id: context.user.id,
        username: context.user.username,
        save_revision,
    }))
}

fn bearer_token(headers: &HeaderMap) -> Result<&str, ApiError> {
    headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| {
            value
                .strip_prefix("Bearer ")
                .or_else(|| value.strip_prefix("bearer "))
        })
        .map(str::trim)
        .filter(|token| !token.is_empty() && token.len() <= 128)
        .ok_or(ApiError::Unauthorized)
}

fn validate_username(raw: &str) -> Result<(String, String), ApiError> {
    use unicode_normalization::UnicodeNormalization;
    let username = raw.trim().nfkc().collect::<String>();
    let username = username.trim();
    let count = username.chars().count();
    if !(3..=24).contains(&count) {
        return Err(ApiError::BadRequest("username must be 3-24 characters"));
    }
    if username.chars().any(|ch| {
        ch.is_control()
            || ch.is_whitespace()
            || ch == '/'
            || auth::is_unsafe_format_char(ch)
    }) {
        return Err(ApiError::BadRequest(
            "username contains an unsupported character",
        ));
    }
    let username = username.to_string();
    let key = auth::normalize_username(&username);
    Ok((username, key))
}
