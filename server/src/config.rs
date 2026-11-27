pub struct Config {
    pub bind: String,
    pub database_url: String,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            bind: std::env::var("MOSS_BIND").unwrap_or_else(|_| "127.0.0.1:17322".into()),
            database_url: std::env::var("MOSS_DATABASE_URL")
                .unwrap_or_else(|_| "postgres://127.0.0.1:5432/moss".into()),
        }
    }
}
