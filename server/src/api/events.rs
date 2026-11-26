use std::sync::Arc;

use axum::{extract::State, http::HeaderMap, Json};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{
    api::{auth::require_user, now},
    db::NewEvent,
    error::ApiError,
    AppState,
};

const MAX_EVENT_BYTES: usize = 8 * 1024;
const MAX_EVENTS_PER_BATCH: usize = 50;

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
    let context = require_user(&state, &headers).await?;

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
        rows.push(NewEvent {
            name,
            payload,
            client_ts: event.ts.clamp(0, now() + 86_400),
        });
    }

    let accepted = rows.len();
    state.db.insert_events(context.user.id, rows, now()).await?;

    Ok(Json(json!({ "accepted": accepted })))
}
