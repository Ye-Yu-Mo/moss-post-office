use std::sync::Arc;

use axum::{
    body::Body,
    http::{header, Request, StatusCode},
    Router,
};
use hmac::{Hmac, Mac};
use http_body_util::BodyExt;
use moss_sync::{build_router, db::Db, AppState};
use serde_json::{json, Value};
use sha2::Sha256;
use tower::ServiceExt;

const VERIFIER: &str = "abababababababababababababababababababababababababababababababab";

fn test_database_url() -> String {
    std::env::var("MOSS_TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgres://localhost/moss_test".into())
}

async fn test_db() -> Db {
    use std::sync::atomic::{AtomicU64, Ordering};
    static NEXT: AtomicU64 = AtomicU64::new(0);
    let schema = format!(
        "test_{}_{}",
        std::process::id(),
        NEXT.fetch_add(1, Ordering::Relaxed)
    );
    let url = test_database_url();
    let admin = sqlx::PgPool::connect(&url)
        .await
        .expect("connect test postgres");
    sqlx::query(&format!("CREATE SCHEMA {schema}"))
        .execute(&admin)
        .await
        .expect("create test schema");
    drop(admin);
    Db::connect_in_schema(&url, &schema)
        .await
        .expect("database")
}

async fn test_app() -> Router {
    build_router(Arc::new(AppState { db: test_db().await }))
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

fn verify_hex(value: &str) -> Vec<u8> {
    (0..value.len())
        .step_by(2)
        .map(|index| u8::from_str_radix(&value[index..index + 2], 16).unwrap())
        .collect()
}

fn proof(verifier: &str, nonce: &str) -> String {
    let mut mac = Hmac::<Sha256>::new_from_slice(&verify_hex(verifier)).unwrap();
    mac.update(nonce.as_bytes());
    mac.finalize()
        .into_bytes()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn register_request(username: &str, save: Option<Value>) -> Request<Body> {
    let body = match save {
        Some(save) => json!({ "username": username, "verifier": VERIFIER, "save": save }),
        None => json!({ "username": username, "verifier": VERIFIER }),
    };
    Request::post("/v1/auth/register")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(body.to_string()))
        .unwrap()
}

fn challenge_request(username: &str) -> Request<Body> {
    Request::post("/v1/auth/challenge")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(json!({ "username": username }).to_string()))
        .unwrap()
}

fn login_request(username: &str, nonce: &str, proof: &str) -> Request<Body> {
    Request::post("/v1/auth/login")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({ "username": username, "nonce": nonce, "proof": proof }).to_string(),
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

async fn register_ok(app: &Router, username: &str, save: Option<Value>) -> Value {
    let response = app
        .clone()
        .oneshot(register_request(username, save))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    json_body(response).await
}

async fn challenge_nonce(app: &Router, username: &str) -> String {
    let response = app
        .clone()
        .oneshot(challenge_request(username))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = json_body(response).await;
    body["nonce"].as_str().unwrap().to_string()
}

async fn login_ok(app: &Router, username: &str) -> Value {
    let nonce = challenge_nonce(app, username).await;
    let response = app
        .clone()
        .oneshot(login_request(username, &nonce, &proof(VERIFIER, &nonce)))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    json_body(response).await
}

#[tokio::test]
async fn register_uploads_the_local_save_and_login_reads_it() {
    let app = test_app().await;
    let registered = register_ok(
        &app,
        "MossKeeper",
        Some(json!({ "version": 6, "stamps": 42 })),
    )
    .await;
    assert_eq!(registered["save_revision"], 1);

    let logged_in = login_ok(&app, "MossKeeper").await;
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
    let app = test_app().await;
    register_ok(&app, "MossKeeper", None).await;

    let response = app
        .clone()
        .oneshot(register_request("mosskeeper", None))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CONFLICT);
    assert_eq!(json_body(response).await["error"], "username_taken");
}

