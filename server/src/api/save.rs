use std::sync::Arc;

use axum::{extract::State, http::HeaderMap, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::{
    api::{auth::require_user, now, MAX_SAVE_BYTES},
    error::ApiError,
    AppState,
};

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
    let context = require_user(&state, &headers).await?;
    let stored = state
        .db
        .get_save(context.user.id)
        .await?
        .ok_or(ApiError::NotFound("save"))?;
    let payload: Value = serde_json::from_str(&stored.payload)?;
    Ok(Json(SaveResponse {
        revision: stored.revision,
        payload,
        updated_at: stored.updated_at,
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
    let context = require_user(&state, &headers).await?;

    let payload_text = serde_json::to_string(&request.payload)?;
    if payload_text.len() > MAX_SAVE_BYTES {
        return Err(ApiError::TooLarge);
    }

    let updated_at = now();
    let client_ts = request.client_ts.clamp(0, updated_at + 86_400);
    let outcome = state
        .db
        .put_save(
            context.user.id,
            request.base_revision,
            payload_text,
            client_ts,
            updated_at,
        )
        .await?;

    match outcome {
        Ok(revision) => Ok(Json(json!({ "revision": revision }))),
        Err(revision) => Err(ApiError::Conflict(revision)),
    }
}
