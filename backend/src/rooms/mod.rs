// Room lifecycle utilities placeholder.
// Future: periodic cleanup for stale empty rooms.

pub fn should_cleanup(member_count: usize) -> bool {
    member_count == 0
}
