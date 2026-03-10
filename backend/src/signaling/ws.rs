use std::{collections::HashMap, sync::{atomic::{AtomicBool, Ordering}, Arc}, time::Duration};

use axum::{
    extract::{ws::{Message, WebSocket, WebSocketUpgrade}, Query, State},
    response::IntoResponse,
};
use futures::{SinkExt, StreamExt};
use serde::Deserialize;
use serde_json::json;
use tokio::sync::{broadcast, RwLock};

use crate::AppState;

/// Interval for server→client WebSocket ping frames to keep connections alive
/// behind proxies and NAT routers.
const PING_INTERVAL: Duration = Duration::from_secs(25);

/// If no pong is received within this window after a ping, the connection is
/// considered dead and will be dropped.
const PONG_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Debug, Deserialize)]
pub struct WsQuery {
    pub room_id: String,
    pub user_id: String,
    /// Optional JWT token for authenticated WebSocket connections.
    pub token: Option<String>,
}

/// Per-participant metadata stored in the room.
#[derive(Debug, Clone)]
pub struct ParticipantInfo {
    pub user_id: String,
    pub username: String,
}

#[derive(Debug, Default)]
pub struct SignalingHub {
    /// Each room has a broadcast channel for signaling fan-out and a live participant set.
    pub rooms: Arc<RwLock<HashMap<String, RoomState>>>,
}

#[derive(Debug, Clone)]
pub struct RoomState {
    pub sender: broadcast::Sender<String>,
    pub participants: HashMap<String, ParticipantInfo>,
}

impl Default for RoomState {
    fn default() -> Self {
        let (sender, _rx) = broadcast::channel::<String>(512);
        Self {
            sender,
            participants: HashMap::new(),
        }
    }
}

impl SignalingHub {
    /// Join a room. Returns (broadcast sender, receiver, existing participant IDs).
    /// The receiver is subscribed **while still holding the lock** so no messages
    /// can slip through between participant insertion and subscribe.
    pub async fn join_room(
        &self,
        room_id: &str,
        user_id: &str,
        username: &str,
    ) -> (broadcast::Sender<String>, broadcast::Receiver<String>, Vec<ParticipantInfo>) {
        let mut rooms = self.rooms.write().await;
        let room = rooms.entry(room_id.to_string()).or_default();
        // Subscribe while holding the lock — no messages are missed.
        let rx = room.sender.subscribe();
        let existing = room
            .participants
            .values()
            .filter(|p| p.user_id != user_id)
            .cloned()
            .collect::<Vec<_>>();
        room.participants.insert(
            user_id.to_string(),
            ParticipantInfo {
                user_id: user_id.to_string(),
                username: username.to_string(),
            },
        );
        (room.sender.clone(), rx, existing)
    }

    pub async fn leave_room(&self, room_id: &str, user_id: &str) {
        let mut rooms = self.rooms.write().await;
        if let Some(room) = rooms.get_mut(room_id) {
            room.participants.remove(user_id);
            if room.participants.is_empty() {
                rooms.remove(room_id);
            }
        }
    }

    /// Get current participant count for a room.
    pub async fn participant_count(&self, room_id: &str) -> usize {
        let rooms = self.rooms.read().await;
        rooms.get(room_id).map(|r| r.participants.len()).unwrap_or(0)
    }
}

/// Upgrade HTTP → WebSocket for signaling.
/// Optionally verifies JWT token from query parameter.
pub async fn ws_handler(
    State(state): State<AppState>,
    Query(q): Query<WsQuery>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    // Resolve display name — verify JWT if provided, fallback to user_id.
    let username = if let Some(ref token) = q.token {
        match crate::auth::decode_jwt(token, &state.jwt_secret) {
            Ok(claims) => {
                // Look up the actual username from DB.
                let user = sqlx::query_scalar::<_, String>(
                    "SELECT username FROM users WHERE id = ?",
                )
                .bind(&claims.sub)
                .fetch_optional(&state.pool)
                .await
                .ok()
                .flatten();
                user.unwrap_or_else(|| q.user_id.clone())
            }
            Err(_) => q.user_id.clone(),
        }
    } else {
        q.user_id.clone()
    };

    ws.on_upgrade(move |socket| handle_socket(socket, state, q.room_id, q.user_id, username))
}

