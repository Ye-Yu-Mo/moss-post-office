use rusqlite::{params, OptionalExtension};

use crate::{db::Db, error::ApiError};

#[derive(Debug, Clone)]
pub struct SquareUser {
    pub id: String,
    pub username: String,
    pub total_stamps: i64,
    pub expedition_wins: i64,
    pub last_active: i64,
}

#[derive(Debug, Clone)]
pub struct BotSummary {
    pub id: String,
    pub name: String,
    pub title: String,
    pub bio: String,
    pub total_stamps: i64,
    pub expedition_wins: i64,
    pub last_active: i64,
}

#[derive(Debug, Clone)]
pub struct PostcardRow {
    pub id: i64,
    pub sender_name: String,
    pub sender_kind: String,
    pub template: String,
    pub gift_kind: Option<String>,
    pub gift_amount: i64,
    pub created_at: i64,
    pub arrives_at: i64,
    pub claimed: bool,
}

pub struct NewPostcard {
    pub sender_id: String,
    pub sender_name: String,
    pub sender_kind: String,
    pub recipient_id: String,
    pub template: String,
    pub gift_kind: Option<String>,
    pub gift_amount: i64,
    pub created_at: i64,
    pub arrives_at: i64,
}

#[derive(Debug, Clone)]
pub struct BotIdentity {
    pub id: String,
    pub name: String,
}

fn hash_text(text: &str) -> i64 {
    let mut hash: i64 = 0;
    for byte in text.bytes() {
        hash = hash.wrapping_mul(31).wrapping_add(byte as i64);
    }
    hash.unsigned_abs() as i64
}

