use std::{collections::HashMap, sync::Arc};

use axum::{
    extract::{ws::{Message, WebSocket, WebSocketUpgrade}, Query, State},
    response::IntoResponse,
};
use futures::{SinkExt, StreamExt};
use serde::Deserialize;
use tokio::sync::{broadcast, RwLock};

use crate::AppState;

#[derive(Debug, Deserialize)]
pub struct WsQuery {
    pub room_id: String,
    pub user_id: String,
}

#[derive(Debug, Default)]
pub struct SignalingHub {
    // Each room has a broadcast channel for signaling fanout.
    pub rooms: Arc<RwLock<HashMap<String, broadcast::Sender<String>>>>,
}

impl SignalingHub {
    pub async fn room_sender(&self, room_id: &str) -> broadcast::Sender<String> {
        let mut rooms = self.rooms.write().await;
        if let Some(sender) = rooms.get(room_id) {
            return sender.clone();
        }
        let (tx, _rx) = broadcast::channel::<String>(256);
        rooms.insert(room_id.to_string(), tx.clone());
        tx
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
    let tx = state.signaling.room_sender(&room_id).await;
    let mut rx = tx.subscribe();

    let (mut sender, mut receiver) = socket.split();

    // announce join
    let _ = tx.send(format!(r#"{{"type":"join","roomId":"{}","userId":"{}"}}"#, room_id, user_id));

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
    let _ = tx.send(format!(r#"{{"type":"leave","roomId":"{}","userId":"{}"}}"#, room_id, user_id));
    send_task.abort();
}
