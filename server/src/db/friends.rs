use rusqlite::{params, OptionalExtension};
use serde::Serialize;

use crate::{db::Db, error::ApiError};

#[derive(Debug, Clone, Serialize)]
pub struct FriendSummary {
    pub id: String,
    pub username: String,
    pub friend_code: String,
    pub total_stamps: i64,
    pub expedition_wins: i64,
    pub last_active: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct FriendRequestView {
    pub id: i64,
    pub from_id: String,
    pub from_name: String,
    pub to_id: String,
    pub to_name: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct FriendProfile {
    pub friend: FriendSummary,
    pub postcards_received: i64,
}

pub enum FriendRequestOutcome {
    Sent,
    BecameFriends,
    AlreadyFriends,
    AlreadyPending,
    Missing,
}

impl Db {
    pub async fn friend_code(&self, user_id: String) -> Result<Option<String>, ApiError> {
        self.call(move |conn| {
            conn.query_row(
                "SELECT friend_code FROM users WHERE id = ?1",
                [user_id],
                |row| row.get(0),
            )
            .optional()
            .map(|row| row.flatten())
        })
        .await
    }

    pub async fn user_id_by_friend_code(&self, code: String) -> Result<Option<String>, ApiError> {
        self.call(move |conn| {
            conn.query_row(
                "SELECT id FROM users WHERE friend_code = ?1",
                [code.to_ascii_uppercase()],
                |row| row.get(0),
            )
            .optional()
        })
        .await
    }

    pub async fn are_friends(&self, user_id: String, other_id: String) -> Result<bool, ApiError> {
        self.call(move |conn| {
            let count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM friendships WHERE user_id = ?1 AND friend_id = ?2",
                params![user_id, other_id],
                |row| row.get(0),
            )?;
            Ok(count > 0)
        })
        .await
    }

    pub async fn list_friends(&self, user_id: String) -> Result<Vec<FriendSummary>, ApiError> {
        self.call(move |conn| {
            let mut statement = conn.prepare(
                "SELECT u.id, u.username, u.friend_code, u.total_stamps,
                        u.expedition_wins, u.last_active
                 FROM friendships f
                 JOIN users u ON u.id = f.friend_id
                 WHERE f.user_id = ?1
                 ORDER BY u.last_active DESC, u.username ASC",
            )?;
            let rows = statement.query_map([user_id], |row| {
                Ok(FriendSummary {
                    id: row.get(0)?,
                    username: row.get(1)?,
                    friend_code: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                    total_stamps: row.get(3)?,
                    expedition_wins: row.get(4)?,
                    last_active: row.get(5)?,
                })
            })?;
            let mut friends = Vec::new();
            for row in rows {
                friends.push(row?);
            }
            Ok(friends)
        })
        .await
    }

    pub async fn list_friend_requests(
        &self,
        user_id: String,
    ) -> Result<(Vec<FriendRequestView>, Vec<FriendRequestView>), ApiError> {
        self.call(move |conn| {
            let incoming = {
                let mut statement = conn.prepare(
                    "SELECT r.id, r.from_id, sender.username, r.to_id, recipient.username, r.created_at
                     FROM friend_requests r
                     JOIN users sender ON sender.id = r.from_id
                     JOIN users recipient ON recipient.id = r.to_id
                     WHERE r.to_id = ?1
                     ORDER BY r.id DESC",
                )?;
                let rows = statement.query_map([&user_id], |row| {
                    Ok(FriendRequestView {
                        id: row.get(0)?,
                        from_id: row.get(1)?,
                        from_name: row.get(2)?,
                        to_id: row.get(3)?,
                        to_name: row.get(4)?,
                        created_at: row.get(5)?,
                    })
                })?;
                rows.collect::<rusqlite::Result<Vec<_>>>()?
            };
            let outgoing = {
                let mut statement = conn.prepare(
                    "SELECT r.id, r.from_id, sender.username, r.to_id, recipient.username, r.created_at
                     FROM friend_requests r
                     JOIN users sender ON sender.id = r.from_id
                     JOIN users recipient ON recipient.id = r.to_id
                     WHERE r.from_id = ?1
                     ORDER BY r.id DESC",
                )?;
                let rows = statement.query_map([&user_id], |row| {
                    Ok(FriendRequestView {
                        id: row.get(0)?,
                        from_id: row.get(1)?,
                        from_name: row.get(2)?,
                        to_id: row.get(3)?,
                        to_name: row.get(4)?,
                        created_at: row.get(5)?,
                    })
                })?;
                rows.collect::<rusqlite::Result<Vec<_>>>()?
            };
            Ok((incoming, outgoing))
        })
        .await
    }

    pub async fn request_friend(
        &self,
        from_id: String,
        to_id: String,
        now: i64,
    ) -> Result<FriendRequestOutcome, ApiError> {
        self.call(move |conn| {
            let already = conn.query_row(
                "SELECT COUNT(*) FROM friendships WHERE user_id = ?1 AND friend_id = ?2",
                params![from_id, to_id],
                |row| row.get::<_, i64>(0),
            )?;
            if already > 0 {
                return Ok(FriendRequestOutcome::AlreadyFriends);
            }

            let reverse: Option<i64> = conn
                .query_row(
                    "SELECT id FROM friend_requests WHERE from_id = ?1 AND to_id = ?2",
                    params![to_id, from_id],
                    |row| row.get(0),
                )
                .optional()?;
            if let Some(request_id) = reverse {
                let tx = conn.transaction()?;
                tx.execute("DELETE FROM friend_requests WHERE id = ?1", [request_id])?;
                tx.execute(
                    "DELETE FROM friend_requests WHERE from_id = ?1 AND to_id = ?2",
                    params![from_id, to_id],
                )?;
                tx.execute(
                    "INSERT OR IGNORE INTO friendships (user_id, friend_id, created_at)
                     VALUES (?1, ?2, ?3), (?2, ?1, ?3)",
                    params![from_id, to_id, now],
                )?;
                tx.commit()?;
                return Ok(FriendRequestOutcome::BecameFriends);
            }

            let exists: i64 = conn.query_row(
                "SELECT COUNT(*) FROM friend_requests WHERE from_id = ?1 AND to_id = ?2",
                params![from_id, to_id],
                |row| row.get(0),
            )?;
            if exists > 0 {
                return Ok(FriendRequestOutcome::AlreadyPending);
            }

            conn.execute(
                "INSERT INTO friend_requests (from_id, to_id, created_at) VALUES (?1, ?2, ?3)",
                params![from_id, to_id, now],
            )?;
            Ok(FriendRequestOutcome::Sent)
        })
        .await
    }

    pub async fn accept_friend_request(
        &self,
        user_id: String,
        request_id: i64,
        now: i64,
    ) -> Result<bool, ApiError> {
        self.call(move |conn| {
            let tx = conn.transaction()?;
            let from_id: Option<String> = tx
                .query_row(
                    "SELECT from_id FROM friend_requests WHERE id = ?1 AND to_id = ?2",
                    params![request_id, user_id],
                    |row| row.get(0),
                )
                .optional()?;
            let Some(from_id) = from_id else {
                return Ok(false);
            };
            tx.execute("DELETE FROM friend_requests WHERE id = ?1", [request_id])?;
            tx.execute(
                "INSERT OR IGNORE INTO friendships (user_id, friend_id, created_at)
                 VALUES (?1, ?2, ?3), (?2, ?1, ?3)",
                params![from_id, user_id, now],
            )?;
            tx.commit()?;
            Ok(true)
        })
        .await
    }

    pub async fn decline_friend_request(
        &self,
        user_id: String,
        request_id: i64,
    ) -> Result<bool, ApiError> {
        self.call(move |conn| {
            let removed = conn.execute(
                "DELETE FROM friend_requests WHERE id = ?1 AND to_id = ?2",
                params![request_id, user_id],
            )?;
            Ok(removed > 0)
        })
        .await
    }

    pub async fn remove_friend(
        &self,
        user_id: String,
        friend_id: String,
    ) -> Result<bool, ApiError> {
        self.call(move |conn| {
            let removed = conn.execute(
                "DELETE FROM friendships
                 WHERE (user_id = ?1 AND friend_id = ?2)
                    OR (user_id = ?2 AND friend_id = ?1)",
                params![user_id, friend_id],
            )?;
            Ok(removed > 0)
        })
        .await
    }

    pub async fn friend_profile(
        &self,
        viewer_id: String,
        friend_id: String,
    ) -> Result<Option<FriendProfile>, ApiError> {
        self.call(move |conn| {
            let is_friend: i64 = conn.query_row(
                "SELECT COUNT(*) FROM friendships WHERE user_id = ?1 AND friend_id = ?2",
                params![viewer_id, friend_id],
                |row| row.get(0),
            )?;
            if is_friend == 0 {
                return Ok(None);
            }
            let friend = conn
                .query_row(
                    "SELECT id, username, friend_code, total_stamps, expedition_wins, last_active
                     FROM users WHERE id = ?1",
                    [&friend_id],
                    |row| {
                        Ok(FriendSummary {
                            id: row.get(0)?,
                            username: row.get(1)?,
                            friend_code: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                            total_stamps: row.get(3)?,
                            expedition_wins: row.get(4)?,
                            last_active: row.get(5)?,
                        })
                    },
                )
                .optional()?;
            let Some(friend) = friend else {
                return Ok(None);
            };
            let postcards_received: i64 = conn.query_row(
                "SELECT COUNT(*) FROM postcards WHERE recipient_id = ?1",
                [&friend_id],
                |row| row.get(0),
            )?;
            Ok(Some(FriendProfile {
                friend,
                postcards_received,
            }))
        })
        .await
    }
}
