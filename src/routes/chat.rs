use axum::{extract::{Path, State}, http::StatusCode, response::IntoResponse, Json};

use crate::{middleware::auth_extractor::AuthUser, models::{Message, SendMessageRequest}, AppState};

// List room messages (latest first, capped).
pub async fn list_messages(
    State(state): State<AppState>,
    AuthUser(_): AuthUser,
    Path(room_id): Path<String>,
) -> impl IntoResponse {
    let messages = sqlx::query_as::<_, Message>(
        "SELECT id, room_id, user_id, content, created_at FROM messages WHERE room_id = ? ORDER BY id DESC LIMIT 100",
    )
    .bind(room_id)
    .fetch_all(&state.pool)
    .await;

    match messages {
        Ok(mut rows) => {
            rows.reverse();
            (StatusCode::OK, Json(rows)).into_response()
        }
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error":"db error"}))).into_response(),
    }
}

// Save a chat message for a room.
pub async fn send_message(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(payload): Json<SendMessageRequest>,
) -> impl IntoResponse {
    let inserted = sqlx::query(
        "INSERT INTO messages (room_id, user_id, content) VALUES (?, ?, ?)",
    )
    .bind(&payload.room_id)
    .bind(&user.id)
    .bind(&payload.content)
    .execute(&state.pool)
    .await;

    if inserted.is_err() {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error":"send failed"}))).into_response();
    }

    (StatusCode::CREATED, Json(serde_json::json!({"ok": true}))).into_response()
}
