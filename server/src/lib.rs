pub mod auth;
pub mod db;
pub mod error;
pub mod routes;

use std::sync::Arc;

use axum::{
    extract::DefaultBodyLimit,
    http::{header, Method},
    routing::{get, post},
    Router,
};
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};

use crate::db::Db;

#[derive(Clone)]
pub struct AppState {
    pub db: Db,
}

pub fn build_router(state: Arc<AppState>) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::OPTIONS])
        .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE]);

    Router::new()
        .route("/healthz", get(routes::health))
        .route("/v1/players", post(routes::create_player))
        .route("/v1/players/recover", post(routes::recover_player))
        .route("/v1/save", get(routes::get_save).put(routes::put_save))
        .route("/v1/events", post(routes::post_events))
        .layer(DefaultBodyLimit::max(1024 * 1024))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
