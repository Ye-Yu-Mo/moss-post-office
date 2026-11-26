use rusqlite::Connection;

pub(super) const SCHEMA_VERSION: i64 = 9;

const SCHEMA: &str = r#"
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY,
    username        TEXT NOT NULL,
    username_key    TEXT NOT NULL UNIQUE,
    verifier        TEXT NOT NULL,
    created_at      INTEGER NOT NULL,
    last_login      INTEGER NOT NULL DEFAULT 0,
    total_stamps    INTEGER NOT NULL DEFAULT 0,
    expedition_wins INTEGER NOT NULL DEFAULT 0,
    last_active     INTEGER NOT NULL DEFAULT 0,
    friend_code     TEXT
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

CREATE TABLE IF NOT EXISTS friend_requests (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    from_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    to_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    UNIQUE (from_id, to_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_to
    ON friend_requests (to_id, id);

CREATE TABLE IF NOT EXISTS friendships (
    user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    friend_id  TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, friend_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_user
    ON friendships (user_id, friend_id);

CREATE TABLE IF NOT EXISTS friend_visits (
    visitor_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    friend_id  TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    day        INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (visitor_id, friend_id, day)
);

CREATE INDEX IF NOT EXISTS idx_friend_visits_friend
    ON friend_visits (friend_id, day);

CREATE TABLE IF NOT EXISTS collectibles (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind       TEXT NOT NULL,
    template   TEXT NOT NULL,
    edition    INTEGER NOT NULL,
    serial     INTEGER NOT NULL,
    image_key  TEXT NOT NULL,
    minted_at  INTEGER NOT NULL,
    UNIQUE (user_id, kind, template),
    UNIQUE (kind, template, serial)
);

CREATE INDEX IF NOT EXISTS idx_collectibles_user
    ON collectibles (user_id, kind);

CREATE TABLE IF NOT EXISTS garden_plots (
    owner_id   TEXT NOT NULL,
    plot       INTEGER NOT NULL,
    crop       TEXT NOT NULL,
    planted_at INTEGER NOT NULL,
    ripe_at    INTEGER NOT NULL,
    stolen     INTEGER NOT NULL DEFAULT 0,
    watered    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (owner_id, plot)
);

CREATE TABLE IF NOT EXISTS garden_steals (
    thief_id   TEXT NOT NULL,
    owner_id   TEXT NOT NULL,
    plot       INTEGER NOT NULL,
    day        INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (thief_id, owner_id, plot, day)
);

CREATE TABLE IF NOT EXISTS bots (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    title         TEXT NOT NULL,
    bio           TEXT NOT NULL,
    base_stamps   INTEGER NOT NULL,
    daily_stamps  INTEGER NOT NULL,
    base_wins     INTEGER NOT NULL,
    daily_wins    INTEGER NOT NULL,
    created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS postcards (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id     TEXT NOT NULL,
    sender_name   TEXT NOT NULL,
    sender_kind   TEXT NOT NULL,
    recipient_id  TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    template      TEXT NOT NULL,
    gift_kind     TEXT,
    gift_amount   INTEGER NOT NULL DEFAULT 0,
    created_at    INTEGER NOT NULL,
    arrives_at    INTEGER NOT NULL,
    claimed_at    INTEGER
);

CREATE INDEX IF NOT EXISTS idx_postcards_recipient
    ON postcards (recipient_id, id);

CREATE INDEX IF NOT EXISTS idx_postcards_sender
    ON postcards (sender_id, created_at);

CREATE TABLE IF NOT EXISTS postcard_sends (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        TEXT NOT NULL,
    recipient_kind TEXT NOT NULL,
    created_at     INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_postcard_sends_user
    ON postcard_sends (user_id, created_at);
"#;

pub(super) fn init(conn: &Connection) -> rusqlite::Result<()> {
    let version: i64 = conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;
    if version < SCHEMA_VERSION {
        park_legacy_anonymous_tables(conn)?;
        park_v2_password_tables(conn)?;
    }
    conn.execute_batch(SCHEMA)?;
    ensure_user_stat_columns(conn)?;
    ensure_garden_columns(conn)?;
    conn.execute_batch(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_friend_code
         ON users (friend_code)
         WHERE friend_code IS NOT NULL;",
    )?;
    seed_bots(conn)?;
    ensure_friend_codes(conn)?;
    conn.pragma_update(None, "user_version", SCHEMA_VERSION)?;
    Ok(())
}

fn column_exists(conn: &Connection, table: &str, column: &str) -> rusqlite::Result<bool> {
    let count: i64 = conn.query_row(
        &format!("SELECT COUNT(*) FROM pragma_table_info('{table}') WHERE name = ?1"),
        [column],
        |row| row.get(0),
    )?;
    Ok(count > 0)
}

fn ensure_user_stat_columns(conn: &Connection) -> rusqlite::Result<()> {
    for (name, ddl) in [
        ("total_stamps", "INTEGER NOT NULL DEFAULT 0"),
        ("expedition_wins", "INTEGER NOT NULL DEFAULT 0"),
        ("last_active", "INTEGER NOT NULL DEFAULT 0"),
        ("friend_code", "TEXT"),
    ] {
        if !column_exists(conn, "users", name)? {
            conn.execute_batch(&format!("ALTER TABLE users ADD COLUMN {name} {ddl};"))?;
        }
    }
    Ok(())
}

fn ensure_garden_columns(conn: &Connection) -> rusqlite::Result<()> {
    if !column_exists(conn, "garden_plots", "watered")? {
        conn.execute_batch(
            "ALTER TABLE garden_plots ADD COLUMN watered INTEGER NOT NULL DEFAULT 0;",
        )?;
    }
    Ok(())
}

fn ensure_friend_codes(conn: &Connection) -> rusqlite::Result<()> {
    let mut statement =
        conn.prepare("SELECT id FROM users WHERE friend_code IS NULL OR friend_code = ''")?;
    let rows = statement.query_map([], |row| row.get::<_, String>(0))?;
    let ids = rows.collect::<rusqlite::Result<Vec<_>>>()?;
    for id in ids {
        for _ in 0..8 {
            let code = crate::auth::new_friend_code();
            match conn.execute(
                "UPDATE users SET friend_code = ?1 WHERE id = ?2",
                rusqlite::params![code, id],
            ) {
                Ok(_) => break,
                Err(rusqlite::Error::SqliteFailure(error, _))
                    if error.code == rusqlite::ErrorCode::ConstraintViolation => {}
                Err(error) => return Err(error),
            }
        }
    }
    Ok(())
}

fn seed_bots(conn: &Connection) -> rusqlite::Result<()> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0);
    let bots = [
        (
            "b_moss",
            "苔苔",
            "镇口邮差",
            "在雾湖边捡邮票，顺手把信送到。",
            48000,
            620,
            6,
            0,
        ),
        (
            "b_snail",
            "慢慢",
            "蜗牛邮差",
            "走得慢，但从来没有丢过一封信。",
            32000,
            410,
            3,
            0,
        ),
        (
            "b_plane",
            "纸飞机",
            "风里的信使",
            "顺着风飞，落地时总是刚好。",
            61000,
            760,
            8,
            1,
        ),
        (
            "b_night",
            "夜班司机",
            "星港夜航",
            "只在月亮出来以后上班。",
            88000,
            980,
            12,
            1,
        ),
        (
            "b_mushroom",
            "蘑菇太太",
            "柜台常客",
            "喜欢在信封上别一朵小蘑菇。",
            27000,
            350,
            2,
            0,
        ),
        (
            "b_box",
            "邮筒先生",
            "路边邮筒",
            "吞过很多信，也吐出过很多回信。",
            41000,
            520,
            4,
            0,
        ),
        (
            "b_star",
            "星港旅人",
            "远方来客",
            "从星港来，带着一身冷风。",
            73000,
            840,
            9,
            1,
        ),
        (
            "b_boat",
            "雾湖船夫",
            "摆渡人",
            "湖上的信比岸上的慢一点。",
            36000,
            460,
            5,
            0,
        ),
    ];
    for (id, name, title, bio, base_stamps, daily_stamps, base_wins, daily_wins) in bots {
        conn.execute(
            "INSERT OR IGNORE INTO bots
             (id, name, title, bio, base_stamps, daily_stamps, base_wins, daily_wins, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            rusqlite::params![
                id,
                name,
                title,
                bio,
                base_stamps,
                daily_stamps,
                base_wins,
                daily_wins,
                now
            ],
        )?;
    }
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
