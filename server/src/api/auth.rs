use std::sync::Arc;

use axum::{
    extract::State,
    http::{header, HeaderMap},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::{
    api::{now, MAX_SAVE_BYTES, SESSION_SECONDS},
    auth,
    db::SessionUser,
    error::ApiError,
    AppState,
};

#[derive(Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub password: String,
    #[serde(default)]
    pub save: Option<Value>,
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
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
    validate_password(&request.password)?;

    let password = request.password.clone();
    let password_hash =
        tokio::task::spawn_blocking(move || auth::hash_password(&password)).await??;

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
            password_hash,
            token_hash,
            now: created_at,
            expires_at,
            save_payload,
        })
        .await?;

    Ok(Json(AuthResponse {
        user_id,
        username,
        token,
        save_revision: if has_save { 1 } else { 0 },
    }))
}

pub async fn login(
    State(state): State<Arc<AppState>>,
    Json(request): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, ApiError> {
    let username_key = auth::normalize_username(&request.username);
    let password = request.password.clone();
    if username_key.is_empty() || password.is_empty() {
        return Err(ApiError::InvalidCredentials);
    }

    let user = state
        .db
        .user_by_username(username_key)
        .await?
        .ok_or(ApiError::InvalidCredentials)?;
    let password_hash = user.password_hash.clone();
    let valid =
        tokio::task::spawn_blocking(move || auth::verify_password(&password_hash, &password))
            .await?;
    if !valid {
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
    let username = raw.trim();
    let count = username.chars().count();
    if !(3..=24).contains(&count) {
        return Err(ApiError::BadRequest("username must be 3-24 characters"));
    }
    if username
        .chars()
        .any(|ch| ch.is_control() || ch.is_whitespace() || ch == '/')
    {
        return Err(ApiError::BadRequest(
            "username contains an unsupported character",
        ));
    }
    Ok((username.to_string(), auth::normalize_username(username)))
}

fn validate_password(password: &str) -> Result<(), ApiError> {
    if password.chars().count() < 8 {
        return Err(ApiError::BadRequest(
            "password must be at least 8 characters",
        ));
    }
    if password.len() > 256 {
        return Err(ApiError::BadRequest("password is too long"));
    }
    Ok(())
}
