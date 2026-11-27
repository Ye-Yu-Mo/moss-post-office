use crate::{db::Db, error::ApiError};

pub struct NewEvent {
    pub name: String,
    pub payload: Option<String>,
    pub client_ts: i64,
}

impl Db {
    pub async fn insert_events(
        &self,
        user_id: String,
        events: Vec<NewEvent>,
        created_at: i64,
    ) -> Result<(), ApiError> {
        let mut tx = self.pool().begin().await?;
        for event in events {
            sqlx::query(
                "INSERT INTO events (user_id, name, payload, client_ts, created_at)
                 VALUES ($1, $2, $3, $4, $5)",
            )
            .bind(&user_id)
            .bind(event.name)
            .bind(event.payload)
            .bind(event.client_ts)
            .bind(created_at)
            .execute(&mut *tx)
            .await?;
        }
        tx.commit().await?;
        Ok(())
    }
}
