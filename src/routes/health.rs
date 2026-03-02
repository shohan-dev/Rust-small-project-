use axum::{http::StatusCode, response::IntoResponse};

// Liveness probe endpoint.
pub async fn health() -> impl IntoResponse {
    (StatusCode::OK, "ok")
}

// Readiness probe endpoint.
pub async fn ready() -> impl IntoResponse {
    (StatusCode::OK, "ready")
}
