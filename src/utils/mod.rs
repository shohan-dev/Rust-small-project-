// Shared utility helpers.

pub fn now_unix() -> i64 {
    chrono::Utc::now().timestamp()
}
