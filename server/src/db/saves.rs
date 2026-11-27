use sqlx::Row;

use crate::{db::Db, error::ApiError};

#[derive(Debug, Clone)]
pub struct StoredSave {
    pub revision: u64,
    pub payload: String,
    pub updated_at: i64,
}

impl Db {
    pub async fn get_save(&self, user_id: String) -> Result<Option<StoredSave>, ApiError> {
        let row = sqlx::query(
            "SELECT revision, payload, updated_at FROM saves WHERE user_id = $1",
        )
        .bind(user_id)
        .fetch_optional(self.pool())
        .await?;
        Ok(row.map(|row| StoredSave {
            revision: row.get::<i64, _>(0).max(0) as u64,
            payload: row.get(1),
            updated_at: row.get(2),
        }))
    }

    pub async fn save_revision(&self, user_id: String) -> Result<u64, ApiError> {
        let row = sqlx::query("SELECT revision FROM saves WHERE user_id = $1")
            .bind(user_id)
            .fetch_optional(self.pool())
            .await?;
        Ok(row
            .map(|row| row.get::<i64, _>(0).max(0) as u64)
            .unwrap_or(0))
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
        let mut tx = self.pool().begin().await?;
        // Serialize writers per user without a single global lock.
        sqlx::query("SELECT pg_advisory_xact_lock(hashtext($1))")
            .bind(&user_id)
            .execute(&mut *tx)
            .await?;
        let row = sqlx::query("SELECT revision FROM saves WHERE user_id = $1")
            .bind(&user_id)
            .fetch_optional(&mut *tx)
            .await?;
        let current = row
            .map(|row| row.get::<i64, _>(0).max(0) as u64)
            .unwrap_or(0);
        if current != base_revision {
            tx.rollback().await?;
            return Ok(Err(current));
        }
        let next = current + 1;
        sqlx::query(
            "INSERT INTO saves (user_id, revision, payload, client_ts, updated_at)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (user_id) DO UPDATE SET
                 revision = EXCLUDED.revision,
                 payload = EXCLUDED.payload,
                 client_ts = EXCLUDED.client_ts,
                 updated_at = EXCLUDED.updated_at",
        )
        .bind(&user_id)
        .bind(next as i64)
        .bind(payload)
        .bind(client_ts)
        .bind(updated_at)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(Ok(next))
    }
}
