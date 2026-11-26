use rusqlite::{params, OptionalExtension};

use crate::{db::Db, error::ApiError};

#[derive(Debug, Clone)]
pub struct UserRecord {
    pub id: String,
    pub username: String,
    pub password_hash: String,
}

pub struct NewAccount {
    pub user_id: String,
    pub username: String,
    pub username_key: String,
    pub password_hash: String,
    pub token_hash: String,
    pub now: i64,
    pub expires_at: i64,
    pub save_payload: Option<String>,
}

impl Db {
    /// Creates the user, its first session, and optionally the first save in
    /// one transaction. Returns whether a save was created.
    pub async fn register_account(&self, account: NewAccount) -> Result<bool, ApiError> {
        let outcome = self
            .call(move |conn| -> rusqlite::Result<Result<bool, ()>> {
                let tx = conn.transaction()?;
                let inserted = tx.execute(
                    "INSERT INTO users (id, username, username_key, password_hash, created_at, last_login)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
                    params![
                        account.user_id,
                        account.username,
                        account.username_key,
                        account.password_hash,
                        account.now
                    ],
                );
                if let Err(error) = inserted {
                    if is_unique_violation(&error) {
                        return Ok(Err(()));
                    }
                    return Err(error);
                }

                tx.execute(
                    "INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_seen)
                     VALUES (?1, ?2, ?3, ?4, ?3)",
                    params![
                        account.token_hash,
                        account.user_id,
                        account.now,
                        account.expires_at
                    ],
                )?;

                let mut created_save = false;
                if let Some(payload) = account.save_payload {
                    tx.execute(
                        "INSERT INTO saves (user_id, revision, payload, client_ts, updated_at)
                         VALUES (?1, 1, ?2, ?3, ?3)",
                        params![account.user_id, payload, account.now],
                    )?;
                    created_save = true;
                }
                tx.commit()?;
                Ok(Ok(created_save))
            })
            .await?;

        match outcome {
            Ok(created_save) => Ok(created_save),
            Err(()) => Err(ApiError::UsernameTaken),
        }
    }

    pub async fn user_by_username(
        &self,
        username_key: String,
    ) -> Result<Option<UserRecord>, ApiError> {
        self.call(move |conn| {
            conn.query_row(
                "SELECT id, username, password_hash FROM users WHERE username_key = ?1",
                [username_key],
                |row| {
                    Ok(UserRecord {
                        id: row.get(0)?,
                        username: row.get(1)?,
                        password_hash: row.get(2)?,
                    })
                },
            )
            .optional()
        })
        .await
    }

    pub async fn touch_login(&self, user_id: String, now: i64) -> Result<(), ApiError> {
        self.call(move |conn| {
            conn.execute(
                "UPDATE users SET last_login = ?1 WHERE id = ?2",
                params![now, user_id],
            )?;
            Ok(())
        })
        .await
    }
}

fn is_unique_violation(error: &rusqlite::Error) -> bool {
    matches!(
        error,
        rusqlite::Error::SqliteFailure(code, _)
            if code.code == rusqlite::ErrorCode::ConstraintViolation
    )
}
