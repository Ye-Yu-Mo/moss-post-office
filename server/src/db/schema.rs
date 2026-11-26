use rusqlite::Connection;

pub(super) const SCHEMA_VERSION: i64 = 3;

const SCHEMA: &str = r#"
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    username      TEXT NOT NULL,
    username_key  TEXT NOT NULL UNIQUE,
    verifier      TEXT NOT NULL,
    created_at    INTEGER NOT NULL,
    last_login    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    last_seen  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user
    ON sessions (user_id);

CREATE TABLE IF NOT EXISTS login_challenges (
    nonce      TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_challenges_expiry
    ON login_challenges (expires_at);

CREATE TABLE IF NOT EXISTS saves (
    user_id    TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    revision   INTEGER NOT NULL,
    payload    TEXT NOT NULL,
    client_ts  INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    payload    TEXT,
    client_ts  INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_user
    ON events (user_id, id);
"#;

pub(super) fn init(conn: &Connection) -> rusqlite::Result<()> {
    let version: i64 = conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;
    if version < SCHEMA_VERSION {
        park_legacy_anonymous_tables(conn)?;
        park_v2_password_tables(conn)?;
    }
    conn.execute_batch(SCHEMA)?;
    conn.pragma_update(None, "user_version", SCHEMA_VERSION)?;
    Ok(())
}

fn table_exists(conn: &Connection, name: &str) -> rusqlite::Result<bool> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
        [name],
        |row| row.get(0),
    )?;
    Ok(count > 0)
}

/// v1 of this service had anonymous `players`; keep the old rows under
/// `*_v1_legacy` instead of dropping them. They are not exposed by the API.
fn park_legacy_anonymous_tables(conn: &Connection) -> rusqlite::Result<()> {
    if !table_exists(conn, "players")? {
        return Ok(());
    }

    conn.execute_batch("PRAGMA foreign_keys = OFF;")?;
    for (from, to) in [
        ("players", "players_v1_legacy"),
        ("saves", "saves_v1_legacy"),
        ("events", "events_v1_legacy"),
    ] {
        if table_exists(conn, from)? {
            conn.execute_batch(&format!("ALTER TABLE {from} RENAME TO {to};"))?;
        }
    }
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    tracing::warn!("parked anonymous v1 tables as *_v1_legacy");
    Ok(())
}

/// v2 stored Argon2 password hashes; v3 uses client-derived verifiers and
/// HMAC challenge proofs. There is no way to convert one into the other.
fn park_v2_password_tables(conn: &Connection) -> rusqlite::Result<()> {
    if !table_exists(conn, "users")? {
        return Ok(());
    }
    let has_password_column: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('users') WHERE name = 'password_hash'",
        [],
        |row| row.get(0),
    )?;
    if has_password_column == 0 {
        return Ok(());
    }

    conn.execute_batch("PRAGMA foreign_keys = OFF;")?;
    for (from, to) in [
        ("sessions", "sessions_v2_legacy"),
        ("saves", "saves_v2_legacy"),
        ("events", "events_v2_legacy"),
        ("users", "users_v2_legacy"),
    ] {
        if table_exists(conn, from)? {
            conn.execute_batch(&format!("ALTER TABLE {from} RENAME TO {to};"))?;
        }
    }
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    tracing::warn!("parked v2 password-auth tables as *_v2_legacy");
    Ok(())
}
