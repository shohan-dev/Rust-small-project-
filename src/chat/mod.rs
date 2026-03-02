// Chat domain placeholder types for typing indicators and events.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TypingEvent {
    pub room_id: String,
    pub user_id: String,
    pub is_typing: bool,
}
