use rusqlite::{params, OptionalExtension};

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
        self.call(move |conn| {
            conn.execute(
                "INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_seen)
                 VALUES (?1, ?2, ?3, ?4, ?3)",
                params![token_hash, user_id, now, expires_at],
            )?;
            Ok(())
        })
        .await
    }

    pub async fn user_by_session(
        &self,
        token_hash: String,
        now: i64,
    ) -> Result<Option<SessionUser>, ApiError> {
        self.call(move |conn| {
            let user = conn
                .query_row(
                    "SELECT u.id, u.username
                     FROM sessions s
                     JOIN users u ON u.id = s.user_id
                     WHERE s.token_hash = ?1 AND s.expires_at > ?2",
                    params![token_hash, now],
                    |row| {
                        Ok(SessionUser {
                            id: row.get(0)?,
                            username: row.get(1)?,
                        })
                    },
                )
                .optional()?;
            if user.is_some() {
                conn.execute(
                    "UPDATE sessions SET last_seen = ?1 WHERE token_hash = ?2",
                    params![now, token_hash],
                )?;
            }
            Ok(user)
        })
        .await
    }

    pub async fn delete_session(&self, token_hash: String) -> Result<(), ApiError> {
        self.call(move |conn| {
            conn.execute("DELETE FROM sessions WHERE token_hash = ?1", [token_hash])?;
            Ok(())
        })
        .await
    }
}
