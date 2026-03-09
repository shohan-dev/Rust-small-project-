use std::{collections::{HashMap, HashSet}, sync::Arc};

use axum::{
    extract::{ws::{Message, WebSocket, WebSocketUpgrade}, Query, State},
    response::IntoResponse,
};
use futures::{SinkExt, StreamExt};
use serde::Deserialize;
use serde_json::json;
use tokio::sync::{broadcast, RwLock};

use crate::AppState;

#[derive(Debug, Deserialize)]
pub struct WsQuery {
    pub room_id: String,
    pub user_id: String,
}

#[derive(Debug, Default)]
pub struct SignalingHub {
    /// Each room has a broadcast channel for signaling fan-out and a live participant set.
    pub rooms: Arc<RwLock<HashMap<String, RoomState>>>,
}

#[derive(Debug, Clone)]
pub struct RoomState {
    pub sender: broadcast::Sender<String>,
    pub participants: HashSet<String>,
}

impl Default for RoomState {
    fn default() -> Self {
        let (sender, _rx) = broadcast::channel::<String>(512);
        Self {
            sender,
            participants: HashSet::new(),
        }
    }
}

impl SignalingHub {
    /// Join a room. Returns (broadcast sender, receiver, existing participants).
    /// The receiver is subscribed **while still holding the lock** so no messages
    /// can slip through between participant insertion and subscribe.
    pub async fn join_room(
        &self,
        room_id: &str,
        user_id: &str,
    ) -> (broadcast::Sender<String>, broadcast::Receiver<String>, Vec<String>) {
        let mut rooms = self.rooms.write().await;
        let room = rooms.entry(room_id.to_string()).or_default();
        // Subscribe while holding the lock — no messages are missed.
        let rx = room.sender.subscribe();
        let existing = room
            .participants
            .iter()
            .filter(|p| p.as_str() != user_id)
            .cloned()
            .collect::<Vec<_>>();
        room.participants.insert(user_id.to_string());
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
}

/// Upgrade HTTP → WebSocket for signaling.
pub async fn ws_handler(
    State(state): State<AppState>,
    Query(q): Query<WsQuery>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state, q.room_id, q.user_id))
}

async fn handle_socket(socket: WebSocket, state: AppState, room_id: String, user_id: String) {
    let (tx, mut rx, existing_participants) =
        state.signaling.join_room(&room_id, &user_id).await;

    let (mut ws_sender, mut ws_receiver) = socket.split();

    // Send the participant snapshot to the newly connected user.
    if ws_sender
        .send(Message::Text(
            json!({
                "type": "participants",
                "roomId": room_id,
                "users": existing_participants,
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

    // Announce join to the room.
    let _ = tx.send(
        json!({
            "type": "join",
            "roomId": room_id,
            "userId": user_id,
        })
        .to_string(),
    );

    // Forward broadcast messages to this user's WebSocket.
    // Filter: (a) echo — own messages, (b) targeted messages not for us.
    let uid_for_send = user_id.clone();
    let send_task = tokio::spawn(async move {
        while let Ok(raw) = rx.recv().await {
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
    });

    // Read messages from client and broadcast to room.
    while let Some(Ok(msg)) = ws_receiver.next().await {
        match msg {
            Message::Text(text) => {
                let _ = tx.send(text.to_string());
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
