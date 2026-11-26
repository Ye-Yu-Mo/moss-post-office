use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::{
    api::{auth::require_user, now},
    db::FriendRequestOutcome,
    error::ApiError,
    AppState,
};

#[derive(Serialize)]
pub struct FriendsResponse {
    pub code: String,
    pub friends: Vec<crate::db::FriendSummary>,
    pub incoming: Vec<crate::db::FriendRequestView>,
    pub outgoing: Vec<crate::db::FriendRequestView>,
}

pub async fn list_friends(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<FriendsResponse>, ApiError> {
    let context = require_user(&state, &headers).await?;
    let user_id = context.user.id;
    let code = state
        .db
        .friend_code(user_id.clone())
        .await?
        .unwrap_or_default();
    let friends = state.db.list_friends(user_id.clone()).await?;
    let (incoming, outgoing) = state.db.list_friend_requests(user_id).await?;
    Ok(Json(FriendsResponse {
        code,
        friends,
        incoming,
        outgoing,
    }))
}

#[derive(Deserialize)]
pub struct RequestFriend {
    pub code: String,
}

pub async fn send_friend_request(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<RequestFriend>,
) -> Result<Json<Value>, ApiError> {
    let context = require_user(&state, &headers).await?;
    let code = request.code.trim().to_ascii_uppercase();
    if code.len() != 6 {
        return Err(ApiError::BadRequest("invalid friend code"));
    }
    let Some(target_id) = state.db.user_id_by_friend_code(code).await? else {
        return Err(ApiError::NotFound("friend code"));
    };
    if target_id == context.user.id {
        return Err(ApiError::BadRequest("cannot add yourself"));
    }

    let outcome = state
        .db
        .request_friend(context.user.id, target_id, now())
        .await?;
    match outcome {
        FriendRequestOutcome::Sent => Ok(Json(json!({ "ok": true, "status": "sent" }))),
        FriendRequestOutcome::BecameFriends => Ok(Json(json!({ "ok": true, "status": "friends" }))),
        FriendRequestOutcome::AlreadyFriends => Err(ApiError::BadRequest("already friends")),
        FriendRequestOutcome::AlreadyPending => {
            Err(ApiError::BadRequest("request already pending"))
        }
        FriendRequestOutcome::Missing => Err(ApiError::NotFound("friend")),
    }
}

#[derive(Deserialize)]
pub struct FriendAction {
    pub id: i64,
}

pub async fn accept_friend_request(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<FriendAction>,
) -> Result<Json<Value>, ApiError> {
    let context = require_user(&state, &headers).await?;
    let accepted = state
        .db
        .accept_friend_request(context.user.id, request.id, now())
        .await?;
    if !accepted {
        return Err(ApiError::NotFound("friend request"));
    }
    Ok(Json(json!({ "ok": true })))
}

pub async fn decline_friend_request(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<FriendAction>,
) -> Result<Json<Value>, ApiError> {
    let context = require_user(&state, &headers).await?;
    let declined = state
        .db
        .decline_friend_request(context.user.id, request.id)
        .await?;
    if !declined {
        return Err(ApiError::NotFound("friend request"));
    }
    Ok(Json(json!({ "ok": true })))
}

pub async fn remove_friend(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(friend_id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let context = require_user(&state, &headers).await?;
    let removed = state.db.remove_friend(context.user.id, friend_id).await?;
    if !removed {
        return Err(ApiError::NotFound("friend"));
    }
    Ok(Json(json!({ "ok": true })))
}

pub async fn friend_profile(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(friend_id): Path<String>,
) -> Result<Json<crate::db::FriendProfile>, ApiError> {
    let context = require_user(&state, &headers).await?;
    let profile = state
        .db
        .friend_profile(context.user.id, friend_id)
        .await?
        .ok_or(ApiError::NotFound("friend"))?;
    Ok(Json(profile))
}
