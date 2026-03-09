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
    // Each room has a broadcast channel for signaling fanout and a live participant set.
    pub rooms: Arc<RwLock<HashMap<String, RoomState>>>,
}

#[derive(Debug, Clone)]
pub struct RoomState {
    pub sender: broadcast::Sender<String>,
    pub participants: HashSet<String>,
}

impl Default for RoomState {
    fn default() -> Self {
        let (sender, _rx) = broadcast::channel::<String>(256);
        Self {
            sender,
            participants: HashSet::new(),
        }
    }
}

impl SignalingHub {
    pub async fn join_room(
        &self,
        room_id: &str,
        user_id: &str,
    ) -> (broadcast::Sender<String>, Vec<String>) {
        let mut rooms = self.rooms.write().await;
        let room = rooms.entry(room_id.to_string()).or_default();
        let existing = room
            .participants
            .iter()
            .filter(|participant| participant.as_str() != user_id)
            .cloned()
            .collect::<Vec<_>>();
        room.participants.insert(user_id.to_string());

        (room.sender.clone(), existing)
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

// Upgrade HTTP to websocket for signaling channel.
pub async fn ws_handler(
    State(state): State<AppState>,
    Query(q): Query<WsQuery>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state, q.room_id, q.user_id))
}

async fn handle_socket(socket: WebSocket, state: AppState, room_id: String, user_id: String) {
    let (tx, existing_participants) = state.signaling.join_room(&room_id, &user_id).await;
    let mut rx = tx.subscribe();

    let (mut sender, mut receiver) = socket.split();

    if sender
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

    // announce join
    let _ = tx.send(
        json!({
            "type": "join",
            "roomId": room_id,
            "userId": user_id,
        })
        .to_string(),
    );

    let send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if sender.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    while let Some(Ok(msg)) = receiver.next().await {
        match msg {
            Message::Text(text) => {
                // Broadcast raw signaling payload to room peers.
                let _ = tx.send(text.to_string());
            }
            Message::Close(_) => break,
            _ => {}
        }
    }

    // announce leave
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
