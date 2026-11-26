use std::sync::Arc;

use axum::{
    body::Body,
    http::{header, Request, StatusCode},
    Router,
};
use http_body_util::BodyExt;
use moss_sync::{build_router, db::Db, AppState};
use serde_json::{json, Value};
use tempfile::TempDir;
use tower::ServiceExt;

fn test_app() -> (Router, TempDir) {
    let dir = tempfile::tempdir().expect("temp dir");
    let db = Db::new(dir.path().join("test.db")).expect("database");
    (build_router(Arc::new(AppState { db })), dir)
}

async fn json_body(response: axum::response::Response) -> Value {
    let bytes = response
        .into_body()
        .collect()
        .await
        .expect("body")
        .to_bytes();
    serde_json::from_slice(&bytes).expect("json body")
}

fn register_request(username: &str, password: &str, save: Option<Value>) -> Request<Body> {
    let body = match save {
        Some(save) => json!({ "username": username, "password": password, "save": save }),
        None => json!({ "username": username, "password": password }),
    };
    Request::post("/v1/auth/register")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(body.to_string()))
        .unwrap()
}

fn login_request(username: &str, password: &str) -> Request<Body> {
    Request::post("/v1/auth/login")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({ "username": username, "password": password }).to_string(),
        ))
        .unwrap()
}

fn auth_request(method: &str, path: &str, token: &str) -> Request<Body> {
    Request::builder()
        .method(method)
        .uri(path)
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap()
}

fn save_request(token: &str, base_revision: u64, payload: Value) -> Request<Body> {
    Request::put("/v1/save")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "base_revision": base_revision,
                "payload": payload,
                "client_ts": 1,
            })
            .to_string(),
        ))
        .unwrap()
}

async fn register_ok(app: &Router, username: &str, password: &str, save: Option<Value>) -> Value {
    let response = app
        .clone()
        .oneshot(register_request(username, password, save))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    json_body(response).await
}

async fn login_ok(app: &Router, username: &str, password: &str) -> Value {
    let response = app
        .clone()
        .oneshot(login_request(username, password))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    json_body(response).await
}

#[tokio::test]
async fn register_uploads_the_local_save_and_login_reads_it() {
    let (app, _dir) = test_app();
    let registered = register_ok(
        &app,
        "MossKeeper",
        "moss-post-123",
        Some(json!({ "version": 6, "stamps": 42 })),
    )
    .await;
    assert_eq!(registered["save_revision"], 1);

    let logged_in = login_ok(&app, "MossKeeper", "moss-post-123").await;
    let token = logged_in["token"].as_str().unwrap();
    assert_eq!(logged_in["save_revision"], 1);

    let response = app
        .clone()
        .oneshot(auth_request("GET", "/v1/save", token))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = json_body(response).await;
    assert_eq!(body["revision"], 1);
    assert_eq!(body["payload"]["stamps"], 42);

    let response = app
        .clone()
        .oneshot(save_request(token, 1, json!({ "stamps": 43 })))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(json_body(response).await["revision"], 2);

    let response = app
        .clone()
        .oneshot(save_request(token, 1, json!({ "stamps": 99 })))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CONFLICT);
    assert_eq!(json_body(response).await["revision"], 2);
}

#[tokio::test]
async fn usernames_are_case_insensitive_and_unique() {
    let (app, _dir) = test_app();
    register_ok(&app, "MossKeeper", "moss-post-123", None).await;

    let response = app
        .clone()
        .oneshot(register_request("mosskeeper", "another-pass", None))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CONFLICT);
    assert_eq!(json_body(response).await["error"], "username_taken");
}

#[tokio::test]
async fn wrong_password_and_logout_revoke_access() {
    let (app, _dir) = test_app();
    register_ok(&app, "night_post", "moss-post-123", None).await;

    let response = app
        .clone()
        .oneshot(login_request("night_post", "wrong-password"))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    let logged_in = login_ok(&app, "night_post", "moss-post-123").await;
    let token = logged_in["token"].as_str().unwrap();

    let response = app
        .clone()
        .oneshot(auth_request("POST", "/v1/auth/logout", token))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let response = app
        .clone()
        .oneshot(auth_request("GET", "/v1/me", token))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn registration_without_a_save_starts_empty() {
    let (app, _dir) = test_app();
    let registered = register_ok(&app, "empty_bag", "moss-post-123", None).await;
    assert_eq!(registered["save_revision"], 0);

    let logged_in = login_ok(&app, "empty_bag", "moss-post-123").await;
    let token = logged_in["token"].as_str().unwrap();

    let response = app
        .clone()
        .oneshot(auth_request("GET", "/v1/save", token))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);

    let response = app
        .clone()
        .oneshot(save_request(token, 0, json!({ "version": 6 })))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(json_body(response).await["revision"], 1);
}

#[tokio::test]
async fn events_are_batched_and_validated() {
    let (app, _dir) = test_app();
    let registered = register_ok(&app, "event_keeper", "moss-post-123", None).await;
    let token = registered["token"].as_str().unwrap();

    let response = app
        .clone()
        .oneshot(
            Request::post("/v1/events")
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(
                    json!({
                        "events": [
                            { "name": "run_start", "ts": 1, "data": { "stamps": 12 } },
                            { "name": "stage_clear", "ts": 2 }
                        ]
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(json_body(response).await["accepted"], 2);

    let response = app
        .clone()
        .oneshot(
            Request::post("/v1/events")
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(json!({ "events": [] }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn unauthenticated_requests_are_rejected() {
    let (app, _dir) = test_app();
    let response = app
        .clone()
        .oneshot(auth_request("GET", "/v1/save", "nope"))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}
