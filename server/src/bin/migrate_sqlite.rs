use std::path::Path;

use rusqlite::Connection;

fn env(name: &str, default: &str) -> String {
    std::env::var(name).unwrap_or_else(|_| default.to_string())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let sqlite_path = env("MOSS_SQLITE_PATH", "data/moss.db");
    let database_url = env("MOSS_DATABASE_URL", "postgres://localhost/moss");
    if !Path::new(&sqlite_path).exists() {
        return Err(format!("sqlite database not found: {sqlite_path}").into());
    }
    let sqlite = Connection::open(&sqlite_path)?;
    let db = moss_sync::db::Db::connect(&database_url).await?;
    let pool = db.pool();
    let mut tx = pool.begin().await?;
    reset(&mut tx).await?;
    let counts = copy_all(&sqlite, &mut tx).await?;
    reset_sequences(&mut tx).await?;
    tx.commit().await?;
    for (table, count) in counts {
        println!("{table}: {count}");
    }
    println!("migration complete");
    Ok(())
}

async fn reset(tx: &mut sqlx::Transaction<'_, sqlx::Postgres>) -> Result<(), sqlx::Error> {
    sqlx::query(
        "TRUNCATE TABLE postcard_sends, postcards, garden_quests, garden_actions,
         garden_crop_stats, garden_helps, garden_steals, garden_plots,
         collectibles, friend_visits, friendships, friend_requests,
         events, saves, login_challenges, sessions, bots, users
         RESTART IDENTITY CASCADE",
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

async fn reset_sequences(tx: &mut sqlx::Transaction<'_, sqlx::Postgres>) -> Result<(), sqlx::Error> {
    for table in [
        "events",
        "friend_requests",
        "collectibles",
        "garden_actions",
        "postcards",
        "postcard_sends",
    ] {
        let sql = format!(
            "SELECT setval(pg_get_serial_sequence('{table}', 'id'),
                           COALESCE((SELECT MAX(id) FROM {table}), 1),
                           (SELECT MAX(id) FROM {table}) IS NOT NULL)"
        );
        sqlx::query(&sql).execute(&mut **tx).await?;
    }
    Ok(())
}

fn count(conn: &Connection, table: &str) -> i64 {
    conn.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| row.get(0))
        .unwrap_or(0)
}

