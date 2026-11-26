use rusqlite::{params, OptionalExtension, TransactionBehavior};
use serde::Serialize;

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
        self.call(move |conn| {
            let mut statement = conn.prepare(
                "SELECT id, kind, template, edition, serial, image_key, minted_at
                 FROM collectibles WHERE user_id = ?1
                 ORDER BY kind, template",
            )?;
            let rows = statement.query_map([user_id], |row| {
                Ok(Collectible {
                    id: row.get(0)?,
                    kind: row.get(1)?,
                    template: row.get(2)?,
                    edition: row.get(3)?,
                    serial: row.get(4)?,
                    image_key: row.get(5)?,
                    minted_at: row.get(6)?,
                })
            })?;
            let mut items = Vec::new();
            for row in rows {
                items.push(row?);
            }
            Ok(items)
        })
        .await
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
        self.call(move |conn| {
            let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
            let existing: Option<i64> = tx
                .query_row(
                    "SELECT id FROM collectibles
                     WHERE user_id = ?1 AND kind = ?2 AND template = ?3",
                    params![user_id, kind, template],
                    |row| row.get(0),
                )
                .optional()?;
            if existing.is_some() {
                return Ok(None);
            }
            let max_serial: i64 = tx.query_row(
                "SELECT COALESCE(MAX(serial), 0) FROM collectibles
                 WHERE kind = ?1 AND template = ?2",
                params![kind, template],
                |row| row.get(0),
            )?;
            if max_serial >= edition {
                return Ok(None);
            }
            let serial = max_serial + 1;
            tx.execute(
                "INSERT INTO collectibles
                 (user_id, kind, template, edition, serial, image_key, minted_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![user_id, kind, template, edition, serial, image_key, now],
            )?;
            let id = tx.last_insert_rowid();
            tx.commit()?;
            Ok(Some(Collectible {
                id,
                kind,
                template,
                edition,
                serial,
                image_key,
                minted_at: now,
            }))
        })
        .await
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
        self.call(move |conn| {
            let count: i64 = conn.query_row(
                "SELECT COUNT(DISTINCT template) FROM collectibles
                 WHERE user_id = ?1 AND kind = 'postcard' AND template IN (?2, ?3)",
                params![user_id, bots[0], bots[1]],
                |row| row.get(0),
            )?;
            Ok(count >= 2)
        })
        .await
    }
}
