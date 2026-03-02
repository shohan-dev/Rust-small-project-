use axum::{extract::{Path, State}, http::StatusCode, response::IntoResponse, Json};
use uuid::Uuid;

use crate::{middleware::auth_extractor::AuthUser, models::{CreateRoomRequest, JoinRoomRequest, Room}, AppState};

// Create room and auto-join owner.
pub async fn create_room(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(payload): Json<CreateRoomRequest>,
) -> impl IntoResponse {
    let room_id = Uuid::new_v4().to_string();

    let inserted = sqlx::query(
        "INSERT INTO rooms (id, owner_id, name, is_private, access_key) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&room_id)
    .bind(&user.id)
    .bind(&payload.name)
    .bind(if payload.is_private { 1 } else { 0 })
    .bind(payload.access_key)
    .execute(&state.pool)
    .await;

    if inserted.is_err() {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error":"room create failed"}))).into_response();
    }

    let _ = sqlx::query("INSERT INTO room_members (room_id, user_id) VALUES (?, ?)")
        .bind(&room_id)
        .bind(&user.id)
        .execute(&state.pool)
        .await;

    let room = sqlx::query_as::<_, Room>(
        "SELECT id, owner_id, name, is_private, access_key, created_at FROM rooms WHERE id = ?",
    )
    .bind(&room_id)
    .fetch_one(&state.pool)
    .await;

    match room {
        Ok(r) => (StatusCode::CREATED, Json(r)).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error":"room fetch failed"}))).into_response(),
    }
}

// Join room if access checks pass.
pub async fn join_room(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(payload): Json<JoinRoomRequest>,
) -> impl IntoResponse {
    let room = sqlx::query_as::<_, Room>(
        "SELECT id, owner_id, name, is_private, access_key, created_at FROM rooms WHERE id = ?",
    )
    .bind(&payload.room_id)
    .fetch_optional(&state.pool)
    .await;

    let room = match room {
        Ok(Some(r)) => r,
        _ => return (StatusCode::NOT_FOUND, Json(serde_json::json!({"error":"room not found"}))).into_response(),
    };

    if room.is_private == 1 {
        if room.access_key != payload.access_key {
            return (StatusCode::UNAUTHORIZED, Json(serde_json::json!({"error":"invalid access key"}))).into_response();
        }
    }

    let _ = sqlx::query("INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES (?, ?)")
        .bind(&room.id)
        .bind(&user.id)
        .execute(&state.pool)
        .await;

    (StatusCode::OK, Json(room)).into_response()
}

// Get room details.
pub async fn get_room(
    State(state): State<AppState>,
    AuthUser(_): AuthUser,
    Path(room_id): Path<String>,
) -> impl IntoResponse {
    let room = sqlx::query_as::<_, Room>(
        "SELECT id, owner_id, name, is_private, access_key, created_at FROM rooms WHERE id = ?",
    )
    .bind(&room_id)
    .fetch_optional(&state.pool)
    .await;

    match room {
        Ok(Some(r)) => (StatusCode::OK, Json(r)).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, Json(serde_json::json!({"error":"room not found"}))).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error":"db error"}))).into_response(),
    }
}

// Delete room when requester is owner.
pub async fn delete_room(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(room_id): Path<String>,
) -> impl IntoResponse {
    let owner = sqlx::query_scalar::<_, String>("SELECT owner_id FROM rooms WHERE id = ?")
        .bind(&room_id)
        .fetch_optional(&state.pool)
        .await;

    let owner = match owner {
        Ok(Some(v)) => v,
        Ok(None) => return (StatusCode::NOT_FOUND, Json(serde_json::json!({"error":"room not found"}))).into_response(),
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error":"db error"}))).into_response(),
    };

    if owner != user.id {
        return (StatusCode::FORBIDDEN, Json(serde_json::json!({"error":"not room owner"}))).into_response();
    }

    let deleted = sqlx::query("DELETE FROM rooms WHERE id = ?")
        .bind(&room_id)
        .execute(&state.pool)
        .await;

    match deleted {
        Ok(_) => (StatusCode::NO_CONTENT, Json(serde_json::json!({}))).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error":"delete failed"}))).into_response(),
    }
}
