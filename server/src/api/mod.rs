pub mod auth;
pub mod events;
pub mod friends;
pub mod garden;
pub mod health;
pub mod nightwatch;
pub mod save;
pub mod social;

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
        .route("/v1/auth/challenge", post(auth::challenge))
        .route("/v1/auth/login", post(auth::login))
        .route("/v1/auth/logout", post(auth::logout))
        .route("/v1/me", get(auth::me))
        .route("/v1/save", get(save::get_save).put(save::put_save))
        .route("/v1/events", post(events::post_events))
        .route("/v1/square", get(social::square))
        .route(
            "/v1/postcards",
            get(social::postcards).post(social::send_postcard),
        )
        .route("/v1/postcards/{id}/claim", post(social::claim_postcard))
        .route("/v1/collectibles", get(social::collectibles))
        .route("/v1/nightwatch/claim", post(nightwatch::claim))
        .route("/v1/friends", get(friends::list_friends))
        .route("/v1/friends/request", post(friends::send_friend_request))
        .route("/v1/friends/accept", post(friends::accept_friend_request))
        .route("/v1/friends/decline", post(friends::decline_friend_request))
        .route(
            "/v1/friends/{id}",
            get(friends::friend_profile).delete(friends::remove_friend),
        )
        .route("/v1/friends/{id}/visit", post(friends::visit_friend))
        .route("/v1/garden", get(garden::own_garden))
        .route("/v1/garden/harvest", post(garden::harvest))
        .route("/v1/garden/quest/claim", post(garden::claim_daily_quest))
        .route("/v1/garden/plant", post(garden::plant))
        .route("/v1/garden/water", post(garden::water))
        .route("/v1/garden/{id}", get(garden::friend_garden))
        .route("/v1/garden/{id}/steal", post(garden::steal))
        .route("/v1/garden/{id}/help", post(garden::help_water))
}

pub(crate) fn public_stats(payload: &serde_json::Value) -> (i64, i64, i64) {
    let read = |key: &str| -> i64 {
        payload
            .get(key)
            .and_then(|value| value.as_f64())
            .unwrap_or(0.0)
            .clamp(0.0, 1e15) as i64
    };
    let night_best = payload
        .get("nightWatch")
        .and_then(|progress| progress.get("best"))
        .and_then(|value| value.as_f64())
        .unwrap_or(0.0)
        .clamp(0.0, 1e6) as i64;
    (read("totalEarned"), read("expeditionWins"), night_best)
}

pub(crate) fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}
