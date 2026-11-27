use sqlx::Row;

use crate::{db::Db, error::ApiError};

#[derive(Debug, Clone)]
pub struct SquareUser {
    pub id: String,
    pub username: String,
    pub total_stamps: i64,
    pub expedition_wins: i64,
    pub night_best: i64,
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
    pub night_best: i64,
    pub last_active: i64,
}

#[derive(Debug, Clone)]
pub struct PostcardRow {
    pub id: i64,
    pub sender_id: String,
    pub sender_name: String,
    pub sender_kind: String,
    pub template: String,
    pub gift_kind: Option<String>,
    pub gift_amount: i64,
    pub created_at: i64,
    pub arrives_at: i64,
    pub claimed: bool,
}

pub struct ClaimedPostcard {
    pub gift_kind: Option<String>,
    pub gift_amount: i64,
    pub sender_id: String,
    pub sender_kind: String,
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
        let row = sqlx::query("SELECT COUNT(*) FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_one(self.pool())
            .await?;
        Ok(row.get::<i64, _>(0) > 0)
    }

    pub async fn list_square(
        &self,
        now: i64,
    ) -> Result<(Vec<SquareUser>, Vec<BotSummary>), ApiError> {
        let rows = sqlx::query(
            "SELECT id, username, total_stamps, expedition_wins, night_best, last_active
             FROM users
             ORDER BY total_stamps DESC, last_active DESC
             LIMIT 20",
        )
        .fetch_all(self.pool())
        .await?;
        let players = rows
            .into_iter()
            .map(|row| SquareUser {
                id: row.get(0),
                username: row.get(1),
                total_stamps: row.get(2),
                expedition_wins: row.get(3),
                night_best: row.get(4),
                last_active: row.get(5),
            })
            .collect();

        let rows = sqlx::query(
            "SELECT id, name, title, bio, base_stamps, daily_stamps, base_wins, daily_wins, created_at
             FROM bots",
        )
        .fetch_all(self.pool())
        .await?;
        let mut bots = Vec::new();
        for row in rows {
            let id: String = row.get(0);
            let name: String = row.get(1);
            let title: String = row.get(2);
            let bio: String = row.get(3);
            let base_stamps: i64 = row.get(4);
            let daily_stamps: i64 = row.get(5);
            let base_wins: i64 = row.get(6);
            let daily_wins: i64 = row.get(7);
            let created_at: i64 = row.get(8);
            let age_days = ((now - created_at).max(0) / 86_400).max(0);
            let variation = hash_text(&id) % 97;
            let total_stamps = base_stamps + age_days * daily_stamps + variation;
            let expedition_wins = base_wins + age_days * daily_wins + (variation % 2);
            let night_best = 3 + hash_text(&id) % 9;
            let last_active = now - (60 + hash_text(&id) % 3_600);
            bots.push(BotSummary {
                id,
                name,
                title,
                bio,
                total_stamps,
                expedition_wins,
                night_best,
                last_active,
            });
        }
        bots.sort_by(|left, right| right.total_stamps.cmp(&left.total_stamps));
        Ok((players, bots))
    }

    pub async fn bot_by_id(&self, bot_id: String) -> Result<Option<BotIdentity>, ApiError> {
        let row = sqlx::query("SELECT id, name FROM bots WHERE id = $1")
            .bind(bot_id)
            .fetch_optional(self.pool())
            .await?;
        Ok(row.map(|row| BotIdentity {
            id: row.get(0),
            name: row.get(1),
        }))
    }

    pub async fn random_bot(&self, seed_text: String) -> Result<Option<BotIdentity>, ApiError> {
        let rows = sqlx::query("SELECT id, name FROM bots ORDER BY id")
            .fetch_all(self.pool())
            .await?;
        if rows.is_empty() {
            return Ok(None);
        }
        let bots: Vec<BotIdentity> = rows
            .into_iter()
            .map(|row| BotIdentity {
                id: row.get(0),
                name: row.get(1),
            })
            .collect();
        let index = hash_text(&seed_text) as usize % bots.len();
        Ok(Some(bots[index].clone()))
    }

