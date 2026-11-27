use crate::{db::Db, error::ApiError};

impl Db {
    pub async fn create_challenge(
        &self,
        nonce: String,
        now: i64,
        expires_at: i64,
    ) -> Result<(), ApiError> {
        let mut tx = self.pool().begin().await?;
        sqlx::query("DELETE FROM login_challenges WHERE expires_at <= $1")
            .bind(now)
            .execute(&mut *tx)
            .await?;
        sqlx::query(
            "INSERT INTO login_challenges (nonce, created_at, expires_at)
             VALUES ($1, $2, $3)",
        )
        .bind(nonce)
        .bind(now)
        .bind(expires_at)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(())
    }

    /// One-time consume. Returns false for unknown, expired, or already-used nonces.
    pub async fn consume_challenge(&self, nonce: String, now: i64) -> Result<bool, ApiError> {
        let result = sqlx::query(
            "DELETE FROM login_challenges WHERE nonce = $1 AND expires_at > $2",
        )
        .bind(nonce)
        .bind(now)
        .execute(self.pool())
        .await?;
        Ok(result.rows_affected() > 0)
    }
}
