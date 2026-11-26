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
    error::ApiError,
    AppState,
};

const MAX_POSTCARDS_PER_DAY: i64 = 5;

const USER_TEMPLATES: &[(&str, &str)] = &[
    ("hello", "今天邮局门口的苔藓又绿了一点。"),
    ("weather", "雾湖今天很轻，信都顺利上路了。"),
    ("route", "替你留意了星港的夜班车，没有晚点。"),
    ("star", "月亮出来的时候，替你把最后一张邮票盖好了。"),
];

const BOT_TEMPLATES: &[(&str, &str)] = &[
    ("welcome", "欢迎来镇口。以后有信，可以往我这边寄。"),
    ("reply", "收到你的明信片了。回你一张，路上小心。"),
];

fn template_text(id: &str) -> Option<&'static str> {
    USER_TEMPLATES
        .iter()
        .chain(BOT_TEMPLATES.iter())
        .find(|(template_id, _)| *template_id == id)
        .map(|(_, text)| *text)
}

fn is_user_template(id: &str) -> bool {
    USER_TEMPLATES
        .iter()
        .any(|(template_id, _)| *template_id == id)
}

fn bot_gift(bot_id: &str) -> (String, i64) {
    let hash: i64 = bot_id
        .bytes()
        .fold(0i64, |value, byte| {
            value.wrapping_mul(31).wrapping_add(byte as i64)
        })
        .abs();
    match hash % 4 {
        0 => ("paper".into(), 1),
        1 => ("wax".into(), 1),
        2 => ("cloth".into(), 1),
        _ => ("ink".into(), 2),
    }
}

#[derive(Serialize)]
pub struct SquarePlayer {
    pub id: String,
    pub name: String,
    pub bio: String,
    pub total_stamps: i64,
    pub expedition_wins: i64,
    pub last_active: i64,
    pub kind: &'static str,
}

#[derive(Serialize)]
pub struct SquareResponse {
    pub players: Vec<SquarePlayer>,
}

pub async fn square(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<SquareResponse>, ApiError> {
    let _context = require_user(&state, &headers).await?;
    let (users, bots) = state.db.list_square(now()).await?;
    let mut players = Vec::with_capacity(users.len() + bots.len());
    for user in users {
        players.push(SquarePlayer {
            id: user.id,
            name: user.username,
            bio: String::new(),
            total_stamps: user.total_stamps,
            expedition_wins: user.expedition_wins,
            last_active: user.last_active,
            kind: "user",
        });
    }
    for bot in bots {
        players.push(SquarePlayer {
            id: bot.id,
            name: format!("{} · {}", bot.name, bot.title),
            bio: bot.bio,
            total_stamps: bot.total_stamps,
            expedition_wins: bot.expedition_wins,
            last_active: bot.last_active,
            kind: "bot",
        });
    }
    players.sort_by(|left, right| right.total_stamps.cmp(&left.total_stamps));
    Ok(Json(SquareResponse { players }))
}

#[derive(Serialize)]
pub struct PostcardView {
    pub id: i64,
    pub sender: String,
    pub sender_kind: String,
    pub text: String,
    pub gift_kind: Option<String>,
    pub gift_amount: i64,
    pub created_at: i64,
    pub claimed: bool,
}

#[derive(Serialize)]
pub struct PostcardsResponse {
    pub cards: Vec<PostcardView>,
}

pub async fn postcards(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<PostcardsResponse>, ApiError> {
    let context = require_user(&state, &headers).await?;
    let created_at = now();
    state
        .db
        .ensure_welcome_postcard(context.user.id.clone(), created_at)
        .await?;
    let cards = state
        .db
        .list_postcards(context.user.id, created_at)
        .await?
        .into_iter()
        .map(|card| PostcardView {
            id: card.id,
            sender: card.sender_name,
            sender_kind: card.sender_kind,
            text: template_text(&card.template)
                .unwrap_or("一封从雾湖寄来的信。")
                .to_string(),
            gift_kind: card.gift_kind,
            gift_amount: card.gift_amount,
            created_at: card.created_at,
            claimed: card.claimed,
        })
        .collect();
    Ok(Json(PostcardsResponse { cards }))
}

#[derive(Deserialize)]
pub struct SendRequest {
    pub recipient_id: String,
    pub recipient_kind: String,
    pub template: String,
}

pub async fn send_postcard(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<SendRequest>,
) -> Result<Json<Value>, ApiError> {
    let context = require_user(&state, &headers).await?;
    let user_id = context.user.id.clone();
    let user_name = context.user.username.clone();
    let template = request.template.trim();
    if !is_user_template(template) {
        return Err(ApiError::BadRequest("unknown postcard template"));
    }
    let recipient_id = request.recipient_id.trim().to_string();
    if recipient_id.is_empty() || recipient_id.len() > 64 || recipient_id == user_id {
        return Err(ApiError::BadRequest("invalid recipient"));
    }

    let created_at = now();
    let sent = state
        .db
        .count_postcards_sent_since(user_id.clone(), created_at - 86_400)
        .await?;
    if sent >= MAX_POSTCARDS_PER_DAY {
        return Err(ApiError::BadRequest("daily postcard limit reached"));
    }

    match request.recipient_kind.as_str() {
        "user" => {
            if !state.db.user_exists(recipient_id.clone()).await? {
                return Err(ApiError::NotFound("recipient"));
            }
            state
                .db
                .insert_postcard(crate::db::NewPostcard {
                    sender_id: user_id.clone(),
                    sender_name: user_name,
                    sender_kind: "user".into(),
                    recipient_id,
                    template: template.into(),
                    gift_kind: None,
                    gift_amount: 0,
                    created_at,
                    arrives_at: created_at,
                })
                .await?;
            state
                .db
                .record_postcard_send(user_id, "user".into(), created_at)
                .await?;
            Ok(Json(json!({ "ok": true, "reply": false })))
        }
        "bot" => {
            let Some(bot) = state.db.bot_by_id(recipient_id.clone()).await? else {
                return Err(ApiError::NotFound("bot"));
            };
            let (gift_kind, gift_amount) = bot_gift(&bot.id);
            state
                .db
                .insert_postcard(crate::db::NewPostcard {
                    sender_id: bot.id,
                    sender_name: bot.name,
                    sender_kind: "bot".into(),
                    recipient_id: user_id.clone(),
                    template: "reply".into(),
                    gift_kind: Some(gift_kind),
                    gift_amount,
                    created_at,
                    arrives_at: created_at,
                })
                .await?;
            state
                .db
                .record_postcard_send(user_id, "bot".into(), created_at)
                .await?;
            Ok(Json(json!({ "ok": true, "reply": true })))
        }
        _ => Err(ApiError::BadRequest("invalid recipient_kind")),
    }
}

pub async fn claim_postcard(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(postcard_id): Path<i64>,
) -> Result<Json<Value>, ApiError> {
    let context = require_user(&state, &headers).await?;
    let gift = state
        .db
        .claim_postcard(context.user.id, postcard_id, now())
        .await?;
    match gift {
        Some((kind, amount)) => Ok(Json(json!({
            "ok": true,
            "gift_kind": kind,
            "gift_amount": amount
        }))),
        None => Err(ApiError::NotFound("postcard")),
    }
}
