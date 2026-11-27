use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

/// Every error the API deliberately returns, plus a catch-all for bugs.
#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("unauthorized")]
    Unauthorized,
    #[error("invalid username or password")]
    InvalidCredentials,
    #[error("bad request: {0}")]
    BadRequest(&'static str),
    #[error("not found: {0}")]
    NotFound(&'static str),
    #[error("conflict at revision {0}")]
    Conflict(u64),
    #[error("username already taken")]
    UsernameTaken,
    #[error("payload too large")]
    TooLarge,
    #[error("internal error: {0}")]
    Internal(String),
}

impl From<sqlx::Error> for ApiError {
    fn from(error: sqlx::Error) -> Self {
        ApiError::Internal(error.to_string())
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, code, message, revision) = match self {
            ApiError::Unauthorized => (
                StatusCode::UNAUTHORIZED,
                "unauthorized",
                "missing or invalid token",
                None,
            ),
            ApiError::InvalidCredentials => (
                StatusCode::UNAUTHORIZED,
                "invalid_credentials",
                "invalid username or password",
                None,
            ),
            ApiError::BadRequest(message) => {
                (StatusCode::BAD_REQUEST, "bad_request", message, None)
            }
            ApiError::NotFound(what) => (StatusCode::NOT_FOUND, "not_found", what, None),
            ApiError::Conflict(revision) => (
                StatusCode::CONFLICT,
                "conflict",
                "save revision mismatch",
                Some(revision),
            ),
            ApiError::UsernameTaken => (
                StatusCode::CONFLICT,
                "username_taken",
                "username is already taken",
                None,
            ),
            ApiError::TooLarge => (
                StatusCode::PAYLOAD_TOO_LARGE,
                "payload_too_large",
                "payload is larger than the limit",
                None,
            ),
            ApiError::Internal(error) => {
                tracing::error!(%error, "internal error");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "internal",
                    "internal server error",
                    None,
                )
            }
        };

        let mut body = json!({ "error": code, "message": message });
        if let Some(revision) = revision {
            body["revision"] = json!(revision);
        }
        (status, Json(body)).into_response()
    }
}

impl From<rusqlite::Error> for ApiError {
    fn from(error: rusqlite::Error) -> Self {
        ApiError::Internal(format!("sqlite: {error}"))
    }
}

impl From<tokio::task::JoinError> for ApiError {
    fn from(error: tokio::task::JoinError) -> Self {
        ApiError::Internal(format!("blocking task: {error}"))
    }
}

impl From<serde_json::Error> for ApiError {
    fn from(error: serde_json::Error) -> Self {
        ApiError::Internal(format!("json: {error}"))
    }
}