    pub async fn insert_postcard(&self, card: NewPostcard) -> Result<(), ApiError> {
        sqlx::query(
            "INSERT INTO postcards
             (sender_id, sender_name, sender_kind, recipient_id, template,
              gift_kind, gift_amount, created_at, arrives_at, claimed_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL)",
        )
        .bind(card.sender_id)
        .bind(card.sender_name)
        .bind(card.sender_kind)
        .bind(card.recipient_id)
        .bind(card.template)
        .bind(card.gift_kind)
        .bind(card.gift_amount)
        .bind(card.created_at)
        .bind(card.arrives_at)
        .execute(self.pool())
        .await?;
        Ok(())
    }

    pub async fn send_postcards_with_limit(
        &self,
        user_id: String,
        recipient_kind: String,
        cards: Vec<NewPostcard>,
        limit: i64,
        since: i64,
        now: i64,
    ) -> Result<bool, ApiError> {
        let mut tx = self.pool().begin().await?;
        sqlx::query("SELECT pg_advisory_xact_lock(hashtext($1))")
            .bind(&user_id)
            .execute(&mut *tx)
            .await?;
        let row = sqlx::query(
            "SELECT COUNT(*) FROM postcard_sends
             WHERE user_id = $1 AND created_at >= $2",
        )
        .bind(&user_id)
        .bind(since)
        .fetch_one(&mut *tx)
        .await?;
        if row.get::<i64, _>(0) >= limit {
            tx.rollback().await?;
            return Ok(false);
        }
        for card in cards {
            sqlx::query(
                "INSERT INTO postcards
                 (sender_id, sender_name, sender_kind, recipient_id, template,
                  gift_kind, gift_amount, created_at, arrives_at, claimed_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL)",
            )
            .bind(card.sender_id)
            .bind(card.sender_name)
            .bind(card.sender_kind)
            .bind(card.recipient_id)
            .bind(card.template)
            .bind(card.gift_kind)
            .bind(card.gift_amount)
            .bind(card.created_at)
            .bind(card.arrives_at)
            .execute(&mut *tx)
            .await?;
        }
        sqlx::query(
            "INSERT INTO postcard_sends (user_id, recipient_kind, created_at)
             VALUES ($1, $2, $3)",
        )
        .bind(&user_id)
        .bind(recipient_kind)
        .bind(now)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(true)
    }

    pub async fn count_postcards_sent_since(
        &self,
        user_id: String,
        since: i64,
    ) -> Result<i64, ApiError> {
        let row = sqlx::query(
            "SELECT COUNT(*) FROM postcard_sends
             WHERE user_id = $1 AND created_at >= $2",
        )
        .bind(user_id)
        .bind(since)
        .fetch_one(self.pool())
        .await?;
        Ok(row.get(0))
    }

    pub async fn record_postcard_send(
        &self,
        user_id: String,
        recipient_kind: String,
        now: i64,
    ) -> Result<(), ApiError> {
        sqlx::query(
            "INSERT INTO postcard_sends (user_id, recipient_kind, created_at)
             VALUES ($1, $2, $3)",
        )
        .bind(user_id)
        .bind(recipient_kind)
        .bind(now)
        .execute(self.pool())
        .await?;
        Ok(())
    }

    pub async fn list_postcards(
        &self,
        user_id: String,
        now: i64,
    ) -> Result<Vec<PostcardRow>, ApiError> {
        let rows = sqlx::query(
            "SELECT id, sender_id, sender_name, sender_kind, template, gift_kind, gift_amount,
                    created_at, arrives_at, claimed_at
             FROM postcards
             WHERE recipient_id = $1 AND arrives_at <= $2
             ORDER BY id DESC
             LIMIT 50",
        )
        .bind(user_id)
        .bind(now)
        .fetch_all(self.pool())
        .await?;
        Ok(rows
            .into_iter()
            .map(|row| PostcardRow {
                id: row.get(0),
                sender_id: row.get(1),
                sender_name: row.get(2),
                sender_kind: row.get(3),
                template: row.get(4),
                gift_kind: row.get(5),
                gift_amount: row.get(6),
                created_at: row.get(7),
                arrives_at: row.get(8),
                claimed: row.get::<Option<i64>, _>(9).is_some(),
            })
            .collect())
    }

