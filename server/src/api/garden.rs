use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{
    api::{auth::require_user, now},
    error::ApiError,
    AppState,
};

#[derive(Serialize)]
pub struct GardenOwner {
    pub id: String,
    pub name: String,
    pub kind: &'static str,
}

#[derive(Serialize)]
pub struct GardenResponse {
    pub owner: GardenOwner,
    pub plots: Vec<crate::db::GardenPlot>,
}

pub async fn own_garden(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<GardenResponse>, ApiError> {
    let context = require_user(&state, &headers).await?;
    let created_at = now();
    state
        .db
        .ensure_garden(context.user.id.clone(), created_at, true)
        .await?;
    let plots = state.db.garden(context.user.id.clone(), created_at).await?;
    Ok(Json(GardenResponse {
        owner: GardenOwner {
            id: context.user.id,
            name: context.user.username,
            kind: "user",
        },
        plots,
    }))
}

pub async fn friend_garden(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(owner_id): Path<String>,
) -> Result<Json<GardenResponse>, ApiError> {
    let context = require_user(&state, &headers).await?;
    if owner_id == context.user.id {
        return own_garden(State(state), headers).await;
    }
    let created_at = now();
    if let Some(bot) = state.db.bot_by_id(owner_id.clone()).await? {
        state
            .db
            .ensure_garden(owner_id.clone(), created_at, true)
            .await?;
        let plots = state.db.garden(owner_id, created_at).await?;
        return Ok(Json(GardenResponse {
            owner: GardenOwner {
                id: bot.id,
                name: bot.name,
                kind: "bot",
            },
            plots,
        }));
    }

    if !state
        .db
        .are_friends(context.user.id.clone(), owner_id.clone())
        .await?
    {
        return Err(ApiError::NotFound("garden"));
    }
    let profile = state
        .db
        .friend_profile(context.user.id, owner_id.clone())
        .await?
        .ok_or(ApiError::NotFound("garden"))?;
    state
        .db
        .ensure_garden(owner_id.clone(), created_at, true)
        .await?;
    let plots = state.db.garden(owner_id, created_at).await?;
    Ok(Json(GardenResponse {
        owner: GardenOwner {
            id: profile.friend.id,
            name: profile.friend.username,
            kind: "user",
        },
        plots,
    }))
}

#[derive(Deserialize)]
pub struct PlotRequest {
    pub plot: i64,
}

#[derive(Deserialize)]
pub struct PlantRequest {
    pub plot: i64,
    pub crop: String,
}

pub async fn plant(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<PlantRequest>,
) -> Result<Json<Value>, ApiError> {
    let context = require_user(&state, &headers).await?;
    let planted = state
        .db
        .plant_plot(context.user.id, request.plot, request.crop, now())
        .await?;
    if planted {
        Ok(Json(serde_json::json!({ "ok": true })))
    } else {
        Err(ApiError::BadRequest("cannot plant here"))
    }
}

pub async fn water(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<PlotRequest>,
) -> Result<Json<Value>, ApiError> {
    let context = require_user(&state, &headers).await?;
    let watered = state
        .db
        .water_plot(context.user.id, request.plot, now())
        .await?;
    if watered {
        Ok(Json(serde_json::json!({ "ok": true })))
    } else {
        Err(ApiError::BadRequest("cannot water now"))
    }
}

pub async fn harvest(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<PlotRequest>,
) -> Result<Json<Value>, ApiError> {
    let context = require_user(&state, &headers).await?;
    let reward = state
        .db
        .harvest_plot(context.user.id, request.plot, now())
        .await?;
    match reward {
        Some(reward) => Ok(Json(serde_json::json!({ "ok": true, "reward": reward }))),
        None => Err(ApiError::BadRequest("crop is not ripe")),
    }
}

pub async fn steal(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(owner_id): Path<String>,
    Json(request): Json<PlotRequest>,
) -> Result<Json<Value>, ApiError> {
    let context = require_user(&state, &headers).await?;
    if owner_id == context.user.id {
        return Err(ApiError::BadRequest("cannot steal from yourself"));
    }
    let is_bot = state.db.bot_by_id(owner_id.clone()).await?.is_some();
    if !is_bot
        && !state
            .db
            .are_friends(context.user.id.clone(), owner_id.clone())
            .await?
    {
        return Err(ApiError::NotFound("garden"));
    }
    let created_at = now();
    state
        .db
        .ensure_garden(owner_id.clone(), created_at, true)
        .await?;
    let reward = state
        .db
        .steal_plot(
            context.user.id.clone(),
            owner_id.clone(),
            request.plot,
            created_at,
            is_bot,
        )
        .await?;
    match reward {
        Some(reward) => {
            if !is_bot {
                state
                    .db
                    .insert_postcard(crate::db::NewPostcard {
                        sender_id: context.user.id,
                        sender_name: context.user.username,
                        sender_kind: "user".into(),
                        recipient_id: owner_id,
                        template: "steal_note".into(),
                        gift_kind: None,
                        gift_amount: 0,
                        created_at,
                        arrives_at: created_at,
                    })
                    .await?;
            }
            Ok(Json(serde_json::json!({ "ok": true, "reward": reward })))
        }
        None => Err(ApiError::BadRequest("nothing to steal")),
    }
}
