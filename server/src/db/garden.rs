use sqlx::Row;
use serde::Serialize;

use crate::{db::Db, error::ApiError};

pub const GARDEN_CROPS: [(&str, &str, i64, i64, i64); 6] = [
    ("letter", "信封草", 45 * 60, 3, 0),
    ("stamp", "邮票花", 60 * 60, 3, 0),
    ("inkberry", "墨莓", 75 * 60, 3, 0),
    ("starchild", "星屑花", 90 * 60, 6, 3),
    ("rainbowvine", "彩纸藤", 80 * 60, 5, 6),
    ("mooncap", "月光菇", 120 * 60, 6, 9),
];

#[derive(Debug, Clone, Serialize)]
pub struct GardenPlot {
    pub plot: i64,
    pub crop: String,
    pub name: String,
    pub planted_at: i64,
    pub ripe_at: i64,
    pub stolen: i64,
    pub watered: bool,
    pub empty: bool,
    pub yield_amount: i64,
    pub ripe: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct CropStat {
    pub crop: String,
    pub name: String,
    pub harvests: i64,
    pub stolen: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct GardenVisitor {
    pub actor_name: String,
    pub action: String,
    pub crop: String,
    pub name: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct GardenQuest {
    pub crop: String,
    pub name: String,
    pub amount: i64,
    pub progress: i64,
    pub reward_kind: String,
    pub reward_amount: i64,
    pub claimed: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct QuestReward {
    pub kind: String,
    pub amount: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct GardenReward {
    pub crop: String,
    pub name: String,
    pub amount: i64,
}

fn name_of(crop: &str) -> &'static str {
    GARDEN_CROPS
        .iter()
        .find(|(id, _, _, _, _)| *id == crop)
        .map(|(_, name, _, _, _)| *name)
        .unwrap_or("空地")
}

fn duration_of(crop: &str) -> i64 {
    GARDEN_CROPS
        .iter()
        .find(|(id, _, _, _, _)| *id == crop)
        .map(|(_, _, duration, _, _)| *duration)
        .unwrap_or(3600)
}

fn yield_of(crop: &str) -> i64 {
    GARDEN_CROPS
        .iter()
        .find(|(id, _, _, _, _)| *id == crop)
        .map(|(_, _, _, yield_amount, _)| *yield_amount)
        .unwrap_or(0)
}

fn is_crop(crop: &str) -> bool {
    GARDEN_CROPS.iter().any(|(id, _, _, _, _)| *id == crop)
}

fn unlock_of(crop: &str) -> i64 {
    GARDEN_CROPS
        .iter()
        .find(|(id, _, _, _, _)| *id == crop)
        .map(|(_, _, _, _, unlock)| *unlock)
        .unwrap_or(0)
}

impl Db {
    pub async fn ensure_garden(
        &self,
        owner_id: String,
        now: i64,
        initial_ripe: bool,
    ) -> Result<(), ApiError> {
        let mut tx = self.pool().begin().await?;
        sqlx::query("SELECT pg_advisory_xact_lock(hashtext($1))")
            .bind(format!("garden:{owner_id}"))
            .execute(&mut *tx)
            .await?;
        for (index, (crop, _name, duration, _yield, _unlock)) in
            GARDEN_CROPS.iter().take(3).enumerate()
        {
            let planted_at = if initial_ripe { now - duration } else { now };
            let ripe_at = if initial_ripe { now } else { now + duration };
            sqlx::query(
                "INSERT INTO garden_plots
                 (owner_id, plot, crop, planted_at, ripe_at, stolen, watered)
                 VALUES ($1, $2, $3, $4, $5, 0, 0)
                 ON CONFLICT (owner_id, plot) DO NOTHING",
            )
            .bind(&owner_id)
            .bind(index as i64)
            .bind(*crop)
            .bind(planted_at)
            .bind(ripe_at)
            .execute(&mut *tx)
            .await?;
        }
        let row = sqlx::query("SELECT garden_harvests FROM users WHERE id = $1")
            .bind(&owner_id)
            .fetch_optional(&mut *tx)
            .await?;
        let harvests: i64 = row.map(|row| row.get(0)).unwrap_or(0);
        for (threshold, plot) in [(20_i64, 3_i64), (45, 4)] {
            if harvests >= threshold {
                sqlx::query(
                    "INSERT INTO garden_plots
                     (owner_id, plot, crop, planted_at, ripe_at, stolen, watered)
                     VALUES ($1, $2, '', 0, 0, 0, 0)
                     ON CONFLICT (owner_id, plot) DO NOTHING",
                )
                .bind(&owner_id)
                .bind(plot)
                .execute(&mut *tx)
                .await?;
            }
        }
        tx.commit().await?;
        Ok(())
    }

    pub async fn garden(&self, owner_id: String, now: i64) -> Result<Vec<GardenPlot>, ApiError> {
        let rows = sqlx::query(
            "SELECT plot, crop, planted_at, ripe_at, stolen, watered
             FROM garden_plots WHERE owner_id = $1 ORDER BY plot",
        )
        .bind(owner_id)
        .fetch_all(self.pool())
        .await?;
        let mut plots = Vec::new();
        for row in rows {
            let crop: String = row.get(1);
            let ripe_at: i64 = row.get(3);
            let stolen: i64 = row.get(4);
            let empty = crop.is_empty();
            let mut plot = GardenPlot {
                plot: row.get(0),
                name: name_of(&crop).to_string(),
                empty,
                crop,
                planted_at: row.get(2),
                ripe_at,
                stolen,
                watered: row.get::<i64, _>(5) != 0,
                yield_amount: 0,
                ripe: !empty && now >= ripe_at,
            };
            plot.yield_amount = if plot.empty {
                0
            } else {
                (yield_of(&plot.crop) - plot.stolen).max(1)
            };
            plots.push(plot);
        }
        Ok(plots)
    }

    pub async fn plant_plot(
        &self,
        owner_id: String,
        plot: i64,
        crop: String,
        now: i64,
    ) -> Result<bool, ApiError> {
        if !is_crop(&crop) {
            return Ok(false);
        }
        let row = sqlx::query("SELECT garden_harvests FROM users WHERE id = $1")
            .bind(&owner_id)
            .fetch_optional(self.pool())
            .await?;
        let harvests: i64 = row.map(|row| row.get(0)).unwrap_or(0);
        if harvests < unlock_of(&crop) {
            return Ok(false);
        }
        let result = sqlx::query(
            "UPDATE garden_plots
             SET crop = $1, planted_at = $2, ripe_at = $3, stolen = 0, watered = 0
             WHERE owner_id = $4 AND plot = $5 AND crop = ''",
        )
        .bind(&crop)
        .bind(now)
        .bind(now + duration_of(&crop))
        .bind(owner_id)
        .bind(plot)
        .execute(self.pool())
        .await?;
        Ok(result.rows_affected() > 0)
    }

    pub async fn water_plot(
        &self,
        owner_id: String,
        plot: i64,
        now: i64,
    ) -> Result<bool, ApiError> {
        let mut tx = self.pool().begin().await?;
        let row = sqlx::query(
            "SELECT crop, ripe_at, watered FROM garden_plots
             WHERE owner_id = $1 AND plot = $2 FOR UPDATE",
        )
        .bind(&owner_id)
        .bind(plot)
        .fetch_optional(&mut *tx)
        .await?;
        let Some(row) = row else {
            tx.rollback().await?;
            return Ok(false);
        };
        let crop: String = row.get(0);
        let ripe_at: i64 = row.get(1);
        let watered: i64 = row.get(2);
        if crop.is_empty() || watered != 0 || ripe_at <= now {
            tx.rollback().await?;
            return Ok(false);
        }
        let boost = duration_of(&crop) / 4;
        let new_ripe = (ripe_at - boost).max(now + 60);
        sqlx::query(
            "UPDATE garden_plots SET ripe_at = $1, watered = 1
             WHERE owner_id = $2 AND plot = $3",
        )
        .bind(new_ripe)
        .bind(&owner_id)
        .bind(plot)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(true)
    }

    pub async fn harvest_plot(
        &self,
        owner_id: String,
        plot: i64,
        now: i64,
    ) -> Result<Option<GardenReward>, ApiError> {
        let mut tx = self.pool().begin().await?;
        let row = sqlx::query(
            "SELECT crop, ripe_at, stolen FROM garden_plots
             WHERE owner_id = $1 AND plot = $2 FOR UPDATE",
        )
        .bind(&owner_id)
        .bind(plot)
        .fetch_optional(&mut *tx)
        .await?;
        let Some(row) = row else {
            tx.rollback().await?;
            return Ok(None);
        };
        let crop: String = row.get(0);
        let ripe_at: i64 = row.get(1);
        let stolen: i64 = row.get(2);
        if crop.is_empty() || now < ripe_at {
            tx.rollback().await?;
            return Ok(None);
        }
        let amount = (yield_of(&crop) - stolen).max(1);
        sqlx::query(
            "UPDATE garden_plots
             SET crop = '', planted_at = 0, ripe_at = 0, stolen = 0, watered = 0
             WHERE owner_id = $1 AND plot = $2",
        )
        .bind(&owner_id)
        .bind(plot)
        .execute(&mut *tx)
        .await?;
        sqlx::query("UPDATE users SET garden_harvests = garden_harvests + 1 WHERE id = $1")
            .bind(&owner_id)
            .execute(&mut *tx)
            .await?;
        sqlx::query(
            "INSERT INTO garden_crop_stats (user_id, crop, harvests, stolen)
             VALUES ($1, $2, 1, 0)
             ON CONFLICT (user_id, crop) DO UPDATE SET harvests = garden_crop_stats.harvests + 1",
        )
        .bind(&owner_id)
        .bind(&crop)
        .execute(&mut *tx)
        .await?;
        sqlx::query(
            "INSERT INTO garden_actions (actor_id, owner_id, plot, action, crop, created_at)
             VALUES ($1, $1, $2, 'harvest', $3, $4)",
        )
        .bind(&owner_id)
        .bind(plot)
        .bind(&crop)
        .bind(now)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(Some(GardenReward {
            name: name_of(&crop).to_string(),
            crop,
            amount,
        }))
    }

    pub async fn ensure_garden_quest(
        &self,
        user_id: String,
        now: i64,
    ) -> Result<Option<GardenQuest>, ApiError> {
        let quest_user_id = user_id.clone();
        let mut tx = self.pool().begin().await?;
        sqlx::query("SELECT pg_advisory_xact_lock(hashtext($1))")
            .bind(format!("garden-quest:{user_id}"))
            .execute(&mut *tx)
            .await?;
        let day = now / 86_400;
        let exists = sqlx::query(
            "SELECT crop FROM garden_quests WHERE user_id = $1 AND day = $2",
        )
        .bind(&user_id)
        .bind(day)
        .fetch_optional(&mut *tx)
        .await?;
        if exists.is_none() {
            let user_exists = sqlx::query("SELECT 1 FROM users WHERE id = $1")
                .bind(&user_id)
                .fetch_optional(&mut *tx)
                .await?
                .is_some();
            if !user_exists {
                tx.commit().await?;
                return Ok(None);
            }
            let hash = user_id.bytes().fold(day as u64, |value, byte| {
                value.wrapping_mul(31).wrapping_add(byte as u64)
            });
            let crops = ["letter", "stamp", "inkberry"];
            let crop = crops[(hash as usize) % crops.len()];
            let (reward_kind, reward_amount) = match crop {
                "letter" => ("ink", 3),
                "stamp" => ("stamps", 800),
                _ => ("paper", 3),
            };
            sqlx::query(
                "INSERT INTO garden_quests
                 (user_id, day, crop, reward_kind, reward_amount, claimed_at)
                 VALUES ($1, $2, $3, $4, $5, NULL)
                 ON CONFLICT (user_id, day) DO NOTHING",
            )
            .bind(&user_id)
            .bind(day)
            .bind(crop)
            .bind(reward_kind)
            .bind(reward_amount)
            .execute(&mut *tx)
            .await?;
        }
        tx.commit().await?;
        self.garden_quest(quest_user_id, now).await
    }

    pub async fn garden_quest(
        &self,
        user_id: String,
        now: i64,
    ) -> Result<Option<GardenQuest>, ApiError> {
        let day = now / 86_400;
        let row = sqlx::query(
            "SELECT crop, reward_kind, reward_amount, claimed_at
             FROM garden_quests WHERE user_id = $1 AND day = $2",
        )
        .bind(&user_id)
        .bind(day)
        .fetch_optional(self.pool())
        .await?;
        let Some(row) = row else {
            return Ok(None);
        };
        let crop: String = row.get(0);
        let reward_kind: String = row.get(1);
        let reward_amount: i64 = row.get(2);
        let claimed_at: Option<i64> = row.get(3);
        let progress_row = sqlx::query(
            "SELECT COUNT(*) FROM garden_actions
             WHERE actor_id = $1 AND action = 'harvest' AND crop = $2 AND created_at >= $3",
        )
        .bind(&user_id)
        .bind(&crop)
        .bind(day * 86_400)
        .fetch_one(self.pool())
        .await?;
        let progress: i64 = progress_row.get(0);
        Ok(Some(GardenQuest {
            name: name_of(&crop).to_string(),
            crop,
            amount: 1,
            progress,
            reward_kind,
            reward_amount,
            claimed: claimed_at.is_some(),
        }))
    }

    pub async fn claim_garden_quest(
        &self,
        user_id: String,
        now: i64,
    ) -> Result<Option<QuestReward>, ApiError> {
        let mut tx = self.pool().begin().await?;
        sqlx::query("SELECT pg_advisory_xact_lock(hashtext($1))")
            .bind(format!("garden-quest:{user_id}"))
            .execute(&mut *tx)
            .await?;
        let day = now / 86_400;
        let row = sqlx::query(
            "SELECT crop, reward_kind, reward_amount, claimed_at
             FROM garden_quests WHERE user_id = $1 AND day = $2 FOR UPDATE",
        )
        .bind(&user_id)
        .bind(day)
        .fetch_optional(&mut *tx)
        .await?;
        let Some(row) = row else {
            tx.rollback().await?;
            return Ok(None);
        };
        let crop: String = row.get(0);
        let reward_kind: String = row.get(1);
        let reward_amount: i64 = row.get(2);
        let claimed_at: Option<i64> = row.get(3);
        if claimed_at.is_some() {
            tx.rollback().await?;
            return Ok(None);
        }
        let progress_row = sqlx::query(
            "SELECT COUNT(*) FROM garden_actions
             WHERE actor_id = $1 AND action = 'harvest' AND crop = $2 AND created_at >= $3",
        )
        .bind(&user_id)
        .bind(&crop)
        .bind(day * 86_400)
        .fetch_one(&mut *tx)
        .await?;
        if progress_row.get::<i64, _>(0) < 1 {
            tx.rollback().await?;
            return Ok(None);
        }
        sqlx::query(
            "UPDATE garden_quests SET claimed_at = $1 WHERE user_id = $2 AND day = $3",
        )
        .bind(now)
        .bind(&user_id)
        .bind(day)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(Some(QuestReward {
            kind: reward_kind,
            amount: reward_amount,
        }))
    }

    pub async fn crop_stats(&self, user_id: String) -> Result<Vec<CropStat>, ApiError> {
        let rows = sqlx::query(
            "SELECT crop, harvests, stolen FROM garden_crop_stats WHERE user_id = $1",
        )
        .bind(user_id)
        .fetch_all(self.pool())
        .await?;
        let mut stats = std::collections::HashMap::new();
        for row in rows {
            stats.insert(row.get::<String, _>(0), (row.get::<i64, _>(1), row.get::<i64, _>(2)));
        }
        Ok(GARDEN_CROPS
            .iter()
            .map(|(crop, name, _, _, _)| {
                let (harvests, stolen) = stats.get(*crop).copied().unwrap_or((0, 0));
                CropStat {
                    crop: (*crop).to_string(),
                    name: (*name).to_string(),
                    harvests,
                    stolen,
                }
            })
            .collect())
    }

    pub async fn garden_visitors(&self, owner_id: String) -> Result<Vec<GardenVisitor>, ApiError> {
        let rows = sqlx::query(
            "SELECT COALESCE(u.username, '一位邮差'), a.action, a.crop, a.created_at
             FROM garden_actions a
             LEFT JOIN users u ON u.id = a.actor_id
             WHERE a.owner_id = $1 AND a.action IN ('steal', 'help')
             ORDER BY a.id DESC
             LIMIT 8",
        )
        .bind(owner_id)
        .fetch_all(self.pool())
        .await?;
        Ok(rows
            .into_iter()
            .map(|row| {
                let crop: String = row.get(2);
                GardenVisitor {
                    actor_name: row.get(0),
                    action: row.get(1),
                    name: name_of(&crop).to_string(),
                    crop,
                    created_at: row.get(3),
                }
            })
            .collect())
    }

    pub async fn garden_harvests(&self, user_id: String) -> Result<i64, ApiError> {
        let row = sqlx::query("SELECT garden_harvests FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_optional(self.pool())
            .await?;
        Ok(row.map(|row| row.get(0)).unwrap_or(0))
    }

    pub async fn water_friend_plot(
        &self,
        helper_id: String,
        owner_id: String,
        plot: i64,
        now: i64,
    ) -> Result<bool, ApiError> {
        let mut tx = self.pool().begin().await?;
        let row = sqlx::query(
            "SELECT crop, ripe_at, watered FROM garden_plots
             WHERE owner_id = $1 AND plot = $2 FOR UPDATE",
        )
        .bind(&owner_id)
        .bind(plot)
        .fetch_optional(&mut *tx)
        .await?;
        let Some(row) = row else {
            tx.rollback().await?;
            return Ok(false);
        };
        let crop: String = row.get(0);
        let ripe_at: i64 = row.get(1);
        let watered: i64 = row.get(2);
        if crop.is_empty() || watered != 0 || ripe_at <= now {
            tx.rollback().await?;
            return Ok(false);
        }
        let inserted = sqlx::query(
            "INSERT INTO garden_helps (helper_id, owner_id, plot, day, created_at)
             VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING",
        )
        .bind(&helper_id)
        .bind(&owner_id)
        .bind(plot)
        .bind(now / 86_400)
        .bind(now)
        .execute(&mut *tx)
        .await?;
        if inserted.rows_affected() == 0 {
            tx.rollback().await?;
            return Ok(false);
        }
        let boost = duration_of(&crop) / 4;
        let new_ripe = (ripe_at - boost).max(now + 60);
        sqlx::query(
            "UPDATE garden_plots SET ripe_at = $1, watered = 1
             WHERE owner_id = $2 AND plot = $3",
        )
        .bind(new_ripe)
        .bind(&owner_id)
        .bind(plot)
        .execute(&mut *tx)
        .await?;
        sqlx::query(
            "INSERT INTO garden_actions (actor_id, owner_id, plot, action, crop, created_at)
             VALUES ($1, $2, $3, 'help', $4, $5)",
        )
        .bind(&helper_id)
        .bind(&owner_id)
        .bind(plot)
        .bind(&crop)
        .bind(now)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(true)
    }

    /// Steals one unit. `reset_on_full` makes bot gardens regrow after two steals.
    pub async fn steal_plot(
        &self,
        thief_id: String,
        owner_id: String,
        plot: i64,
        now: i64,
        reset_on_full: bool,
    ) -> Result<Option<GardenReward>, ApiError> {
        let mut tx = self.pool().begin().await?;
        let row = sqlx::query(
            "SELECT crop, ripe_at, stolen FROM garden_plots
             WHERE owner_id = $1 AND plot = $2 FOR UPDATE",
        )
        .bind(&owner_id)
        .bind(plot)
        .fetch_optional(&mut *tx)
        .await?;
        let Some(row) = row else {
            tx.rollback().await?;
            return Ok(None);
        };
        let crop: String = row.get(0);
        let ripe_at: i64 = row.get(1);
        let stolen: i64 = row.get(2);
        if crop.is_empty() || now < ripe_at || stolen >= 2 {
            tx.rollback().await?;
            return Ok(None);
        }
        let inserted = sqlx::query(
            "INSERT INTO garden_steals (thief_id, owner_id, plot, day, created_at)
             VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING",
        )
        .bind(&thief_id)
        .bind(&owner_id)
        .bind(plot)
        .bind(now / 86_400)
        .bind(now)
        .execute(&mut *tx)
        .await?;
        if inserted.rows_affected() == 0 {
            tx.rollback().await?;
            return Ok(None);
        }
        let next_stolen = stolen + 1;
        if reset_on_full && next_stolen >= 2 {
            sqlx::query(
                "UPDATE garden_plots
                 SET planted_at = $1, ripe_at = $2, stolen = 0, watered = 0
                 WHERE owner_id = $3 AND plot = $4",
            )
            .bind(now)
            .bind(now + duration_of(&crop))
            .bind(&owner_id)
            .bind(plot)
            .execute(&mut *tx)
            .await?;
        } else {
            sqlx::query(
                "UPDATE garden_plots SET stolen = $1
                 WHERE owner_id = $2 AND plot = $3",
            )
            .bind(next_stolen)
            .bind(&owner_id)
            .bind(plot)
            .execute(&mut *tx)
            .await?;
        }
        sqlx::query(
            "INSERT INTO garden_crop_stats (user_id, crop, harvests, stolen)
             VALUES ($1, $2, 0, 1)
             ON CONFLICT (user_id, crop) DO UPDATE SET stolen = garden_crop_stats.stolen + 1",
        )
        .bind(&owner_id)
        .bind(&crop)
        .execute(&mut *tx)
        .await?;
        sqlx::query(
            "INSERT INTO garden_actions (actor_id, owner_id, plot, action, crop, created_at)
             VALUES ($1, $2, $3, 'steal', $4, $5)",
        )
        .bind(&thief_id)
        .bind(&owner_id)
        .bind(plot)
        .bind(&crop)
        .bind(now)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(Some(GardenReward {
            name: name_of(&crop).to_string(),
            crop,
            amount: 1,
        }))
    }
}
