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

async fn create_player(app: &Router) -> Value {
    let response = app
        .clone()
        .oneshot(Request::post("/v1/players").body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    json_body(response).await
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

fn get_save_request(token: &str) -> Request<Body> {
    Request::get("/v1/save")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap()
}

#[tokio::test]
async fn save_roundtrip_and_revision_conflict() {
    let (app, _dir) = test_app();
    let player = create_player(&app).await;
    let token = player["token"].as_str().unwrap();

    let response = app.clone().oneshot(get_save_request(token)).await.unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);

    let response = app
        .clone()
        .oneshot(save_request(
            token,
            0,
            json!({ "version": 6, "stamps": 12 }),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(json_body(response).await["revision"], 1);

    let response = app.clone().oneshot(get_save_request(token)).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = json_body(response).await;
    assert_eq!(body["revision"], 1);
    assert_eq!(body["payload"]["stamps"], 12);

    let response = app
        .clone()
        .oneshot(save_request(token, 0, json!({ "stamps": 99 })))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CONFLICT);
    assert_eq!(json_body(response).await["revision"], 1);

    let response = app
        .clone()
        .oneshot(save_request(token, 1, json!({ "stamps": 13 })))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(json_body(response).await["revision"], 2);
}

#[tokio::test]
async fn recovery_rotates_the_token() {
    let (app, _dir) = test_app();
    let player = create_player(&app).await;
    let player_id = player["player_id"].as_str().unwrap();
    let old_token = player["token"].as_str().unwrap();
    let recovery_code = player["recovery_code"].as_str().unwrap();

    let response = app
        .clone()
        .oneshot(
            Request::post("/v1/players/recover")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(
                    json!({
                        "player_id": player_id,
                        "recovery_code": recovery_code,
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let new_token = json_body(response).await["token"]
        .as_str()
        .unwrap()
        .to_string();
    assert_ne!(new_token, old_token);

    let response = app
        .clone()
        .oneshot(get_save_request(old_token))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    let response = app
        .clone()
        .oneshot(get_save_request(&new_token))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn events_are_batched_and_validated() {
    let (app, _dir) = test_app();
    let player = create_player(&app).await;
    let token = player["token"].as_str().unwrap();

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

    let many: Vec<Value> = (0..51)
        .map(|index| json!({ "name": format!("event_{index}") }))
        .collect();
    let response = app
        .clone()
        .oneshot(
            Request::post("/v1/events")
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(json!({ "events": many }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn unauthenticated_requests_are_rejected() {
    let (app, _dir) = test_app();
    let response = app.clone().oneshot(get_save_request("nope")).await.unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}
