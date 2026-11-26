use rusqlite::{params, OptionalExtension, TransactionBehavior};
use serde::Serialize;

use crate::{db::Db, error::ApiError};

pub const GARDEN_CROPS: [(&str, &str, i64, i64); 3] = [
    ("letter", "信封草", 45 * 60, 3),
    ("stamp", "邮票花", 60 * 60, 3),
    ("inkberry", "墨莓", 75 * 60, 3),
];

#[derive(Debug, Clone, Serialize)]
pub struct GardenPlot {
    pub plot: i64,
    pub crop: String,
    pub name: String,
    pub planted_at: i64,
    pub ripe_at: i64,
    pub stolen: i64,
    pub yield_amount: i64,
    pub ripe: bool,
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
        .find(|(id, _, _, _)| *id == crop)
        .map(|(_, name, _, _)| *name)
        .unwrap_or("作物")
}

fn duration_of(crop: &str) -> i64 {
    GARDEN_CROPS
        .iter()
        .find(|(id, _, _, _)| *id == crop)
        .map(|(_, _, duration, _)| *duration)
        .unwrap_or(3600)
}

fn yield_of(crop: &str) -> i64 {
    GARDEN_CROPS
        .iter()
        .find(|(id, _, _, _)| *id == crop)
        .map(|(_, _, _, yield_amount)| *yield_amount)
        .unwrap_or(3)
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
            for (index, (crop, _name, duration, _yield)) in GARDEN_CROPS.iter().enumerate() {
                let planted_at = if initial_ripe { now - duration } else { now };
                let ripe_at = if initial_ripe { now } else { now + duration };
                tx.execute(
                    "INSERT OR IGNORE INTO garden_plots
                     (owner_id, plot, crop, planted_at, ripe_at, stolen)
                     VALUES (?1, ?2, ?3, ?4, ?5, 0)",
                    params![owner_id, index as i64, crop, planted_at, ripe_at],
                )?;
            }
            tx.commit()?;
            Ok(())
        })
        .await
    }

    pub async fn garden(&self, owner_id: String, now: i64) -> Result<Vec<GardenPlot>, ApiError> {
        self.call(move |conn| {
            let mut statement = conn.prepare(
                "SELECT plot, crop, planted_at, ripe_at, stolen
                 FROM garden_plots WHERE owner_id = ?1 ORDER BY plot",
            )?;
            let rows = statement.query_map([owner_id], |row| {
                let crop: String = row.get(1)?;
                let ripe_at: i64 = row.get(3)?;
                let stolen: i64 = row.get(4)?;
                Ok(GardenPlot {
                    plot: row.get(0)?,
                    name: name_of(&crop).to_string(),
                    crop,
                    planted_at: row.get(2)?,
                    ripe_at,
                    stolen,
                    yield_amount: 0,
                    ripe: now >= ripe_at,
                })
            })?;
            let mut plots = Vec::new();
            for row in rows {
                let mut plot = row?;
                plot.yield_amount = (yield_of(&plot.crop) - plot.stolen).max(1);
                plots.push(plot);
            }
            Ok(plots)
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
            if now < ripe_at {
                return Ok(None);
            }
            let amount = (yield_of(&crop) - stolen).max(1);
            tx.execute(
                "UPDATE garden_plots
                 SET planted_at = ?1, ripe_at = ?2, stolen = 0
                 WHERE owner_id = ?3 AND plot = ?4",
                params![now, now + duration_of(&crop), owner_id, plot],
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
            if now < ripe_at || stolen >= 2 {
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
                     SET planted_at = ?1, ripe_at = ?2, stolen = 0
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
