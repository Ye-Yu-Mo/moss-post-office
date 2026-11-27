use std::sync::Arc;

use axum::{extract::State, http::HeaderMap, Json};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{
    api::{auth::require_user, now},
    error::ApiError,
    AppState,
};

/// Milestones that hand out a server-issued night watch medal.
/// The edition is fixed and never extended.
const MILESTONES: &[(i64, &str, i64)] = &[
    (5, "night_5", 100),
    (10, "night_10", 50),
    (15, "night_15", 25),
];

#[derive(Deserialize)]
pub struct ClaimNightWatch {
    level: i64,
}

pub async fn claim(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<ClaimNightWatch>,
) -> Result<Json<Value>, ApiError> {
    let context = require_user(&state, &headers).await?;
    let (_, template, edition) = MILESTONES
        .iter()
        .find(|(level, _, _)| *level == payload.level)
        .ok_or(ApiError::BadRequest("unknown night watch milestone"))?;
    let collectible = state
        .db
        .mint_collectible(
            context.user.id,
            "nightwatch".into(),
            (*template).to_string(),
            *edition,
            (*template).to_string(),
            now(),
        )
        .await?;
    Ok(Json(json!({
        "ok": true,
        "level": payload.level,
        "collectible": collectible,
    })))
}
