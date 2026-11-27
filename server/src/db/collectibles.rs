use serde::Serialize;
use sqlx::Row;

use crate::{db::Db, error::ApiError};

pub const POSTCARD_EDITION: i64 = 200;
pub const MEDAL_EDITION: i64 = 50;

const POSTCARD_SETS: [(&str, [&str; 2], &str); 4] = [
    ("town", ["b_moss", "b_box"], "medal_town"),
    ("starport", ["b_night", "b_star"], "medal_starport"),
    ("mistlake", ["b_boat", "b_snail"], "medal_mistlake"),
    ("rain", ["b_plane", "b_mushroom"], "medal_rain"),
];

#[derive(Debug, Clone, Serialize)]
pub struct Collectible {
    pub id: i64,
    pub kind: String,
    pub template: String,
    pub edition: i64,
    pub serial: i64,
    pub image_key: String,
    pub minted_at: i64,
}

impl Db {
    pub async fn list_collectibles(&self, user_id: String) -> Result<Vec<Collectible>, ApiError> {
        let rows = sqlx::query(
            "SELECT id, kind, template, edition, serial, image_key, minted_at
             FROM collectibles WHERE user_id = $1
             ORDER BY kind, template",
        )
        .bind(user_id)
        .fetch_all(self.pool())
        .await?;
        Ok(rows
            .into_iter()
            .map(|row| Collectible {
                id: row.get(0),
                kind: row.get(1),
                template: row.get(2),
                edition: row.get(3),
                serial: row.get(4),
                image_key: row.get(5),
                minted_at: row.get(6),
            })
            .collect())
    }

    /// Mints one collectible per user/kind/template while the fixed edition lasts.
    pub async fn mint_collectible(
        &self,
        user_id: String,
        kind: String,
        template: String,
        edition: i64,
        image_key: String,
        now: i64,
    ) -> Result<Option<Collectible>, ApiError> {
        let mut tx = self.pool().begin().await?;
        sqlx::query("SELECT pg_advisory_xact_lock(hashtext($1))")
            .bind(format!("collectible:{kind}:{template}"))
            .execute(&mut *tx)
            .await?;
        let existing = sqlx::query(
            "SELECT id FROM collectibles
             WHERE user_id = $1 AND kind = $2 AND template = $3",
        )
        .bind(&user_id)
        .bind(&kind)
        .bind(&template)
        .fetch_optional(&mut *tx)
        .await?;
        if existing.is_some() {
            tx.rollback().await?;
            return Ok(None);
        }
        let max_row = sqlx::query(
            "SELECT COALESCE(MAX(serial), 0) FROM collectibles
             WHERE kind = $1 AND template = $2",
        )
        .bind(&kind)
        .bind(&template)
        .fetch_one(&mut *tx)
        .await?;
        let max_serial: i64 = max_row.get(0);
        if max_serial >= edition {
            tx.rollback().await?;
            return Ok(None);
        }
        let serial = max_serial + 1;
        let row = sqlx::query(
            "INSERT INTO collectibles
             (user_id, kind, template, edition, serial, image_key, minted_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id",
        )
        .bind(&user_id)
        .bind(&kind)
        .bind(&template)
        .bind(edition)
        .bind(serial)
        .bind(&image_key)
        .bind(now)
        .fetch_one(&mut *tx)
        .await?;
        let id: i64 = row.get(0);
        tx.commit().await?;
        Ok(Some(Collectible {
            id,
            kind,
            template,
            edition,
            serial,
            image_key,
            minted_at: now,
        }))
    }

    pub async fn mint_postcard_collectibles(
        &self,
        user_id: String,
        bot_id: String,
        now: i64,
    ) -> Result<Vec<Collectible>, ApiError> {
        let mut minted = Vec::new();
        if let Some(card) = self
            .mint_collectible(
                user_id.clone(),
                "postcard".into(),
                bot_id.clone(),
                POSTCARD_EDITION,
                bot_id.clone(),
                now,
            )
            .await?
        {
            minted.push(card);
        }

        for (set_id, bots, image_key) in POSTCARD_SETS {
            if !bots.contains(&bot_id.as_str()) {
                continue;
            }
            let owned = self.collectible_set_progress(user_id.clone(), bots).await?;
            if !owned {
                continue;
            }
            if let Some(medal) = self
                .mint_collectible(
                    user_id.clone(),
                    "medal".into(),
                    set_id.to_string(),
                    MEDAL_EDITION,
                    image_key.to_string(),
                    now,
                )
                .await?
            {
                minted.push(medal);
            }
        }
        Ok(minted)
    }

    async fn collectible_set_progress(
        &self,
        user_id: String,
        bots: [&'static str; 2],
    ) -> Result<bool, ApiError> {
        let row = sqlx::query(
            "SELECT COUNT(DISTINCT template) FROM collectibles
             WHERE user_id = $1 AND kind = 'postcard' AND template IN ($2, $3)",
        )
        .bind(user_id)
        .bind(bots[0])
        .bind(bots[1])
        .fetch_one(self.pool())
        .await?;
        Ok(row.get::<i64, _>(0) >= 2)
    }
}
