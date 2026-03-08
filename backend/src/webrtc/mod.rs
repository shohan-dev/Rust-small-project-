// WebRTC strategy helpers.
// Current behavior target:
// - 2 users => direct P2P
// - 3+ users => SFU-ready path placeholder

pub fn connection_mode(participant_count: usize) -> &'static str {
    if participant_count <= 2 {
        "p2p"
    } else {
        "sfu-ready"
    }
}
