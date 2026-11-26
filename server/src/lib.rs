pub mod api;
pub mod auth;
pub mod config;
pub mod db;
pub mod error;

use std::sync::Arc;

use axum::{
    extract::DefaultBodyLimit,
    http::{header, Method},
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

    api::router()
        .layer(DefaultBodyLimit::max(1024 * 1024))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
