use sqlx::Row;

use crate::{db::Db, error::ApiError};

#[derive(Debug, Clone)]
pub struct UserRecord {
    pub id: String,
    pub username: String,
    pub verifier: String,
}

pub struct NewAccount {
    pub user_id: String,
    pub username: String,
    pub username_key: String,
    pub verifier: String,
    pub friend_code: String,
    pub token_hash: String,
    pub now: i64,
    pub expires_at: i64,
    pub save_payload: Option<String>,
}

impl Db {
    /// Creates the user, its first session, and optionally the first save in
    /// one transaction. Returns whether a save was created.
    pub async fn register_account(&self, account: NewAccount) -> Result<bool, ApiError> {
        let mut tx = self.pool().begin().await?;

        let inserted = sqlx::query(
            "INSERT INTO users
             (id, username, username_key, verifier, friend_code, created_at, last_login)
             VALUES ($1, $2, $3, $4, $5, $6, $6)",
        )
        .bind(&account.user_id)
        .bind(&account.username)
        .bind(&account.username_key)
        .bind(&account.verifier)
        .bind(&account.friend_code)
        .bind(account.now)
        .execute(&mut *tx)
        .await;

        if let Err(error) = inserted {
            if is_unique_violation(&error) {
                return Err(ApiError::UsernameTaken);
            }
            return Err(error.into());
        }

        sqlx::query(
            "INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_seen)
             VALUES ($1, $2, $3, $4, $3)",
        )
        .bind(&account.token_hash)
        .bind(&account.user_id)
        .bind(account.now)
        .bind(account.expires_at)
        .execute(&mut *tx)
        .await?;

        let mut created_save = false;
        if let Some(payload) = account.save_payload {
            sqlx::query(
                "INSERT INTO saves (user_id, revision, payload, client_ts, updated_at)
                 VALUES ($1, 1, $2, $3, $3)",
            )
            .bind(&account.user_id)
            .bind(payload)
            .bind(account.now)
            .execute(&mut *tx)
            .await?;
            created_save = true;
        }
        tx.commit().await?;
        Ok(created_save)
    }

    pub async fn user_by_username(
        &self,
        username_key: String,
    ) -> Result<Option<UserRecord>, ApiError> {
        let row = sqlx::query(
            "SELECT id, username, verifier FROM users WHERE username_key = $1",
        )
        .bind(username_key)
        .fetch_optional(self.pool())
        .await?;
        Ok(row.map(|row| UserRecord {
            id: row.get(0),
            username: row.get(1),
            verifier: row.get(2),
        }))
    }

    pub async fn touch_login(&self, user_id: String, now: i64) -> Result<(), ApiError> {
        sqlx::query("UPDATE users SET last_login = $1, last_active = $1 WHERE id = $2")
            .bind(now)
            .bind(user_id)
            .execute(self.pool())
            .await?;
        Ok(())
    }

    pub async fn night_best(&self, user_id: String) -> Result<i64, ApiError> {
        let row = sqlx::query("SELECT night_best FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_optional(self.pool())
            .await?;
        Ok(row.map(|row| row.get::<i64, _>(0)).unwrap_or(0))
    }

    pub async fn update_stats(
        &self,
        user_id: String,
        total_stamps: i64,
        expedition_wins: i64,
        night_best: i64,
        now: i64,
    ) -> Result<(), ApiError> {
        sqlx::query(
            "UPDATE users
             SET total_stamps = $1, expedition_wins = $2, night_best = $3, last_active = $4
             WHERE id = $5",
        )
        .bind(total_stamps)
        .bind(expedition_wins)
        .bind(night_best)
        .bind(now)
        .bind(user_id)
        .execute(self.pool())
        .await?;
        Ok(())
    }
}

fn is_unique_violation(error: &sqlx::Error) -> bool {
    match error {
        sqlx::Error::Database(database) => database.code().as_deref() == Some("23505"),
        _ => false,
    }
}

