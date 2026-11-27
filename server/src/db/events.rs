use rusqlite::params;
use rusqlite::TransactionBehavior;

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
        self.call(move |conn| {
            let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
            {
                let mut statement = tx.prepare(
                    "INSERT INTO events (user_id, name, payload, client_ts, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5)",
                )?;
                for event in &events {
                    statement.execute(params![
                        user_id,
                        event.name,
                        event.payload,
                        event.client_ts,
                        created_at
                    ])?;
                }
            }
            tx.commit()?;
            Ok(())
        })
        .await
    }
}
