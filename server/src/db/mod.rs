mod challenges;
mod events;
mod saves;
mod schema;
mod sessions;
mod social;
mod users;

use std::{path::Path, path::PathBuf, time::Duration};

use rusqlite::Connection;

use crate::error::ApiError;

pub use events::NewEvent;
pub use saves::StoredSave;
pub use sessions::SessionUser;
pub use social::{BotSummary, NewPostcard, PostcardRow, SquareUser};
pub use users::{NewAccount, UserRecord};

/// Small SQLite wrapper. Connections are opened per request; WAL makes that
/// cheap and keeps the handler futures `Send`.
#[derive(Clone)]
pub struct Db {
    path: PathBuf,
}

impl Db {
    pub fn new(path: impl Into<PathBuf>) -> Result<Self, ApiError> {
        let path = path.into();
        if let Some(parent) = path.parent() {
            if !parent.as_os_str().is_empty() {
                std::fs::create_dir_all(parent)
                    .map_err(|error| ApiError::Internal(format!("create db dir: {error}")))?;
            }
        }
        let db = Self { path };
        db.init()?;
        Ok(db)
    }

    fn init(&self) -> Result<(), ApiError> {
        let conn = open_connection(&self.path)?;
        schema::init(&conn)?;
        Ok(())
    }

    pub async fn call<T, F>(&self, f: F) -> Result<T, ApiError>
    where
        F: FnOnce(&mut Connection) -> rusqlite::Result<T> + Send + 'static,
        T: Send + 'static,
    {
        let path = self.path.clone();
        let result = tokio::task::spawn_blocking(move || {
            let mut conn = open_connection(&path)?;
            f(&mut conn)
        })
        .await?;
        Ok(result?)
    }
}

fn open_connection(path: &Path) -> rusqlite::Result<Connection> {
    let conn = Connection::open(path)?;
    conn.busy_timeout(Duration::from_secs(5))?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    Ok(conn)
}
