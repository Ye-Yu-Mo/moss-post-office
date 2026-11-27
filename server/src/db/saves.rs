use rusqlite::{TransactionBehavior, params, OptionalExtension};

use crate::{db::Db, error::ApiError};

#[derive(Debug, Clone)]
pub struct StoredSave {
    pub revision: u64,
    pub payload: String,
    pub updated_at: i64,
}

impl Db {
    pub async fn get_save(&self, user_id: String) -> Result<Option<StoredSave>, ApiError> {
        self.call(move |conn| {
            conn.query_row(
                "SELECT revision, payload, updated_at FROM saves WHERE user_id = ?1",
                [user_id],
                |row| {
                    Ok(StoredSave {
                        revision: row.get::<_, i64>(0)?.max(0) as u64,
                        payload: row.get(1)?,
                        updated_at: row.get(2)?,
                    })
                },
            )
            .optional()
        })
        .await
    }

    pub async fn save_revision(&self, user_id: String) -> Result<u64, ApiError> {
        self.call(move |conn| {
            let revision: Option<i64> = conn
                .query_row(
                    "SELECT revision FROM saves WHERE user_id = ?1",
                    [user_id],
                    |row| row.get(0),
                )
                .optional()?;
            Ok(revision.unwrap_or(0).max(0) as u64)
        })
        .await
    }

    /// Returns `Ok(new_revision)` or `Err(current_revision)` on a conflict.
    pub async fn put_save(
        &self,
        user_id: String,
        base_revision: u64,
        payload: String,
        client_ts: i64,
        updated_at: i64,
    ) -> Result<Result<u64, u64>, ApiError> {
        self.call(move |conn| -> rusqlite::Result<Result<u64, u64>> {
            let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
            let current: Option<i64> = tx
                .query_row(
                    "SELECT revision FROM saves WHERE user_id = ?1",
                    [&user_id],
                    |row| row.get(0),
                )
                .optional()?;
            let current = current.unwrap_or(0).max(0) as u64;
            if current != base_revision {
                return Ok(Err(current));
            }
            let next = current + 1;
            tx.execute(
                "INSERT INTO saves (user_id, revision, payload, client_ts, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT(user_id) DO UPDATE SET
                     revision = excluded.revision,
                     payload = excluded.payload,
                     client_ts = excluded.client_ts,
                     updated_at = excluded.updated_at",
                params![user_id, next as i64, payload, client_ts, updated_at],
            )?;
            tx.commit()?;
            Ok(Ok(next))
        })
        .await
    }
}
