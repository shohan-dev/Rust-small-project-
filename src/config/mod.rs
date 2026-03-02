// App runtime configuration loaded from environment variables.
#[derive(Debug, Clone)]
pub struct Settings {
    pub host: String,
    pub port: u16,
    pub database_url: String,
    pub jwt_secret: String,
}

impl Settings {
    pub fn from_env() -> Self {
        let host = std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
        let port = std::env::var("PORT")
            .ok()
            .and_then(|v| v.parse::<u16>().ok())
            .unwrap_or(8080);
        let database_url = std::env::var("DATABASE_URL")
            .unwrap_or_else(|_| "sqlite://app.db?mode=rwc".to_string());
        let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "change-me-in-prod".to_string());

        Self {
            host,
            port,
            database_url,
            jwt_secret,
        }
    }
}