async fn handle_socket(
    socket: WebSocket,
    state: AppState,
    room_id: String,
    user_id: String,
    username: String,
) {
    let (tx, mut rx, existing_participants) =
        state.signaling.join_room(&room_id, &user_id, &username).await;

    let (mut ws_sender, mut ws_receiver) = socket.split();

    // Build participant list with usernames for the snapshot.
    let user_list: Vec<serde_json::Value> = existing_participants
        .iter()
        .map(|p| json!({"userId": p.user_id, "username": p.username}))
        .collect();

    // Send the participant snapshot to the newly connected user.
    if ws_sender
        .send(Message::Text(
            json!({
                "type": "participants",
                "roomId": room_id,
                "users": existing_participants.iter().map(|p| p.user_id.as_str()).collect::<Vec<_>>(),
                "participants": user_list,
            })
            .to_string()
            .into(),
        ))
        .await
        .is_err()
    {
        state.signaling.leave_room(&room_id, &user_id).await;
        return;
    }

    // Announce join to the room (include username so peers can display it).
    let _ = tx.send(
        json!({
            "type": "join",
            "roomId": room_id,
            "userId": user_id,
            "username": username,
        })
        .to_string(),
    );

    // ── Forward broadcast messages to this user's WebSocket. ──
    // Filter: (a) echo — own messages, (b) targeted messages not for us.
    // Also sends periodic pings to keep the connection alive.
    let uid_for_send = user_id.clone();
    let pong_received = Arc::new(AtomicBool::new(false));
    let pong_received_clone = Arc::clone(&pong_received);

    let send_task = tokio::spawn(async move {
        let mut ping_interval = tokio::time::interval(PING_INTERVAL);
        let mut awaiting_pong = false;
        let mut pong_deadline: Option<tokio::time::Instant> = None;

        loop {
            tokio::select! {
                // Relay broadcast messages to this client.
                result = rx.recv() => {
                    match result {
                        Ok(raw) => {
                            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&raw) {
                                // Skip echo.
                                let from = parsed
                                    .get("from")
                                    .and_then(|v| v.as_str())
                                    .or_else(|| parsed.get("userId").and_then(|v| v.as_str()));
                                if from == Some(uid_for_send.as_str()) {
                                    continue;
                                }
                                // Skip targeted messages not meant for us.
                                if let Some(to) = parsed.get("to").and_then(|v| v.as_str()) {
                                    if to != uid_for_send.as_str() {
                                        continue;
                                    }
                                }
                            }
                            if ws_sender.send(Message::Text(raw.into())).await.is_err() {
                                break;
                            }
                        }
                        Err(broadcast::error::RecvError::Lagged(n)) => {
                            tracing::warn!("client {} lagged by {} messages", uid_for_send, n);
                            continue;
                        }
                        Err(_) => break,
                    }
                }

                // Send periodic pings.
                _ = ping_interval.tick() => {
                    // Check if a pong was received since last ping.
                    if awaiting_pong {
                        if pong_received_clone.swap(false, Ordering::Relaxed) {
                            // Pong received — reset.
                            awaiting_pong = false;
                            pong_deadline = None;
                        } else if let Some(deadline) = pong_deadline {
                            if tokio::time::Instant::now() > deadline {
                                tracing::debug!("client {} pong timeout", uid_for_send);
                                break;
                            }
                        }
                    }

                    if !awaiting_pong {
                        if ws_sender.send(Message::Ping(vec![42].into())).await.is_err() {
                            break;
                        }
                        awaiting_pong = true;
                        pong_deadline = Some(tokio::time::Instant::now() + PONG_TIMEOUT);
                    }
                }
            }
        }
    });

    // Read messages from client and broadcast to room.
    while let Some(Ok(msg)) = ws_receiver.next().await {
        match msg {
            Message::Text(text) => {
                let _ = tx.send(text.to_string());
            }
            Message::Pong(_) => {
                // Signal the send_task that a pong was received.
                pong_received.store(true, Ordering::Relaxed);
            }
            Message::Close(_) => break,
            _ => {}
        }
    }

    // User disconnected — announce leave and clean up.
    state.signaling.leave_room(&room_id, &user_id).await;
    let _ = tx.send(
        json!({
            "type": "leave",
            "roomId": room_id,
            "userId": user_id,
        })
        .to_string(),
    );
    send_task.abort();
}