    pub async fn ensure_welcome_postcard(&self, user_id: String, now: i64) -> Result<(), ApiError> {
        let mut tx = self.pool().begin().await?;
        sqlx::query("SELECT pg_advisory_xact_lock(hashtext($1))")
            .bind(&user_id)
            .execute(&mut *tx)
            .await?;
        let row = sqlx::query(
            "SELECT COUNT(*) FROM postcards
             WHERE recipient_id = $1 AND sender_kind = 'bot'",
        )
        .bind(&user_id)
        .fetch_one(&mut *tx)
        .await?;
        if row.get::<i64, _>(0) > 0 {
            tx.commit().await?;
            return Ok(());
        }
        let rows = sqlx::query("SELECT id, name FROM bots ORDER BY id")
            .fetch_all(&mut *tx)
            .await?;
        if rows.is_empty() {
            tx.commit().await?;
            return Ok(());
        }
        let bots: Vec<(String, String)> = rows
            .into_iter()
            .map(|row| (row.get(0), row.get(1)))
            .collect();
        let index = hash_text(&user_id) as usize % bots.len();
        let (bot_id, bot_name) = &bots[index];
        sqlx::query(
            "INSERT INTO postcards
             (sender_id, sender_name, sender_kind, recipient_id, template,
              gift_kind, gift_amount, created_at, arrives_at, claimed_at)
             VALUES ($1, $2, 'bot', $3, 'welcome', 'ink', 2, $4, $4, NULL)",
        )
        .bind(bot_id)
        .bind(bot_name)
        .bind(&user_id)
        .bind(now)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(())
    }

    /// Inserts at most one daily NPC letter per UTC day.
    pub async fn ensure_daily_postcard(&self, user_id: String, now: i64) -> Result<(), ApiError> {
        let mut tx = self.pool().begin().await?;
        sqlx::query("SELECT pg_advisory_xact_lock(hashtext($1))")
            .bind(&user_id)
            .execute(&mut *tx)
            .await?;
        let day_start = now - now % 86_400;
        let row = sqlx::query(
            "SELECT COUNT(*) FROM postcards
             WHERE recipient_id = $1 AND sender_kind = 'bot'
               AND template LIKE 'daily_%' AND created_at >= $2",
        )
        .bind(&user_id)
        .bind(day_start)
        .fetch_one(&mut *tx)
        .await?;
        if row.get::<i64, _>(0) > 0 {
            tx.commit().await?;
            return Ok(());
        }
        let rows = sqlx::query("SELECT id, name FROM bots ORDER BY id")
            .fetch_all(&mut *tx)
            .await?;
        if rows.is_empty() {
            tx.commit().await?;
            return Ok(());
        }
        let bots: Vec<(String, String)> = rows
            .into_iter()
            .map(|row| (row.get(0), row.get(1)))
            .collect();
        let day = now / 86_400;
        let index = hash_text(&format!("{user_id}:{day}")) as usize % bots.len();
        let (bot_id, bot_name) = &bots[index];
        let (gift_kind, gift_amount) = if day % 3 == 0 {
            ("paper".to_string(), 1)
        } else if day % 3 == 1 {
            ("wax".to_string(), 1)
        } else {
            ("ink".to_string(), 1)
        };
        let template = format!("daily_{}", day % 4);
        sqlx::query(
            "INSERT INTO postcards
             (sender_id, sender_name, sender_kind, recipient_id, template,
              gift_kind, gift_amount, created_at, arrives_at, claimed_at)
             VALUES ($1, $2, 'bot', $3, $4, $5, $6, $7, $7, NULL)",
        )
        .bind(bot_id)
        .bind(bot_name)
        .bind(&user_id)
        .bind(template)
        .bind(gift_kind)
        .bind(gift_amount)
        .bind(now)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(())
    }

    pub async fn claim_postcard(
        &self,
        user_id: String,
        postcard_id: i64,
        now: i64,
    ) -> Result<Option<ClaimedPostcard>, ApiError> {
        let row = sqlx::query(
            "UPDATE postcards SET claimed_at = $1
             WHERE id = $2 AND recipient_id = $3
               AND claimed_at IS NULL AND gift_kind IS NOT NULL AND arrives_at <= $1
             RETURNING sender_id, sender_kind, gift_kind, gift_amount",
        )
        .bind(now)
        .bind(postcard_id)
        .bind(user_id)
        .fetch_optional(self.pool())
        .await?;
        Ok(row.map(|row| ClaimedPostcard {
            sender_id: row.get(0),
            sender_kind: row.get(1),
            gift_kind: row.get(2),
            gift_amount: row.get(3),
        }))
    }
}