async fn copy_all(
    sqlite: &Connection,
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
) -> Result<Vec<(&'static str, i64)>, Box<dyn std::error::Error>> {
    let mut counts = Vec::new();

    {
        let mut statement = sqlite.prepare(
            "SELECT id, username, username_key, verifier, created_at, last_login,
                    total_stamps, expedition_wins, night_best, last_active, friend_code,
                    garden_harvests
             FROM users",
        )?;
        let rows = statement.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, i64>(4)?,
                row.get::<_, i64>(5)?,
                row.get::<_, i64>(6)?,
                row.get::<_, i64>(7)?,
                row.get::<_, i64>(8)?,
                row.get::<_, i64>(9)?,
                row.get::<_, Option<String>>(10)?,
                row.get::<_, i64>(11)?,
            ))
        })?;
        for row in rows {
            let (id, username, username_key, verifier, created_at, last_login, total_stamps,
                 expedition_wins, night_best, last_active, friend_code, garden_harvests) = row?;
            sqlx::query(
                "INSERT INTO users
                 (id, username, username_key, verifier, created_at, last_login,
                  total_stamps, expedition_wins, night_best, last_active, friend_code,
                  garden_harvests)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
            )
            .bind(id)
            .bind(username)
            .bind(username_key)
            .bind(verifier)
            .bind(created_at)
            .bind(last_login)
            .bind(total_stamps)
            .bind(expedition_wins)
            .bind(night_best)
            .bind(last_active)
            .bind(friend_code)
            .bind(garden_harvests)
            .execute(&mut **tx)
            .await?;
        }
        counts.push(("users", count(sqlite, "users")));
    }

    {
        let mut statement =
            sqlite.prepare("SELECT token_hash, user_id, created_at, expires_at, last_seen FROM sessions")?;
        let rows = statement.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, i64>(3)?,
                row.get::<_, i64>(4)?,
            ))
        })?;
        for row in rows {
            let (token_hash, user_id, created_at, expires_at, last_seen) = row?;
            sqlx::query(
                "INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_seen)
                 VALUES ($1,$2,$3,$4,$5)",
            )
            .bind(token_hash)
            .bind(user_id)
            .bind(created_at)
            .bind(expires_at)
            .bind(last_seen)
            .execute(&mut **tx)
            .await?;
        }
        counts.push(("sessions", count(sqlite, "sessions")));
    }

    {
        let mut statement =
            sqlite.prepare("SELECT nonce, created_at, expires_at FROM login_challenges")?;
        let rows = statement.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, i64>(2)?,
            ))
        })?;
        for row in rows {
            let (nonce, created_at, expires_at) = row?;
            sqlx::query(
                "INSERT INTO login_challenges (nonce, created_at, expires_at)
                 VALUES ($1,$2,$3)",
            )
            .bind(nonce)
            .bind(created_at)
            .bind(expires_at)
            .execute(&mut **tx)
            .await?;
        }
        counts.push(("login_challenges", count(sqlite, "login_challenges")));
    }

    {
        let mut statement = sqlite.prepare(
            "SELECT user_id, revision, payload, client_ts, updated_at FROM saves",
        )?;
        let rows = statement.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, i64>(3)?,
                row.get::<_, i64>(4)?,
            ))
        })?;
        for row in rows {
            let (user_id, revision, payload, client_ts, updated_at) = row?;
            sqlx::query(
                "INSERT INTO saves (user_id, revision, payload, client_ts, updated_at)
                 VALUES ($1,$2,$3,$4,$5)",
            )
            .bind(user_id)
            .bind(revision)
            .bind(payload)
            .bind(client_ts)
            .bind(updated_at)
            .execute(&mut **tx)
            .await?;
        }
        counts.push(("saves", count(sqlite, "saves")));
    }

    {
        let mut statement = sqlite.prepare(
            "SELECT id, user_id, name, payload, client_ts, created_at FROM events",
        )?;
        let rows = statement.query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, i64>(4)?,
                row.get::<_, i64>(5)?,
            ))
        })?;
        for row in rows {
            let (id, user_id, name, payload, client_ts, created_at) = row?;
            sqlx::query(
                "INSERT INTO events (id, user_id, name, payload, client_ts, created_at)
                 VALUES ($1,$2,$3,$4,$5,$6)",
            )
            .bind(id)
            .bind(user_id)
            .bind(name)
            .bind(payload)
            .bind(client_ts)
            .bind(created_at)
            .execute(&mut **tx)
            .await?;
        }
        counts.push(("events", count(sqlite, "events")));
    }

    {
        let mut statement =
            sqlite.prepare("SELECT id, from_id, to_id, created_at FROM friend_requests")?;
        let rows = statement.query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, i64>(3)?,
            ))
        })?;
        for row in rows {
            let (id, from_id, to_id, created_at) = row?;
            sqlx::query(
                "INSERT INTO friend_requests (id, from_id, to_id, created_at)
                 VALUES ($1,$2,$3,$4)",
            )
            .bind(id)
            .bind(from_id)
            .bind(to_id)
            .bind(created_at)
            .execute(&mut **tx)
            .await?;
        }
        counts.push(("friend_requests", count(sqlite, "friend_requests")));
    }

    {
        let mut statement =
            sqlite.prepare("SELECT user_id, friend_id, created_at FROM friendships")?;
        let rows = statement.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)?,
            ))
        })?;
        for row in rows {
            let (user_id, friend_id, created_at) = row?;
            sqlx::query(
                "INSERT INTO friendships (user_id, friend_id, created_at)
                 VALUES ($1,$2,$3)",
            )
            .bind(user_id)
            .bind(friend_id)
            .bind(created_at)
            .execute(&mut **tx)
            .await?;
        }
        counts.push(("friendships", count(sqlite, "friendships")));
    }

    {
        let mut statement =
            sqlite.prepare("SELECT visitor_id, friend_id, day, created_at FROM friend_visits")?;
        let rows = statement.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, i64>(3)?,
            ))
        })?;
        for row in rows {
            let (visitor_id, friend_id, day, created_at) = row?;
            sqlx::query(
                "INSERT INTO friend_visits (visitor_id, friend_id, day, created_at)
                 VALUES ($1,$2,$3,$4)",
            )
            .bind(visitor_id)
            .bind(friend_id)
            .bind(day)
            .bind(created_at)
            .execute(&mut **tx)
            .await?;
        }
        counts.push(("friend_visits", count(sqlite, "friend_visits")));
    }

    {
        let mut statement = sqlite.prepare(
            "SELECT id, user_id, kind, template, edition, serial, image_key, minted_at
             FROM collectibles",
        )?;
        let rows = statement.query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, i64>(4)?,
                row.get::<_, i64>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, i64>(7)?,
            ))
        })?;
        for row in rows {
            let (id, user_id, kind, template, edition, serial, image_key, minted_at) = row?;
            sqlx::query(
                "INSERT INTO collectibles
                 (id, user_id, kind, template, edition, serial, image_key, minted_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
            )
            .bind(id)
            .bind(user_id)
            .bind(kind)
            .bind(template)
            .bind(edition)
            .bind(serial)
            .bind(image_key)
            .bind(minted_at)
            .execute(&mut **tx)
            .await?;
        }
        counts.push(("collectibles", count(sqlite, "collectibles")));
    }

    {
        let mut statement = sqlite.prepare(
            "SELECT owner_id, plot, crop, planted_at, ripe_at, stolen, watered
             FROM garden_plots",
        )?;
        let rows = statement.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, i64>(3)?,
                row.get::<_, i64>(4)?,
                row.get::<_, i64>(5)?,
                row.get::<_, i64>(6)?,
            ))
        })?;
        for row in rows {
            let (owner_id, plot, crop, planted_at, ripe_at, stolen, watered) = row?;
            sqlx::query(
                "INSERT INTO garden_plots
                 (owner_id, plot, crop, planted_at, ripe_at, stolen, watered)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)",
            )
            .bind(owner_id)
            .bind(plot)
            .bind(crop)
            .bind(planted_at)
            .bind(ripe_at)
            .bind(stolen)
            .bind(watered)
            .execute(&mut **tx)
            .await?;
        }
        counts.push(("garden_plots", count(sqlite, "garden_plots")));
    }

    {
        let mut statement = sqlite.prepare(
            "SELECT thief_id, owner_id, plot, day, created_at FROM garden_steals",
        )?;
        let rows = statement.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, i64>(3)?,
                row.get::<_, i64>(4)?,
            ))
        })?;
        for row in rows {
            let (thief_id, owner_id, plot, day, created_at) = row?;
            sqlx::query(
                "INSERT INTO garden_steals (thief_id, owner_id, plot, day, created_at)
                 VALUES ($1,$2,$3,$4,$5)",
            )
            .bind(thief_id)
            .bind(owner_id)
            .bind(plot)
            .bind(day)
            .bind(created_at)
            .execute(&mut **tx)
            .await?;
        }
        counts.push(("garden_steals", count(sqlite, "garden_steals")));
    }

    {
        let mut statement = sqlite.prepare(
            "SELECT helper_id, owner_id, plot, day, created_at FROM garden_helps",
        )?;
        let rows = statement.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, i64>(3)?,
                row.get::<_, i64>(4)?,
            ))
        })?;
        for row in rows {
            let (helper_id, owner_id, plot, day, created_at) = row?;
            sqlx::query(
                "INSERT INTO garden_helps (helper_id, owner_id, plot, day, created_at)
                 VALUES ($1,$2,$3,$4,$5)",
            )
            .bind(helper_id)
            .bind(owner_id)
            .bind(plot)
            .bind(day)
            .bind(created_at)
            .execute(&mut **tx)
            .await?;
        }
        counts.push(("garden_helps", count(sqlite, "garden_helps")));
    }

    {
        let mut statement = sqlite.prepare(
            "SELECT user_id, crop, harvests, stolen FROM garden_crop_stats",
        )?;
        let rows = statement.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, i64>(3)?,
            ))
        })?;
        for row in rows {
            let (user_id, crop, harvests, stolen) = row?;
            sqlx::query(
                "INSERT INTO garden_crop_stats (user_id, crop, harvests, stolen)
                 VALUES ($1,$2,$3,$4)",
            )
            .bind(user_id)
            .bind(crop)
            .bind(harvests)
            .bind(stolen)
            .execute(&mut **tx)
            .await?;
        }
        counts.push(("garden_crop_stats", count(sqlite, "garden_crop_stats")));
    }

    {
        let mut statement = sqlite.prepare(
            "SELECT id, actor_id, owner_id, plot, action, crop, created_at FROM garden_actions",
        )?;
        let rows = statement.query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, i64>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, i64>(6)?,
            ))
        })?;
        for row in rows {
            let (id, actor_id, owner_id, plot, action, crop, created_at) = row?;
            sqlx::query(
                "INSERT INTO garden_actions
                 (id, actor_id, owner_id, plot, action, crop, created_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)",
            )
            .bind(id)
            .bind(actor_id)
            .bind(owner_id)
            .bind(plot)
            .bind(action)
            .bind(crop)
            .bind(created_at)
            .execute(&mut **tx)
            .await?;
        }
        counts.push(("garden_actions", count(sqlite, "garden_actions")));
    }

    {
        let mut statement = sqlite.prepare(
            "SELECT user_id, day, crop, reward_kind, reward_amount, claimed_at
             FROM garden_quests",
        )?;
        let rows = statement.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, i64>(4)?,
                row.get::<_, Option<i64>>(5)?,
            ))
        })?;
        for row in rows {
            let (user_id, day, crop, reward_kind, reward_amount, claimed_at) = row?;
            sqlx::query(
                "INSERT INTO garden_quests
                 (user_id, day, crop, reward_kind, reward_amount, claimed_at)
                 VALUES ($1,$2,$3,$4,$5,$6)",
            )
            .bind(user_id)
            .bind(day)
            .bind(crop)
            .bind(reward_kind)
            .bind(reward_amount)
            .bind(claimed_at)
            .execute(&mut **tx)
            .await?;
        }
        counts.push(("garden_quests", count(sqlite, "garden_quests")));
    }

    {
        let mut statement = sqlite.prepare(
            "SELECT id, name, title, bio, base_stamps, daily_stamps, base_wins, daily_wins,
                    created_at FROM bots",
        )?;
        let rows = statement.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, i64>(4)?,
                row.get::<_, i64>(5)?,
                row.get::<_, i64>(6)?,
                row.get::<_, i64>(7)?,
                row.get::<_, i64>(8)?,
            ))
        })?;
        for row in rows {
            let (id, name, title, bio, base_stamps, daily_stamps, base_wins, daily_wins, created_at) = row?;
            sqlx::query(
                "INSERT INTO bots
                 (id, name, title, bio, base_stamps, daily_stamps, base_wins, daily_wins, created_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
            )
            .bind(id)
            .bind(name)
            .bind(title)
            .bind(bio)
            .bind(base_stamps)
            .bind(daily_stamps)
            .bind(base_wins)
            .bind(daily_wins)
            .bind(created_at)
            .execute(&mut **tx)
            .await?;
        }
        counts.push(("bots", count(sqlite, "bots")));
    }

    {
        let mut statement = sqlite.prepare(
            "SELECT id, sender_id, sender_name, sender_kind, recipient_id, template,
                    gift_kind, gift_amount, created_at, arrives_at, claimed_at
             FROM postcards",
        )?;
        let rows = statement.query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, Option<String>>(6)?,
                row.get::<_, i64>(7)?,
                row.get::<_, i64>(8)?,
                row.get::<_, i64>(9)?,
                row.get::<_, Option<i64>>(10)?,
            ))
        })?;
        for row in rows {
            let (id, sender_id, sender_name, sender_kind, recipient_id, template,
                 gift_kind, gift_amount, created_at, arrives_at, claimed_at) = row?;
            sqlx::query(
                "INSERT INTO postcards
                 (id, sender_id, sender_name, sender_kind, recipient_id, template,
                  gift_kind, gift_amount, created_at, arrives_at, claimed_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
            )
            .bind(id)
            .bind(sender_id)
            .bind(sender_name)
            .bind(sender_kind)
            .bind(recipient_id)
            .bind(template)
            .bind(gift_kind)
            .bind(gift_amount)
            .bind(created_at)
            .bind(arrives_at)
            .bind(claimed_at)
            .execute(&mut **tx)
            .await?;
        }
        counts.push(("postcards", count(sqlite, "postcards")));
    }

    {
        let mut statement = sqlite.prepare(
            "SELECT id, user_id, recipient_kind, created_at FROM postcard_sends",
        )?;
        let rows = statement.query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, i64>(3)?,
            ))
        })?;
        for row in rows {
            let (id, user_id, recipient_kind, created_at) = row?;
            sqlx::query(
                "INSERT INTO postcard_sends (id, user_id, recipient_kind, created_at)
                 VALUES ($1,$2,$3,$4)",
            )
            .bind(id)
            .bind(user_id)
            .bind(recipient_kind)
            .bind(created_at)
            .execute(&mut **tx)
            .await?;
        }
        counts.push(("postcard_sends", count(sqlite, "postcard_sends")));
    }

    Ok(counts)
}
