mod challenges;
mod collectibles;
mod events;
mod friends;
mod garden;
mod saves;
mod sessions;
mod social;
mod users;

use sqlx::postgres::{PgPool, PgPoolOptions};

use crate::error::ApiError;

pub use collectibles::Collectible;
pub use events::NewEvent;
pub use friends::{FriendProfile, FriendRequestOutcome, FriendRequestView, FriendSummary};
pub use garden::{CropStat, GardenPlot, GardenQuest, GardenReward, GardenVisitor, QuestReward};
pub use saves::StoredSave;
pub use sessions::SessionUser;
pub use social::{BotSummary, NewPostcard, PostcardRow, SquareUser};
pub use users::{NewAccount, UserRecord};

const BOTS: &[(&str, &str, &str, &str, i64, i64, i64, i64)] = &[
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

static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("./migrations");

#[derive(Clone)]
pub struct Db {
    pool: PgPool,
}

impl Db {
    pub async fn connect(database_url: &str) -> Result<Self, ApiError> {
        let pool = PgPoolOptions::new()
            .max_connections(24)
            .acquire_timeout(std::time::Duration::from_secs(10))
            .connect(database_url)
            .await?;
        MIGRATOR
            .run(&pool)
            .await
            .map_err(|error| ApiError::Internal(format!("run migrations: {error}")))?;
        let db = Self { pool };
        db.seed_bots().await?;
        Ok(db)
    }

    pub async fn connect_in_schema(database_url: &str, schema: &str) -> Result<Self, ApiError> {
        let options = database_url
            .parse::<sqlx::postgres::PgConnectOptions>()
            .map_err(|error| ApiError::Internal(format!("parse database url: {error}")))?
            .options([("search_path", schema)]);
        let pool = PgPoolOptions::new()
            .max_connections(8)
            .acquire_timeout(std::time::Duration::from_secs(10))
            .connect_with(options)
            .await?;
        MIGRATOR
            .run(&pool)
            .await
            .map_err(|error| ApiError::Internal(format!("run migrations: {error}")))?;
        let db = Self { pool };
        db.seed_bots().await?;
        Ok(db)
    }

    pub fn from_pool(pool: PgPool) -> Self {
        Self { pool }
    }

    pub fn pool(&self) -> &PgPool {
        &self.pool
    }

    async fn seed_bots(&self) -> Result<(), ApiError> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_secs() as i64)
            .unwrap_or(0);
        for (id, name, title, bio, base_stamps, daily_stamps, base_wins, daily_wins) in BOTS {
            sqlx::query(
                "INSERT INTO bots
                 (id, name, title, bio, base_stamps, daily_stamps, base_wins, daily_wins, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 ON CONFLICT (id) DO NOTHING",
            )
            .bind(*id)
            .bind(*name)
            .bind(*title)
            .bind(*bio)
            .bind(*base_stamps)
            .bind(*daily_stamps)
            .bind(*base_wins)
            .bind(*daily_wins)
            .bind(now)
            .execute(&self.pool)
            .await?;
        }
        Ok(())
    }
}
