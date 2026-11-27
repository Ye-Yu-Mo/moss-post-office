use rusqlite::{params, OptionalExtension, TransactionBehavior};
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
        self.call(move |conn| {
            let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
            for (index, (crop, _name, duration, _yield, _unlock)) in
                GARDEN_CROPS.iter().take(3).enumerate()
            {
                let planted_at = if initial_ripe { now - duration } else { now };
                let ripe_at = if initial_ripe { now } else { now + duration };
                tx.execute(
                    "INSERT OR IGNORE INTO garden_plots
                     (owner_id, plot, crop, planted_at, ripe_at, stolen, watered)
                     VALUES (?1, ?2, ?3, ?4, ?5, 0, 0)",
                    params![owner_id, index as i64, crop, planted_at, ripe_at],
                )?;
            }
            let harvests: i64 = tx
                .query_row(
                    "SELECT garden_harvests FROM users WHERE id = ?1",
                    [&owner_id],
                    |row| row.get(0),
                )
                .optional()?
                .unwrap_or(0);
            for (threshold, plot) in [(20_i64, 3_i64), (45, 4)] {
                if harvests >= threshold {
                    tx.execute(
                        "INSERT OR IGNORE INTO garden_plots
                         (owner_id, plot, crop, planted_at, ripe_at, stolen, watered)
                         VALUES (?1, ?2, '', 0, 0, 0, 0)",
                        params![owner_id, plot],
                    )?;
                }
            }
            tx.commit()?;
            Ok(())
        })
        .await
    }

    pub async fn garden(&self, owner_id: String, now: i64) -> Result<Vec<GardenPlot>, ApiError> {
        self.call(move |conn| {
            let mut statement = conn.prepare(
                "SELECT plot, crop, planted_at, ripe_at, stolen, watered
                 FROM garden_plots WHERE owner_id = ?1 ORDER BY plot",
            )?;
            let rows = statement.query_map([owner_id], |row| {
                let crop: String = row.get(1)?;
                let ripe_at: i64 = row.get(3)?;
                let stolen: i64 = row.get(4)?;
                let empty = crop.is_empty();
                Ok(GardenPlot {
                    plot: row.get(0)?,
                    name: name_of(&crop).to_string(),
                    empty,
                    crop,
                    planted_at: row.get(2)?,
                    ripe_at,
                    stolen,
                    watered: row.get::<_, i64>(5)? != 0,
                    yield_amount: 0,
                    ripe: !empty && now >= ripe_at,
                })
            })?;
            let mut plots = Vec::new();
            for row in rows {
                let mut plot = row?;
                plot.yield_amount = if plot.empty {
                    0
                } else {
                    (yield_of(&plot.crop) - plot.stolen).max(1)
                };
                plots.push(plot);
            }
            Ok(plots)
        })
        .await
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
        self.call(move |conn| {
            let harvests: i64 = conn
                .query_row(
                    "SELECT garden_harvests FROM users WHERE id = ?1",
                    [&owner_id],
                    |row| row.get(0),
                )
                .optional()?
                .unwrap_or(0);
            if harvests < unlock_of(&crop) {
                return Ok(false);
            }
            let updated = conn.execute(
                "UPDATE garden_plots
                 SET crop = ?1, planted_at = ?2, ripe_at = ?3, stolen = 0, watered = 0
                 WHERE owner_id = ?4 AND plot = ?5 AND crop = ''",
                params![crop, now, now + duration_of(&crop), owner_id, plot],
            )?;
            Ok(updated > 0)
        })
        .await
    }

    pub async fn water_plot(
        &self,
        owner_id: String,
        plot: i64,
        now: i64,
    ) -> Result<bool, ApiError> {
        self.call(move |conn| {
            let row: Option<(String, i64, i64, i64)> = conn
                .query_row(
                    "SELECT crop, ripe_at, watered, stolen FROM garden_plots
                     WHERE owner_id = ?1 AND plot = ?2",
                    params![owner_id, plot],
                    |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
                )
                .optional()?;
            let Some((crop, ripe_at, watered, _stolen)) = row else {
                return Ok(false);
            };
            if crop.is_empty() || watered != 0 || ripe_at <= now {
                return Ok(false);
            }
            let boost = duration_of(&crop) / 4;
            let new_ripe = (ripe_at - boost).max(now + 60);
            let updated = conn.execute(
                "UPDATE garden_plots SET ripe_at = ?1, watered = 1
                 WHERE owner_id = ?2 AND plot = ?3",
                params![new_ripe, owner_id, plot],
            )?;
            Ok(updated > 0)
        })
        .await
    }

    pub async fn harvest_plot(
        &self,
        owner_id: String,
        plot: i64,
        now: i64,
    ) -> Result<Option<GardenReward>, ApiError> {
        self.call(move |conn| {
            let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
            let row: Option<(String, i64, i64)> = tx
                .query_row(
                    "SELECT crop, ripe_at, stolen FROM garden_plots
                     WHERE owner_id = ?1 AND plot = ?2",
                    params![owner_id, plot],
                    |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
                )
                .optional()?;
            let Some((crop, ripe_at, stolen)) = row else {
                return Ok(None);
            };
            if crop.is_empty() || now < ripe_at {
                return Ok(None);
            }
            let amount = (yield_of(&crop) - stolen).max(1);
            tx.execute(
                "UPDATE garden_plots
                 SET crop = '', planted_at = 0, ripe_at = 0, stolen = 0, watered = 0
                 WHERE owner_id = ?1 AND plot = ?2",
                params![owner_id, plot],
            )?;
            tx.execute(
                "UPDATE users SET garden_harvests = garden_harvests + 1 WHERE id = ?1",
                [&owner_id],
            )?;
            tx.execute(
                "INSERT INTO garden_crop_stats (user_id, crop, harvests, stolen)
                 VALUES (?1, ?2, 1, 0)
                 ON CONFLICT(user_id, crop) DO UPDATE SET harvests = harvests + 1",
                params![owner_id, crop],
            )?;
            tx.execute(
                "INSERT INTO garden_actions (actor_id, owner_id, plot, action, crop, created_at)
                 VALUES (?1, ?1, ?2, 'harvest', ?3, ?4)",
                params![owner_id, plot, crop, now],
            )?;
            tx.commit()?;
            Ok(Some(GardenReward {
                name: name_of(&crop).to_string(),
                crop,
                amount,
            }))
        })
        .await
    }

    pub async fn ensure_garden_quest(
        &self,
        user_id: String,
        now: i64,
    ) -> Result<Option<GardenQuest>, ApiError> {
        let quest_user_id = user_id.clone();
        self.call(move |conn| {
            let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
            let day = now / 86_400;
            let exists: Option<(String, String, i64, Option<i64>)> = tx
                .query_row(
                    "SELECT crop, reward_kind, reward_amount, claimed_at
                     FROM garden_quests WHERE user_id = ?1 AND day = ?2",
                    params![user_id, day],
                    |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
                )
                .optional()?;
            if exists.is_none() {
                let user_exists = tx
                    .query_row("SELECT 1 FROM users WHERE id = ?1", [&user_id], |_| Ok(()))
                    .optional()?
                    .is_some();
                if !user_exists {
                    return Ok(());
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
                tx.execute(
                    "INSERT OR IGNORE INTO garden_quests
                     (user_id, day, crop, reward_kind, reward_amount, claimed_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, NULL)",
                    params![user_id, day, crop, reward_kind, reward_amount],
                )?;
            }
            tx.commit()?;
            Ok(())
        })
        .await?;
        self.garden_quest(quest_user_id, now).await
    }

    pub async fn garden_quest(
        &self,
        user_id: String,
        now: i64,
    ) -> Result<Option<GardenQuest>, ApiError> {
        self.call(move |conn| {
            let day = now / 86_400;
            let row: Option<(String, String, i64, Option<i64>)> = conn
                .query_row(
                    "SELECT crop, reward_kind, reward_amount, claimed_at
                     FROM garden_quests WHERE user_id = ?1 AND day = ?2",
                    params![user_id, day],
                    |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
                )
                .optional()?;
            let Some((crop, reward_kind, reward_amount, claimed_at)) = row else {
                return Ok(None);
            };
            let progress: i64 = conn.query_row(
                "SELECT COUNT(*) FROM garden_actions
                 WHERE actor_id = ?1 AND action = 'harvest' AND crop = ?2 AND created_at >= ?3",
                params![user_id, crop, day * 86_400],
                |row| row.get(0),
            )?;
            Ok(Some(GardenQuest {
                name: name_of(&crop).to_string(),
                crop,
                amount: 1,
                progress,
                reward_kind,
                reward_amount,
                claimed: claimed_at.is_some(),
            }))
        })
        .await
    }

    pub async fn claim_garden_quest(
        &self,
        user_id: String,
        now: i64,
    ) -> Result<Option<QuestReward>, ApiError> {
        self.call(move |conn| {
            let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
            let day = now / 86_400;
            let row: Option<(String, String, i64, Option<i64>)> = tx
                .query_row(
                    "SELECT crop, reward_kind, reward_amount, claimed_at
                     FROM garden_quests WHERE user_id = ?1 AND day = ?2",
                    params![user_id, day],
                    |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
                )
                .optional()?;
            let Some((crop, reward_kind, reward_amount, claimed_at)) = row else {
                return Ok(None);
            };
            if claimed_at.is_some() {
                return Ok(None);
            }
            let progress: i64 = tx.query_row(
                "SELECT COUNT(*) FROM garden_actions
                 WHERE actor_id = ?1 AND action = 'harvest' AND crop = ?2 AND created_at >= ?3",
                params![user_id, crop, day * 86_400],
                |row| row.get(0),
            )?;
            if progress < 1 {
                return Ok(None);
            }
            tx.execute(
                "UPDATE garden_quests SET claimed_at = ?1 WHERE user_id = ?2 AND day = ?3",
                params![now, user_id, day],
            )?;
            tx.commit()?;
            Ok(Some(QuestReward {
                kind: reward_kind,
                amount: reward_amount,
            }))
        })
        .await
    }

    pub async fn crop_stats(&self, user_id: String) -> Result<Vec<CropStat>, ApiError> {
        self.call(move |conn| {
            let mut stats = std::collections::HashMap::new();
            let mut statement = conn.prepare(
                "SELECT crop, harvests, stolen FROM garden_crop_stats WHERE user_id = ?1",
            )?;
            let rows = statement.query_map([user_id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, i64>(2)?,
                ))
            })?;
            for row in rows {
                let (crop, harvests, stolen) = row?;
                stats.insert(crop, (harvests, stolen));
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
        })
        .await
    }

    pub async fn garden_visitors(&self, owner_id: String) -> Result<Vec<GardenVisitor>, ApiError> {
        self.call(move |conn| {
            let mut statement = conn.prepare(
                "SELECT COALESCE(u.username, '一位邮差'), a.action, a.crop, a.created_at
                 FROM garden_actions a
                 LEFT JOIN users u ON u.id = a.actor_id
                 WHERE a.owner_id = ?1 AND a.action IN ('steal', 'help')
                 ORDER BY a.id DESC
                 LIMIT 8",
            )?;
            let rows = statement.query_map([owner_id], |row| {
                let crop: String = row.get(2)?;
                Ok(GardenVisitor {
                    actor_name: row.get(0)?,
                    action: row.get(1)?,
                    name: name_of(&crop).to_string(),
                    crop,
                    created_at: row.get(3)?,
                })
            })?;
            let mut visitors = Vec::new();
            for row in rows {
                visitors.push(row?);
            }
            Ok(visitors)
        })
        .await
    }

    pub async fn garden_harvests(&self, user_id: String) -> Result<i64, ApiError> {
        self.call(move |conn| {
            let count: i64 = conn
                .query_row(
                    "SELECT garden_harvests FROM users WHERE id = ?1",
                    [user_id],
                    |row| row.get(0),
                )
                .optional()?
                .unwrap_or(0);
            Ok(count)
        })
        .await
    }

    pub async fn water_friend_plot(
        &self,
        helper_id: String,
        owner_id: String,
        plot: i64,
        now: i64,
    ) -> Result<bool, ApiError> {
        self.call(move |conn| {
            let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
            let row: Option<(String, i64, i64)> = tx
                .query_row(
                    "SELECT crop, ripe_at, watered FROM garden_plots
                     WHERE owner_id = ?1 AND plot = ?2",
                    params![owner_id, plot],
                    |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
                )
                .optional()?;
            let Some((crop, ripe_at, watered)) = row else {
                return Ok(false);
            };
            if crop.is_empty() || watered != 0 || ripe_at <= now {
                return Ok(false);
            }
            let inserted = tx.execute(
                "INSERT OR IGNORE INTO garden_helps
                 (helper_id, owner_id, plot, day, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![helper_id, owner_id, plot, now / 86_400, now],
            )?;
            if inserted == 0 {
                return Ok(false);
            }
            let boost = duration_of(&crop) / 4;
            let new_ripe = (ripe_at - boost).max(now + 60);
            tx.execute(
                "UPDATE garden_plots SET ripe_at = ?1, watered = 1
                 WHERE owner_id = ?2 AND plot = ?3",
                params![new_ripe, owner_id, plot],
            )?;
            tx.execute(
                "INSERT INTO garden_actions (actor_id, owner_id, plot, action, crop, created_at)
                 VALUES (?1, ?2, ?3, 'help', ?4, ?5)",
                params![helper_id, owner_id, plot, crop, now],
            )?;
            tx.commit()?;
            Ok(true)
        })
        .await
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
        self.call(move |conn| {
            let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
            let row: Option<(String, i64, i64)> = tx
                .query_row(
                    "SELECT crop, ripe_at, stolen FROM garden_plots
                     WHERE owner_id = ?1 AND plot = ?2",
                    params![owner_id, plot],
                    |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
                )
                .optional()?;
            let Some((crop, ripe_at, stolen)) = row else {
                return Ok(None);
            };
            if crop.is_empty() || now < ripe_at || stolen >= 2 {
                return Ok(None);
            }
            let inserted = tx.execute(
                "INSERT OR IGNORE INTO garden_steals
                 (thief_id, owner_id, plot, day, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![thief_id, owner_id, plot, now / 86_400, now],
            )?;
            if inserted == 0 {
                return Ok(None);
            }
            let next_stolen = stolen + 1;
            if reset_on_full && next_stolen >= 2 {
                tx.execute(
                    "UPDATE garden_plots
                     SET planted_at = ?1, ripe_at = ?2, stolen = 0, watered = 0
                     WHERE owner_id = ?3 AND plot = ?4",
                    params![now, now + duration_of(&crop), owner_id, plot],
                )?;
            } else {
                tx.execute(
                    "UPDATE garden_plots SET stolen = ?1
                     WHERE owner_id = ?2 AND plot = ?3",
                    params![next_stolen, owner_id, plot],
                )?;
            }
            tx.execute(
                "INSERT INTO garden_crop_stats (user_id, crop, harvests, stolen)
                 VALUES (?1, ?2, 0, 1)
                 ON CONFLICT(user_id, crop) DO UPDATE SET stolen = stolen + 1",
                params![owner_id, crop],
            )?;
            tx.execute(
                "INSERT INTO garden_actions (actor_id, owner_id, plot, action, crop, created_at)
                 VALUES (?1, ?2, ?3, 'steal', ?4, ?5)",
                params![thief_id, owner_id, plot, crop, now],
            )?;
            tx.commit()?;
            Ok(Some(GardenReward {
                name: name_of(&crop).to_string(),
                crop,
                amount: 1,
            }))
        })
        .await
    }
}
