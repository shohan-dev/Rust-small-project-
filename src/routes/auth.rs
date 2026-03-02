use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use rand::Rng;
use uuid::Uuid;

use crate::{
    auth::{create_jwt, hash_password, verify_password},
    middleware::auth_extractor::AuthUser,
    models::{AuthResponse, GuestRequest, LoginRequest, RegisterRequest, User, UserPublic},
    AppState,
};

// Register a normal user account.
pub async fn register(
    State(state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> impl IntoResponse {
    let hash = match hash_password(&payload.password) {
        Ok(v) => v,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error":"hash failed"}))).into_response(),
    };

    let id = Uuid::new_v4().to_string();
    let inserted = sqlx::query(
        "INSERT INTO users (id, username, password_hash, is_guest) VALUES (?, ?, ?, 0)",
    )
    .bind(&id)
    .bind(&payload.username)
    .bind(&hash)
    .execute(&state.pool)
    .await;

    if inserted.is_err() {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error":"username exists"}))).into_response();
    }

    let user = UserPublic {
        id: id.clone(),
        username: payload.username,
        is_guest: false,
    };

    let token = match create_jwt(&id, &state.jwt_secret) {
        Ok(v) => v,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error":"token failed"}))).into_response(),
    };

    (StatusCode::CREATED, Json(AuthResponse { token, user })).into_response()
}

// Login using username + password.
pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> impl IntoResponse {
    let user = sqlx::query_as::<_, User>(
        "SELECT id, username, password_hash, is_guest, created_at FROM users WHERE username = ?",
    )
    .bind(&payload.username)
    .fetch_optional(&state.pool)
    .await;

    let user = match user {
        Ok(Some(u)) => u,
        _ => return (StatusCode::UNAUTHORIZED, Json(serde_json::json!({"error":"invalid credentials"}))).into_response(),
    };

    let hash = match user.password_hash.clone() {
        Some(h) => h,
        None => return (StatusCode::UNAUTHORIZED, Json(serde_json::json!({"error":"guest account"}))).into_response(),
    };

    if !verify_password(&payload.password, &hash) {
        return (StatusCode::UNAUTHORIZED, Json(serde_json::json!({"error":"invalid credentials"}))).into_response();
    }

    let token = match create_jwt(&user.id, &state.jwt_secret) {
        Ok(v) => v,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error":"token failed"}))).into_response(),
    };

    let public = UserPublic::from(user);
    (StatusCode::OK, Json(AuthResponse { token, user: public })).into_response()
}

// Create guest account for fast room entry.
pub async fn guest(
    State(state): State<AppState>,
    Json(payload): Json<GuestRequest>,
) -> impl IntoResponse {
    let suffix: u16 = rand::thread_rng().gen_range(1000..9999);
    let username = payload
        .username
        .unwrap_or_else(|| format!("guest_{suffix}"));
    let id = Uuid::new_v4().to_string();

    let inserted = sqlx::query(
        "INSERT INTO users (id, username, password_hash, is_guest) VALUES (?, ?, NULL, 1)",
    )
    .bind(&id)
    .bind(&username)
    .execute(&state.pool)
    .await;

    if inserted.is_err() {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error":"username exists"}))).into_response();
    }

    let token = match create_jwt(&id, &state.jwt_secret) {
        Ok(v) => v,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error":"token failed"}))).into_response(),
    };

    let user = UserPublic {
        id,
        username,
        is_guest: true,
    };

    (StatusCode::CREATED, Json(AuthResponse { token, user })).into_response()
}

// Return current authenticated user profile.
pub async fn me(AuthUser(user): AuthUser) -> impl IntoResponse {
    (StatusCode::OK, Json(UserPublic::from(user)))
}
