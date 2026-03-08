use std::str::FromStr;

use sqlx::{sqlite::{SqliteConnectOptions, SqlitePoolOptions}, SqlitePool};

// Initialize SQLite pool and return a shared connection pool.
pub async fn connect(database_url: &str) -> anyhow::Result<SqlitePool> {
    let connect_options = SqliteConnectOptions::from_str(database_url)?.create_if_missing(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(10)
        .connect_with(connect_options)
        .await?;
    Ok(pool)
}
