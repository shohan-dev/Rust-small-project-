use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: String,
    pub username: String,
    pub password_hash: Option<String>,
    pub is_guest: i64,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Room {
    pub id: String,
    pub owner_id: String,
    pub name: String,
    pub is_private: i64,
    pub access_key: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Message {
    pub id: i64,
    pub room_id: String,
    pub user_id: String,
    pub content: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct GuestRequest {
    pub username: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: UserPublic,
}

#[derive(Debug, Serialize)]
pub struct UserPublic {
    pub id: String,
    pub username: String,
    pub is_guest: bool,
}

impl From<User> for UserPublic {
    fn from(value: User) -> Self {
        Self {
            id: value.id,
            username: value.username,
            is_guest: value.is_guest == 1,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateRoomRequest {
    pub name: String,
    pub is_private: bool,
    pub access_key: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct JoinRoomRequest {
    pub room_id: String,
    pub access_key: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SendMessageRequest {
    pub room_id: String,
    pub content: String,
}
