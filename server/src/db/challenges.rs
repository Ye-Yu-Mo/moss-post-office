use rusqlite::params;

use crate::{db::Db, error::ApiError};

impl Db {
    pub async fn create_challenge(
        &self,
        nonce: String,
        now: i64,
        expires_at: i64,
    ) -> Result<(), ApiError> {
        self.call(move |conn| {
            conn.execute("DELETE FROM login_challenges WHERE expires_at <= ?1", [now])?;
            conn.execute(
                "INSERT INTO login_challenges (nonce, created_at, expires_at)
                 VALUES (?1, ?2, ?3)",
                params![nonce, now, expires_at],
            )?;
            Ok(())
        })
        .await
    }

    /// One-time consume. Returns false for unknown, expired, or already-used nonces.
    pub async fn consume_challenge(&self, nonce: String, now: i64) -> Result<bool, ApiError> {
        self.call(move |conn| {
            let removed = conn.execute(
                "DELETE FROM login_challenges WHERE nonce = ?1 AND expires_at > ?2",
                params![nonce, now],
            )?;
            Ok(removed > 0)
        })
        .await
    }
}
