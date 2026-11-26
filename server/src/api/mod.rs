pub mod auth;
pub mod events;
pub mod health;
pub mod save;

use std::{
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};

use axum::{
    routing::{get, post},
    Router,
};

use crate::AppState;

pub(crate) const MAX_SAVE_BYTES: usize = 512 * 1024;
pub(crate) const SESSION_SECONDS: i64 = 30 * 24 * 60 * 60;

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/healthz", get(health::health))
        .route("/v1/auth/register", post(auth::register))
        .route("/v1/auth/login", post(auth::login))
        .route("/v1/auth/logout", post(auth::logout))
        .route("/v1/me", get(auth::me))
        .route("/v1/save", get(save::get_save).put(save::put_save))
        .route("/v1/events", post(events::post_events))
}

pub(crate) fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}
