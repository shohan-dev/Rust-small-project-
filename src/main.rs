mod auth;
mod chat;
mod config;
mod db;
mod middleware;
mod models;
mod rooms;
mod routes;
mod signaling;
mod utils;
mod webrtc;

use std::{net::SocketAddr, sync::Arc};

use axum::{routing::{get, post}, Router};
use sqlx::SqlitePool;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use signaling::ws::SignalingHub;

// Shared app dependencies/state injected into handlers.
#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
    pub jwt_secret: String,
    pub signaling: Arc<SignalingHub>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "backend=debug,tower_http=debug".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let settings = config::Settings::from_env();
    let pool = db::connect(&settings.database_url).await?;

    // Apply SQL migrations on startup.
    sqlx::migrate!("./migrations").run(&pool).await?;

    let state = AppState {
        pool,
        jwt_secret: settings.jwt_secret,
        signaling: Arc::new(SignalingHub::default()),
    };

    let api = Router::new()
        .route("/auth/register", post(routes::auth::register))
        .route("/auth/login", post(routes::auth::login))
        .route("/auth/guest", post(routes::auth::guest))
        .route("/auth/me", get(routes::auth::me))
        .route("/rooms/create", post(routes::rooms::create_room))
        .route("/rooms/join", post(routes::rooms::join_room))
        .route("/rooms/{id}", get(routes::rooms::get_room).delete(routes::rooms::delete_room))
        .route("/chat/{room_id}", get(routes::chat::list_messages))
        .route("/chat/send", post(routes::chat::send_message));

    let app = Router::new()
        .route("/health", get(routes::health::health))
        .route("/ready", get(routes::health::ready))
        .route("/ws", get(signaling::ws::ws_handler))
        .nest("/api", api)
        .with_state(state)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http());

    let addr: SocketAddr = format!("{}:{}", settings.host, settings.port).parse()?;
    tracing::info!("backend listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