impl Db {
    pub async fn user_exists(&self, user_id: String) -> Result<bool, ApiError> {
        self.call(move |conn| {
            let count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM users WHERE id = ?1",
                [user_id],
                |row| row.get(0),
            )?;
            Ok(count > 0)
        })
        .await
    }

    pub async fn list_square(
        &self,
        now: i64,
    ) -> Result<(Vec<SquareUser>, Vec<BotSummary>), ApiError> {
        self.call(move |conn| {
            let mut players = Vec::new();
            {
                let mut statement = conn.prepare(
                    "SELECT id, username, total_stamps, expedition_wins, last_active
                     FROM users
                     ORDER BY total_stamps DESC, last_active DESC
                     LIMIT 20",
                )?;
                let rows = statement.query_map([], |row| {
                    Ok(SquareUser {
                        id: row.get(0)?,
                        username: row.get(1)?,
                        total_stamps: row.get(2)?,
                        expedition_wins: row.get(3)?,
                        last_active: row.get(4)?,
                    })
                })?;
                for row in rows {
                    players.push(row?);
                }
            }

            let mut bots = Vec::new();
            {
                let mut statement = conn.prepare(
                    "SELECT id, name, title, bio, base_stamps, daily_stamps, base_wins, daily_wins, created_at
                     FROM bots",
                )?;
                let rows = statement.query_map([], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, String>(3)?,
                        row.get::<_, i64>(4)?,
                        row.get::<_, i64>(5)?,
                        row.get::<_, i64>(6)?,
                        row.get::<_, i64>(7)?,
                        row.get::<_, i64>(8)?,
                    ))
                })?;
                for row in rows {
                    let (
                        id,
                        name,
                        title,
                        bio,
                        base_stamps,
                        daily_stamps,
                        base_wins,
                        daily_wins,
                        created_at,
                    ) = row?;
                    let age_days = ((now - created_at).max(0) / 86_400).max(0);
                    let variation = hash_text(&id) % 97;
                    let total_stamps = base_stamps + age_days * daily_stamps + variation;
                    let expedition_wins = base_wins + age_days * daily_wins + (variation % 2);
                    let last_active = now - (60 + hash_text(&id) % 3_600);
                    bots.push(BotSummary {
                        id,
                        name,
                        title,
                        bio,
                        total_stamps,
                        expedition_wins,
                        last_active,
                    });
                }
            }
            bots.sort_by(|left, right| right.total_stamps.cmp(&left.total_stamps));
            Ok((players, bots))
        })
        .await
    }

    pub async fn bot_by_id(&self, bot_id: String) -> Result<Option<BotIdentity>, ApiError> {
        self.call(move |conn| {
            conn.query_row("SELECT id, name FROM bots WHERE id = ?1", [bot_id], |row| {
                Ok(BotIdentity {
                    id: row.get(0)?,
                    name: row.get(1)?,
                })
            })
            .optional()
        })
        .await
    }

    pub async fn random_bot(&self, seed_text: String) -> Result<Option<BotIdentity>, ApiError> {
        self.call(move |conn| {
            let mut statement = conn.prepare("SELECT id, name FROM bots ORDER BY id")?;
            let rows = statement.query_map([], |row| {
                Ok(BotIdentity {
                    id: row.get(0)?,
                    name: row.get(1)?,
                })
            })?;
            let bots = rows.collect::<rusqlite::Result<Vec<_>>>()?;
            if bots.is_empty() {
                return Ok(None);
            }
            let index = hash_text(&seed_text) as usize % bots.len();
            Ok(Some(bots[index].clone()))
        })
        .await
    }

    pub async fn insert_postcard(&self, card: NewPostcard) -> Result<(), ApiError> {
        self.call(move |conn| {
            conn.execute(
                "INSERT INTO postcards
                 (sender_id, sender_name, sender_kind, recipient_id, template,
                  gift_kind, gift_amount, created_at, arrives_at, claimed_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, NULL)",
                params![
                    card.sender_id,
                    card.sender_name,
                    card.sender_kind,
                    card.recipient_id,
                    card.template,
                    card.gift_kind,
                    card.gift_amount,
                    card.created_at,
                    card.arrives_at
                ],
            )?;
            Ok(())
        })
        .await
    }

    pub async fn count_postcards_sent_since(
        &self,
        user_id: String,
        since: i64,
    ) -> Result<i64, ApiError> {
        self.call(move |conn| {
            let count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM postcard_sends
                 WHERE user_id = ?1 AND created_at >= ?2",
                params![user_id, since],
                |row| row.get(0),
            )?;
            Ok(count)
        })
        .await
    }

    pub async fn record_postcard_send(
        &self,
        user_id: String,
        recipient_kind: String,
        now: i64,
    ) -> Result<(), ApiError> {
        self.call(move |conn| {
            conn.execute(
                "INSERT INTO postcard_sends (user_id, recipient_kind, created_at)
                 VALUES (?1, ?2, ?3)",
                params![user_id, recipient_kind, now],
            )?;
            Ok(())
        })
        .await
    }

    pub async fn list_postcards(
        &self,
        user_id: String,
        now: i64,
    ) -> Result<Vec<PostcardRow>, ApiError> {
        self.call(move |conn| {
            let mut statement = conn.prepare(
                "SELECT id, sender_name, sender_kind, template, gift_kind, gift_amount,
                        created_at, arrives_at, claimed_at
                 FROM postcards
                 WHERE recipient_id = ?1 AND arrives_at <= ?2
                 ORDER BY id DESC
                 LIMIT 50",
            )?;
            let rows = statement.query_map(params![user_id, now], |row| {
                Ok(PostcardRow {
                    id: row.get(0)?,
                    sender_name: row.get(1)?,
                    sender_kind: row.get(2)?,
                    template: row.get(3)?,
                    gift_kind: row.get(4)?,
                    gift_amount: row.get(5)?,
                    created_at: row.get(6)?,
                    arrives_at: row.get(7)?,
                    claimed: row.get::<_, Option<i64>>(8)?.is_some(),
                })
            })?;
            let mut cards = Vec::new();
            for row in rows {
                cards.push(row?);
            }
            Ok(cards)
        })
        .await
    }

    pub async fn ensure_welcome_postcard(&self, user_id: String, now: i64) -> Result<(), ApiError> {
        self.call(move |conn| {
            let count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM postcards
                 WHERE recipient_id = ?1 AND sender_kind = 'bot'",
                [&user_id],
                |row| row.get(0),
            )?;
            if count > 0 {
                return Ok(());
            }
            let mut statement = conn.prepare("SELECT id, name FROM bots ORDER BY id")?;
            let rows = statement.query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })?;
            let bots = rows.collect::<rusqlite::Result<Vec<_>>>()?;
            if bots.is_empty() {
                return Ok(());
            }
            let index = hash_text(&user_id) as usize % bots.len();
            let (bot_id, bot_name) = &bots[index];
            conn.execute(
                "INSERT INTO postcards
                 (sender_id, sender_name, sender_kind, recipient_id, template,
                  gift_kind, gift_amount, created_at, arrives_at, claimed_at)
                 VALUES (?1, ?2, 'bot', ?3, 'welcome', 'ink', 2, ?4, ?4, NULL)",
                params![bot_id, bot_name, user_id, now],
            )?;
            Ok(())
        })
        .await
    }

    pub async fn claim_postcard(
        &self,
        user_id: String,
        postcard_id: i64,
        now: i64,
    ) -> Result<Option<(String, i64)>, ApiError> {
        self.call(move |conn| {
            let updated = conn.execute(
                "UPDATE postcards SET claimed_at = ?1
                 WHERE id = ?2 AND recipient_id = ?3
                   AND claimed_at IS NULL AND gift_kind IS NOT NULL AND arrives_at <= ?1",
                params![now, postcard_id, user_id],
            )?;
            if updated == 0 {
                return Ok(None);
            }
            let gift = conn.query_row(
                "SELECT gift_kind, gift_amount FROM postcards WHERE id = ?1",
                [postcard_id],
                |row| Ok((row.get::<_, Option<String>>(0)?, row.get::<_, i64>(1)?)),
            )?;
            Ok(gift.0.map(|kind| (kind, gift.1)))
        })
        .await
    }
}
