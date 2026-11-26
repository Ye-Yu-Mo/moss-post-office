pub struct Config {
    pub bind: String,
    pub db_path: String,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            bind: std::env::var("MOSS_BIND").unwrap_or_else(|_| "127.0.0.1:17322".into()),
            db_path: std::env::var("MOSS_DB").unwrap_or_else(|_| "data/moss.db".into()),
        }
    }
}