#[tokio::test]
async fn wrong_proof_and_nonce_replay_are_rejected() {
    let app = test_app().await;
    register_ok(&app, "night_post", None).await;

    let nonce = challenge_nonce(&app, "night_post").await;
    let bad = "00".repeat(32);
    let response = app
        .clone()
        .oneshot(login_request("night_post", &nonce, &bad))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    // A spent nonce cannot be used again, even with the right proof.
    let nonce = challenge_nonce(&app, "night_post").await;
    let good = proof(VERIFIER, &nonce);
    let response = app
        .clone()
        .oneshot(login_request("night_post", &nonce, &good))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let response = app
        .clone()
        .oneshot(login_request("night_post", &nonce, &good))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn logout_revokes_the_session() {
    let app = test_app().await;
    register_ok(&app, "post_office", None).await;
    let logged_in = login_ok(&app, "post_office").await;
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
    let app = test_app().await;
    let registered = register_ok(&app, "empty_bag", None).await;
    assert_eq!(registered["save_revision"], 0);

    let logged_in = login_ok(&app, "empty_bag").await;
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
    let app = test_app().await;
    let registered = register_ok(&app, "event_keeper", None).await;
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
    let app = test_app().await;
    let response = app
        .clone()
        .oneshot(auth_request("GET", "/v1/save", "nope"))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

fn post_json(token: &str, path: &str, body: Value) -> Request<Body> {
    Request::post(path)
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(body.to_string()))
        .unwrap()
}

#[tokio::test]
async fn social_square_postcards_and_bots() {
    let app = test_app().await;
    let alice = register_ok(
        &app,
        "alice_post",
        Some(json!({ "version": 7, "totalEarned": 5000, "expeditionWins": 2 })),
    )
    .await;
    let bob = register_ok(&app, "bob_post", None).await;
    let alice_token = alice["token"].as_str().unwrap();
    let bob_id = bob["user_id"].as_str().unwrap();

    let response = app
        .clone()
        .oneshot(auth_request("GET", "/v1/square", alice_token))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let square = json_body(response).await;
    let players = square["players"].as_array().unwrap();
    assert!(players.iter().any(|player| player["name"] == "alice_post"));
    assert!(players.iter().any(|player| player["kind"] == "bot"));

    let response = app
        .clone()
        .oneshot(auth_request("GET", "/v1/postcards", alice_token))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let cards = json_body(response).await;
    let cards = cards["cards"].as_array().unwrap();
    let welcome = cards
        .iter()
        .find(|card| card["template"] == "welcome")
        .unwrap();
    assert_eq!(welcome["sender_kind"], "bot");
    assert_eq!(welcome["gift_kind"], "ink");
    assert!(cards.iter().any(|card| card["template"]
        .as_str()
        .unwrap_or("")
        .starts_with("daily_")));
    let welcome_id = welcome["id"].as_i64().unwrap();

    let response = app
        .clone()
        .oneshot(post_json(
            alice_token,
            &format!("/v1/postcards/{welcome_id}/claim"),
            json!({}),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let claimed = json_body(response).await;
    assert_eq!(claimed["gift_kind"], "ink");
    assert_eq!(claimed["gift_amount"], 2);
    assert!(!claimed["collectibles"].as_array().unwrap().is_empty());

    let response = app
        .clone()
        .oneshot(auth_request("GET", "/v1/collectibles", alice_token))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let owned = json_body(response).await;
    assert!(owned
        .as_array()
        .unwrap()
        .iter()
        .any(|item| item["kind"] == "postcard" && item["edition"] == 200));

    let response = app
        .clone()
        .oneshot(post_json(
            alice_token,
            &format!("/v1/postcards/{welcome_id}/claim"),
            json!({}),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);

    let response = app
        .clone()
        .oneshot(post_json(
            alice_token,
            "/v1/postcards",
            json!({ "recipient_id": bob_id, "recipient_kind": "user", "template": "hello" }),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(json_body(response).await["reply"], false);

    let response = app
        .clone()
        .oneshot(auth_request(
            "GET",
            "/v1/postcards",
            bob["token"].as_str().unwrap(),
        ))
        .await
        .unwrap();
    let bob_cards = json_body(response).await;
    assert!(bob_cards["cards"]
        .as_array()
        .unwrap()
        .iter()
        .any(|card| card["sender"] == "alice_post"
            && card["text"] == "今天邮局门口的苔藓又绿了一点。"));

    // Bot recipients reply immediately with a small gift.
    let response = app
        .clone()
        .oneshot(post_json(
            alice_token,
            "/v1/postcards",
            json!({ "recipient_id": "b_moss", "recipient_kind": "bot", "template": "weather" }),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(json_body(response).await["reply"], true);

    // Five sends per rolling day.
    for _ in 0..3 {
        let response = app
            .clone()
            .oneshot(post_json(
                alice_token,
                "/v1/postcards",
                json!({ "recipient_id": "b_snail", "recipient_kind": "bot", "template": "route" }),
            ))
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }
    let response = app
        .clone()
        .oneshot(post_json(
            alice_token,
            "/v1/postcards",
            json!({ "recipient_id": "b_star", "recipient_kind": "bot", "template": "star" }),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn friend_code_request_accept_profile_and_remove() {
    let app = test_app().await;
    let alice = register_ok(&app, "friend_alice", None).await;
    let bob = register_ok(&app, "friend_bob", None).await;
    let carol = register_ok(&app, "friend_carol", None).await;
    let alice_token = alice["token"].as_str().unwrap();
    let bob_token = bob["token"].as_str().unwrap();
    let carol_token = carol["token"].as_str().unwrap();
    let bob_id = bob["user_id"].as_str().unwrap();

    let response = app
        .clone()
        .oneshot(auth_request("GET", "/v1/friends", alice_token))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let alice_friends = json_body(response).await;
    let alice_code = alice_friends["code"].as_str().unwrap().to_string();
    assert_eq!(alice_code.len(), 6);
    assert_eq!(alice_friends["friends"].as_array().unwrap().len(), 0);

    let response = app
        .clone()
        .oneshot(post_json(
            bob_token,
            "/v1/friends/request",
            json!({ "code": alice_code }),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(json_body(response).await["status"], "sent");

    let response = app
        .clone()
        .oneshot(auth_request("GET", "/v1/friends", alice_token))
        .await
        .unwrap();
    let alice_friends = json_body(response).await;
    let request_id = alice_friends["incoming"][0]["id"].as_i64().unwrap();

    let response = app
        .clone()
        .oneshot(post_json(
            alice_token,
            "/v1/friends/accept",
            json!({ "id": request_id }),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    for (token, expected) in [(alice_token, "friend_bob"), (bob_token, "friend_alice")] {
        let response = app
            .clone()
            .oneshot(auth_request("GET", "/v1/friends", token))
            .await
            .unwrap();
        let body = json_body(response).await;
        assert!(body["friends"]
            .as_array()
            .unwrap()
            .iter()
            .any(|friend| friend["username"] == expected));
    }

    let response = app
        .clone()
        .oneshot(post_json(
            alice_token,
            &format!("/v1/friends/{bob_id}/visit"),
            json!({}),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(json_body(response).await["first_today"], true);

    let response = app
        .clone()
        .oneshot(post_json(
            alice_token,
            &format!("/v1/friends/{bob_id}/visit"),
            json!({}),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(json_body(response).await["first_today"], false);

    let response = app
        .clone()
        .oneshot(auth_request(
            "GET",
            &format!("/v1/friends/{bob_id}"),
            alice_token,
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let profile = json_body(response).await;
    assert_eq!(profile["friend"]["username"], "friend_bob");
    assert_eq!(profile["visits_received"], 1);

    let response = app
        .clone()
        .oneshot(auth_request(
            "GET",
            &format!("/v1/friends/{bob_id}"),
            carol_token,
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);

    let response = app
        .clone()
        .oneshot(post_json(
            carol_token,
            &format!("/v1/friends/{bob_id}/visit"),
            json!({}),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);

    let response = app
        .clone()
        .oneshot(auth_request(
            "DELETE",
            &format!("/v1/friends/{bob_id}"),
            alice_token,
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let response = app
        .clone()
        .oneshot(auth_request("GET", "/v1/friends", bob_token))
        .await
        .unwrap();
    assert_eq!(
        json_body(response).await["friends"]
            .as_array()
            .unwrap()
            .len(),
        0
    );
}

#[tokio::test]
async fn garden_harvest_and_friend_steal() {
    let app = test_app().await;
    let alice = register_ok(&app, "gardener_alice", None).await;
    let bob = register_ok(&app, "gardener_bob", None).await;
    let carol = register_ok(&app, "gardener_carol", None).await;
    let alice_token = alice["token"].as_str().unwrap();
    let bob_token = bob["token"].as_str().unwrap();
    let carol_token = carol["token"].as_str().unwrap();
    let alice_id = alice["user_id"].as_str().unwrap();

    let response = app
        .clone()
        .oneshot(auth_request("GET", "/v1/garden", alice_token))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let garden = json_body(response).await;
    assert_eq!(garden["plots"].as_array().unwrap().len(), 3);
    assert_eq!(garden["plots"][0]["ripe"], true);

    let response = app
        .clone()
        .oneshot(post_json(
            alice_token,
            "/v1/garden/harvest",
            json!({ "plot": 0 }),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(json_body(response).await["reward"]["amount"], 3);

    let response = app
        .clone()
        .oneshot(auth_request("GET", "/v1/garden", alice_token))
        .await
        .unwrap();
    assert_eq!(json_body(response).await["plots"][0]["empty"], true);

    let response = app
        .clone()
        .oneshot(post_json(
            alice_token,
            "/v1/garden/plant",
            json!({ "plot": 0, "crop": "stamp" }),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let response = app
        .clone()
        .oneshot(post_json(
            alice_token,
            "/v1/garden/water",
            json!({ "plot": 0 }),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let response = app
        .clone()
        .oneshot(post_json(
            alice_token,
            "/v1/garden/water",
            json!({ "plot": 0 }),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    // Make Alice and Bob friends.
    let response = app
        .clone()
        .oneshot(auth_request("GET", "/v1/friends", alice_token))
        .await
        .unwrap();
    let code = json_body(response).await["code"]
        .as_str()
        .unwrap()
        .to_string();
    let response = app
        .clone()
        .oneshot(post_json(
            bob_token,
            "/v1/friends/request",
            json!({ "code": code }),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let response = app
        .clone()
        .oneshot(auth_request("GET", "/v1/friends", alice_token))
        .await
        .unwrap();
    let request_id = json_body(response).await["incoming"][0]["id"]
        .as_i64()
        .unwrap();
    let response = app
        .clone()
        .oneshot(post_json(
            alice_token,
            "/v1/friends/accept",
            json!({ "id": request_id }),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let response = app
        .clone()
        .oneshot(auth_request(
            "GET",
            &format!("/v1/garden/{alice_id}"),
            bob_token,
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let response = app
        .clone()
        .oneshot(post_json(
            bob_token,
            &format!("/v1/garden/{alice_id}/steal"),
            json!({ "plot": 1 }),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(json_body(response).await["reward"]["amount"], 1);

    let response = app
        .clone()
        .oneshot(post_json(
            bob_token,
            &format!("/v1/garden/{alice_id}/steal"),
            json!({ "plot": 1 }),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let response = app
        .clone()
        .oneshot(auth_request("GET", "/v1/garden", alice_token))
        .await
        .unwrap();
    let garden = json_body(response).await;
    assert_eq!(garden["plots"][1]["stolen"], 1);
    assert!(garden["crop_stats"]
        .as_array()
        .unwrap()
        .iter()
        .any(|stat| stat["crop"] == "letter" && stat["harvests"] == 1));
    assert!(garden["crop_stats"]
        .as_array()
        .unwrap()
        .iter()
        .any(|stat| stat["crop"] == "stamp" && stat["stolen"] == 1));
    assert_eq!(garden["visitors"][0]["action"], "steal");
    assert_eq!(garden["visitors"][0]["actor_name"], "gardener_bob");

    let response = app
        .clone()
        .oneshot(auth_request(
            "GET",
            &format!("/v1/garden/{alice_id}"),
            carol_token,
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);

    let response = app
        .clone()
        .oneshot(auth_request("GET", "/v1/postcards", alice_token))
        .await
        .unwrap();
    let cards = json_body(response).await;
    assert!(cards["cards"]
        .as_array()
        .unwrap()
        .iter()
        .any(|card| card["template"] == "steal_note" && card["sender"] == "gardener_bob"));
}

#[tokio::test]
async fn garden_rare_crops_unlock_after_harvests() {
    let app = test_app().await;
    let grower = register_ok(&app, "rare_grower", None).await;
    let token = grower["token"].as_str().unwrap();

    let response = app
        .clone()
        .oneshot(auth_request("GET", "/v1/garden", token))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    for plot in 0..3 {
        let response = app
            .clone()
            .oneshot(post_json(
                token,
                "/v1/garden/harvest",
                json!({ "plot": plot }),
            ))
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }

    let response = app
        .clone()
        .oneshot(auth_request("GET", "/v1/garden", token))
        .await
        .unwrap();
    let garden = json_body(response).await;
    assert_eq!(garden["harvests"], 3);
    assert!(garden["plots"]
        .as_array()
        .unwrap()
        .iter()
        .all(|plot| plot["empty"] == true));

    let response = app
        .clone()
        .oneshot(post_json(
            token,
            "/v1/garden/plant",
            json!({ "plot": 0, "crop": "starchild" }),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let response = app
        .clone()
        .oneshot(post_json(
            token,
            "/v1/garden/plant",
            json!({ "plot": 1, "crop": "mooncap" }),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let response = app
        .clone()
        .oneshot(post_json(token, "/v1/garden/water", json!({ "plot": 0 })))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let response = app
        .clone()
        .oneshot(auth_request("GET", "/v1/garden", token))
        .await
        .unwrap();
    let garden = json_body(response).await;
    assert_eq!(garden["plots"][0]["crop"], "starchild");
    assert_eq!(garden["plots"][0]["watered"], true);
}

#[tokio::test]
async fn friend_can_water_once_per_plot() {
    let app = test_app().await;
    let alice = register_ok(&app, "water_alice", None).await;
    let bob = register_ok(&app, "water_bob", None).await;
    let carol = register_ok(&app, "water_carol", None).await;
    let alice_token = alice["token"].as_str().unwrap();
    let bob_token = bob["token"].as_str().unwrap();
    let carol_token = carol["token"].as_str().unwrap();
    let alice_id = alice["user_id"].as_str().unwrap();

    let response = app
        .clone()
        .oneshot(auth_request("GET", "/v1/garden", alice_token))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let response = app
        .clone()
        .oneshot(post_json(
            alice_token,
            "/v1/garden/harvest",
            json!({ "plot": 0 }),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let response = app
        .clone()
        .oneshot(post_json(
            alice_token,
            "/v1/garden/plant",
            json!({ "plot": 0, "crop": "letter" }),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let response = app
        .clone()
        .oneshot(auth_request("GET", "/v1/friends", alice_token))
        .await
        .unwrap();
    let code = json_body(response).await["code"]
        .as_str()
        .unwrap()
        .to_string();
    let response = app
        .clone()
        .oneshot(post_json(
            bob_token,
            "/v1/friends/request",
            json!({ "code": code }),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let response = app
        .clone()
        .oneshot(auth_request("GET", "/v1/friends", alice_token))
        .await
        .unwrap();
    let request_id = json_body(response).await["incoming"][0]["id"]
        .as_i64()
        .unwrap();
    let response = app
        .clone()
        .oneshot(post_json(
            alice_token,
            "/v1/friends/accept",
            json!({ "id": request_id }),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let response = app
        .clone()
        .oneshot(post_json(
            bob_token,
            &format!("/v1/garden/{alice_id}/help"),
            json!({ "plot": 0 }),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let response = app
        .clone()
        .oneshot(post_json(
            bob_token,
            &format!("/v1/garden/{alice_id}/help"),
            json!({ "plot": 0 }),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let response = app
        .clone()
        .oneshot(post_json(
            carol_token,
            &format!("/v1/garden/{alice_id}/help"),
            json!({ "plot": 0 }),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);

    let response = app
        .clone()
        .oneshot(auth_request("GET", "/v1/garden", alice_token))
        .await
        .unwrap();
    let garden = json_body(response).await;
    assert_eq!(garden["plots"][0]["watered"], true);
    assert!(garden["visitors"]
        .as_array()
        .unwrap()
        .iter()
        .any(|visitor| visitor["action"] == "help" && visitor["actor_name"] == "water_bob"));

    let response = app
        .clone()
        .oneshot(auth_request("GET", "/v1/postcards", alice_token))
        .await
        .unwrap();
    let cards = json_body(response).await;
    assert!(cards["cards"]
        .as_array()
        .unwrap()
        .iter()
        .any(|card| card["template"] == "water_note" && card["sender"] == "water_bob"));
}

#[tokio::test]
async fn daily_garden_quest_harvest_and_claim() {
    let app = test_app().await;
    let grower = register_ok(&app, "quest_grower", None).await;
    let token = grower["token"].as_str().unwrap();

    let response = app
        .clone()
        .oneshot(auth_request("GET", "/v1/garden", token))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let garden = json_body(response).await;
    let quest = &garden["quest"];
    assert_eq!(quest["amount"], 1);
    assert_eq!(quest["progress"], 0);
    assert_eq!(quest["claimed"], false);
    let crop = quest["crop"].as_str().unwrap();
    let plot = match crop {
        "letter" => 0,
        "stamp" => 1,
        _ => 2,
    };

    let response = app
        .clone()
        .oneshot(post_json(
            token,
            "/v1/garden/harvest",
            json!({ "plot": plot }),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let response = app
        .clone()
        .oneshot(post_json(token, "/v1/garden/quest/claim", json!({})))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert!(
        json_body(response).await["reward"]["amount"]
            .as_i64()
            .unwrap()
            >= 1
    );

    let response = app
        .clone()
        .oneshot(post_json(token, "/v1/garden/quest/claim", json!({})))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn nightwatch_medals_are_serialized_and_idempotent() {
    let app = test_app().await;
    let eve = register_ok(&app, "eve_night", None).await;
    let eve_token = eve["token"].as_str().unwrap();
    let response = app
        .clone()
        .oneshot(post_json(
            eve_token,
            "/v1/nightwatch/claim",
            json!({ "level": 5 }),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let alice = register_ok(&app, "alice_night", None).await;
    let alice_token = alice["token"].as_str().unwrap();
    let response = app
        .clone()
        .oneshot(save_request(
            alice_token,
            0,
            json!({ "nightWatch": { "best": 20 } }),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let response = app
        .clone()
        .oneshot(post_json(
            alice_token,
            "/v1/nightwatch/claim",
            json!({ "level": 5 }),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let claimed = json_body(response).await;
    assert_eq!(claimed["collectible"]["kind"], "nightwatch");
    assert_eq!(claimed["collectible"]["template"], "night_5");
    assert_eq!(claimed["collectible"]["edition"], 100);
    assert_eq!(claimed["collectible"]["serial"], 1);

    let response = app
        .clone()
        .oneshot(post_json(
            alice_token,
            "/v1/nightwatch/claim",
            json!({ "level": 5 }),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert!(json_body(response).await["collectible"].is_null());

    let bob = register_ok(&app, "bob_night", None).await;
    let bob_token = bob["token"].as_str().unwrap();
    let response = app
        .clone()
        .oneshot(save_request(
            bob_token,
            0,
            json!({ "nightWatch": { "best": 5 } }),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let response = app
        .clone()
        .oneshot(post_json(
            bob_token,
            "/v1/nightwatch/claim",
            json!({ "level": 5 }),
        ))
        .await
        .unwrap();
    assert_eq!(json_body(response).await["collectible"]["serial"], 2);

    let response = app
        .clone()
        .oneshot(post_json(
            alice_token,
            "/v1/nightwatch/claim",
            json!({ "level": 20 }),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let deep = json_body(response).await;
    assert_eq!(deep["collectible"]["template"], "deep_20");
    assert_eq!(deep["collectible"]["edition"], 50);

    let response = app
        .clone()
        .oneshot(post_json(
            alice_token,
            "/v1/nightwatch/claim",
            json!({ "level": 7 }),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let response = app
        .clone()
        .oneshot(
            Request::post("/v1/nightwatch/claim")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(json!({ "level": 5 }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn save_publishes_best_night_to_square() {
    let app = test_app().await;
    let registered = register_ok(&app, "night_rank", None).await;
    let token = registered["token"].as_str().unwrap();

    let response = app
        .clone()
        .oneshot(save_request(
            token,
            0,
            json!({ "totalEarned": 123, "nightWatch": { "best": 7 } }),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let response = app
        .clone()
        .oneshot(auth_request("GET", "/v1/square", token))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let square = json_body(response).await;
    let me = square["players"]
        .as_array()
        .unwrap()
        .iter()
        .find(|player| player["name"] == "night_rank")
        .expect("registered player in square");
    assert_eq!(me["night_best"], 7);
}

#[tokio::test]
async fn postcard_daily_limit_is_atomic_under_concurrency() {
    use moss_sync::db::NewPostcard;

    let db = Arc::new(test_db().await);
    sqlx::query(
        "INSERT INTO users (id, username, username_key, verifier, created_at)
         VALUES ('race_user', 'race', 'race', '00', 0)
         ON CONFLICT DO NOTHING",
    )
    .execute(db.pool())
    .await
    .expect("seed user");
    let mut handles = Vec::new();
    for index in 0..6 {
        let db = db.clone();
        handles.push(tokio::spawn(async move {
            db.send_postcards_with_limit(
                "race_user".into(),
                "bot".into(),
                vec![NewPostcard {
                    sender_id: "b_moss".into(),
                    sender_name: "苔苔".into(),
                    sender_kind: "bot".into(),
                    recipient_id: "race_user".into(),
                    template: "reply".into(),
                    gift_kind: Some("ink".into()),
                    gift_amount: 1,
                    created_at: 100 + index,
                    arrives_at: 100 + index,
                }],
                5,
                0,
                100 + index,
            )
            .await
            .expect("send")
        }));
    }
    let mut accepted = 0;
    for handle in handles {
        if handle.await.expect("task") {
            accepted += 1;
        }
    }
    assert_eq!(accepted, 5);
}
