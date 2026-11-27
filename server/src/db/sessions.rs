use sqlx::Row;

use crate::{db::Db, error::ApiError};

#[derive(Debug, Clone)]
pub struct SessionUser {
    pub id: String,
    pub username: String,
}

impl Db {
    pub async fn create_session(
        &self,
        token_hash: String,
        user_id: String,
        now: i64,
        expires_at: i64,
    ) -> Result<(), ApiError> {
        sqlx::query("DELETE FROM sessions WHERE expires_at <= $1")
            .bind(now)
            .execute(self.pool())
            .await?;
        sqlx::query(
            "INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_seen)
             VALUES ($1, $2, $3, $4, $3)",
        )
        .bind(token_hash)
        .bind(user_id)
        .bind(now)
        .bind(expires_at)
        .execute(self.pool())
        .await?;
        Ok(())
    }

    pub async fn user_by_session(
        &self,
        token_hash: String,
        now: i64,
    ) -> Result<Option<SessionUser>, ApiError> {
        let row = sqlx::query(
            "SELECT u.id, u.username
             FROM sessions s
             JOIN users u ON u.id = s.user_id
             WHERE s.token_hash = $1 AND s.expires_at > $2",
        )
        .bind(&token_hash)
        .bind(now)
        .fetch_optional(self.pool())
        .await?;
        let Some(row) = row else {
            return Ok(None);
        };
        let user = SessionUser {
            id: row.get(0),
            username: row.get(1),
        };
        sqlx::query("UPDATE sessions SET last_seen = $1 WHERE token_hash = $2")
            .bind(now)
            .bind(&token_hash)
            .execute(self.pool())
            .await?;
        sqlx::query("UPDATE users SET last_active = $1 WHERE id = $2")
            .bind(now)
            .bind(&user.id)
            .execute(self.pool())
            .await?;
        Ok(Some(user))
    }

    pub async fn delete_session(&self, token_hash: String) -> Result<(), ApiError> {
        sqlx::query("DELETE FROM sessions WHERE token_hash = $1")
            .bind(token_hash)
            .execute(self.pool())
            .await?;
        Ok(())
    }
}
