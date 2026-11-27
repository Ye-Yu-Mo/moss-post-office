use serde::Serialize;
use sqlx::Row;

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
    pub visits_received: i64,
}

pub enum FriendRequestOutcome {
    Sent,
    BecameFriends,
    AlreadyFriends,
    AlreadyPending,
    Missing,
}

fn friend_row(row: &sqlx::postgres::PgRow) -> FriendSummary {
    FriendSummary {
        id: row.get(0),
        username: row.get(1),
        friend_code: row.get::<Option<String>, _>(2).unwrap_or_default(),
        total_stamps: row.get(3),
        expedition_wins: row.get(4),
        last_active: row.get(5),
    }
}

impl Db {
    pub async fn friend_code(&self, user_id: String) -> Result<Option<String>, ApiError> {
        let row = sqlx::query("SELECT friend_code FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_optional(self.pool())
            .await?;
        Ok(row.map(|row| row.get(0)))
    }

    pub async fn user_id_by_friend_code(&self, code: String) -> Result<Option<String>, ApiError> {
        let row = sqlx::query("SELECT id FROM users WHERE friend_code = $1")
            .bind(code.to_ascii_uppercase())
            .fetch_optional(self.pool())
            .await?;
        Ok(row.map(|row| row.get(0)))
    }

    pub async fn are_friends(&self, user_id: String, other_id: String) -> Result<bool, ApiError> {
        let row = sqlx::query(
            "SELECT COUNT(*) FROM friendships WHERE user_id = $1 AND friend_id = $2",
        )
        .bind(user_id)
        .bind(other_id)
        .fetch_one(self.pool())
        .await?;
        Ok(row.get::<i64, _>(0) > 0)
    }

    pub async fn list_friends(&self, user_id: String) -> Result<Vec<FriendSummary>, ApiError> {
        let rows = sqlx::query(
            "SELECT u.id, u.username, u.friend_code, u.total_stamps,
                    u.expedition_wins, u.last_active
             FROM friendships f
             JOIN users u ON u.id = f.friend_id
             WHERE f.user_id = $1
             ORDER BY u.last_active DESC, u.username ASC",
        )
        .bind(user_id)
        .fetch_all(self.pool())
        .await?;
        Ok(rows.iter().map(friend_row).collect())
    }

    pub async fn list_friend_requests(
        &self,
        user_id: String,
    ) -> Result<(Vec<FriendRequestView>, Vec<FriendRequestView>), ApiError> {
        let incoming_rows = sqlx::query(
            "SELECT r.id, r.from_id, sender.username, r.to_id, recipient.username, r.created_at
             FROM friend_requests r
             JOIN users sender ON sender.id = r.from_id
             JOIN users recipient ON recipient.id = r.to_id
             WHERE r.to_id = $1
             ORDER BY r.id DESC",
        )
        .bind(&user_id)
        .fetch_all(self.pool())
        .await?;
        let outgoing_rows = sqlx::query(
            "SELECT r.id, r.from_id, sender.username, r.to_id, recipient.username, r.created_at
             FROM friend_requests r
             JOIN users sender ON sender.id = r.from_id
             JOIN users recipient ON recipient.id = r.to_id
             WHERE r.from_id = $1
             ORDER BY r.id DESC",
        )
        .bind(user_id)
        .fetch_all(self.pool())
        .await?;
        let map = |row: &sqlx::postgres::PgRow| FriendRequestView {
            id: row.get(0),
            from_id: row.get(1),
            from_name: row.get(2),
            to_id: row.get(3),
            to_name: row.get(4),
            created_at: row.get(5),
        };
        Ok((
            incoming_rows
                .iter()
                .map(map)
                .collect::<Vec<_>>(),
            outgoing_rows
                .iter()
                .map(map)
                .collect::<Vec<_>>(),
        ))
    }

    pub async fn request_friend(
        &self,
        from_id: String,
        to_id: String,
        now: i64,
    ) -> Result<FriendRequestOutcome, ApiError> {
        let mut tx = self.pool().begin().await?;
        let mut pair = [from_id.clone(), to_id.clone()];
        pair.sort();
        sqlx::query("SELECT pg_advisory_xact_lock(hashtext($1))")
            .bind(format!("{}:{}", pair[0], pair[1]))
            .execute(&mut *tx)
            .await?;

        let already = sqlx::query(
            "SELECT COUNT(*) FROM friendships WHERE user_id = $1 AND friend_id = $2",
        )
        .bind(&from_id)
        .bind(&to_id)
        .fetch_one(&mut *tx)
        .await?;
        if already.get::<i64, _>(0) > 0 {
            tx.commit().await?;
            return Ok(FriendRequestOutcome::AlreadyFriends);
        }

        let reverse = sqlx::query(
            "SELECT id FROM friend_requests WHERE from_id = $1 AND to_id = $2",
        )
        .bind(&to_id)
        .bind(&from_id)
        .fetch_optional(&mut *tx)
        .await?;
        if let Some(request) = reverse {
            let request_id: i64 = request.get(0);
            sqlx::query("DELETE FROM friend_requests WHERE id = $1")
                .bind(request_id)
                .execute(&mut *tx)
                .await?;
            sqlx::query("DELETE FROM friend_requests WHERE from_id = $1 AND to_id = $2")
                .bind(&from_id)
                .bind(&to_id)
                .execute(&mut *tx)
                .await?;
            for (a, b) in [(&from_id, &to_id), (&to_id, &from_id)] {
                sqlx::query(
                    "INSERT INTO friendships (user_id, friend_id, created_at)
                     VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
                )
                .bind(a)
                .bind(b)
                .bind(now)
                .execute(&mut *tx)
                .await?;
            }
            tx.commit().await?;
            return Ok(FriendRequestOutcome::BecameFriends);
        }

        let exists = sqlx::query(
            "SELECT COUNT(*) FROM friend_requests WHERE from_id = $1 AND to_id = $2",
        )
        .bind(&from_id)
        .bind(&to_id)
        .fetch_one(&mut *tx)
        .await?;
        if exists.get::<i64, _>(0) > 0 {
            tx.commit().await?;
            return Ok(FriendRequestOutcome::AlreadyPending);
        }

        sqlx::query(
            "INSERT INTO friend_requests (from_id, to_id, created_at) VALUES ($1, $2, $3)",
        )
        .bind(&from_id)
        .bind(&to_id)
        .bind(now)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(FriendRequestOutcome::Sent)
    }

    pub async fn accept_friend_request(
        &self,
        user_id: String,
        request_id: i64,
        now: i64,
    ) -> Result<bool, ApiError> {
        let mut tx = self.pool().begin().await?;
        let row = sqlx::query(
            "SELECT from_id FROM friend_requests WHERE id = $1 AND to_id = $2 FOR UPDATE",
        )
        .bind(request_id)
        .bind(&user_id)
        .fetch_optional(&mut *tx)
        .await?;
        let Some(row) = row else {
            tx.rollback().await?;
            return Ok(false);
        };
        let from_id: String = row.get(0);
        sqlx::query("DELETE FROM friend_requests WHERE id = $1")
            .bind(request_id)
            .execute(&mut *tx)
            .await?;
        for (a, b) in [(&from_id, &user_id), (&user_id, &from_id)] {
            sqlx::query(
                "INSERT INTO friendships (user_id, friend_id, created_at)
                 VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
            )
            .bind(a)
            .bind(b)
            .bind(now)
            .execute(&mut *tx)
            .await?;
        }
        tx.commit().await?;
        Ok(true)
    }

    pub async fn decline_friend_request(
        &self,
        user_id: String,
        request_id: i64,
    ) -> Result<bool, ApiError> {
        let result =
            sqlx::query("DELETE FROM friend_requests WHERE id = $1 AND to_id = $2")
                .bind(request_id)
                .bind(user_id)
                .execute(self.pool())
                .await?;
        Ok(result.rows_affected() > 0)
    }

    /// Returns true when this is the first visit to this friend today.
    pub async fn visit_friend(
        &self,
        visitor_id: String,
        friend_id: String,
        now: i64,
    ) -> Result<bool, ApiError> {
        let result = sqlx::query(
            "INSERT INTO friend_visits (visitor_id, friend_id, day, created_at)
             VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
        )
        .bind(visitor_id)
        .bind(friend_id)
        .bind(now / 86_400)
        .bind(now)
        .execute(self.pool())
        .await?;
        Ok(result.rows_affected() > 0)
    }

    pub async fn remove_friend(
        &self,
        user_id: String,
        friend_id: String,
    ) -> Result<bool, ApiError> {
        let result = sqlx::query(
            "DELETE FROM friendships
             WHERE (user_id = $1 AND friend_id = $2)
                OR (user_id = $2 AND friend_id = $1)",
        )
        .bind(&user_id)
        .bind(&friend_id)
        .execute(self.pool())
        .await?;
        Ok(result.rows_affected() > 0)
    }

    pub async fn friend_profile(
        &self,
        viewer_id: String,
        friend_id: String,
    ) -> Result<Option<FriendProfile>, ApiError> {
        let is_friend = sqlx::query(
            "SELECT COUNT(*) FROM friendships WHERE user_id = $1 AND friend_id = $2",
        )
        .bind(&viewer_id)
        .bind(&friend_id)
        .fetch_one(self.pool())
        .await?;
        if is_friend.get::<i64, _>(0) == 0 {
            return Ok(None);
        }
        let row = sqlx::query(
            "SELECT id, username, friend_code, total_stamps, expedition_wins, last_active
             FROM users WHERE id = $1",
        )
        .bind(&friend_id)
        .fetch_optional(self.pool())
        .await?;
        let Some(row) = row else {
            return Ok(None);
        };
        let friend = friend_row(&row);
        let postcards = sqlx::query("SELECT COUNT(*) FROM postcards WHERE recipient_id = $1")
            .bind(&friend_id)
            .fetch_one(self.pool())
            .await?;
        let visits = sqlx::query("SELECT COUNT(*) FROM friend_visits WHERE friend_id = $1")
            .bind(&friend_id)
            .fetch_one(self.pool())
            .await?;
        Ok(Some(FriendProfile {
            friend,
            postcards_received: postcards.get(0),
            visits_received: visits.get(0),
        }))
    }
}
