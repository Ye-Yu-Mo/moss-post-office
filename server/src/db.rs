use std::{
    path::{Path, PathBuf},
    time::Duration,
};

use rusqlite::Connection;

use crate::error::ApiError;

const SCHEMA: &str = r#"
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS players (
    id            TEXT PRIMARY KEY,
    token_hash    TEXT NOT NULL,
    recovery_hash TEXT NOT NULL,
    created_at    INTEGER NOT NULL,
    last_seen     INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_players_token
    ON players (token_hash);

CREATE TABLE IF NOT EXISTS saves (
    player_id  TEXT PRIMARY KEY REFERENCES players (id) ON DELETE CASCADE,
    revision   INTEGER NOT NULL,
    payload    TEXT NOT NULL,
    client_ts  INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id  TEXT NOT NULL,
    name       TEXT NOT NULL,
    payload    TEXT,
    client_ts  INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_player
    ON events (player_id, id);
"#;

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
        conn.execute_batch(SCHEMA)?;
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
