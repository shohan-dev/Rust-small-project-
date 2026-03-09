"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import { api } from "../../services/api";
import { useAuthStore } from "../../store/auth";
import type { Room } from "../../types/api";

export default function DashboardPage() {
  const { token, user, rooms, addRoom, removeRoom } = useAuthStore();
  const router = useRouter();

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin]   = useState(false);

  // Create room form
  const [roomName, setRoomName]       = useState("");
  const [isPrivate, setIsPrivate]     = useState(false);
  const [accessKey, setAccessKey]     = useState("");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating]       = useState(false);

  // Join form
  const [joinId, setJoinId]         = useState("");
  const [joinKey, setJoinKey]       = useState("");
  const [joinError, setJoinError]   = useState("");
  const [joining, setJoining]       = useState(false);

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  /* ── Create Room ─────────────────────────────────────────────── */
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) { setCreateError("Room name is required."); return; }
    setCreating(true);
    setCreateError("");
    try {
      const res = await api.post<Room>("/api/rooms/create", {
        name: roomName.trim(),
        is_private: isPrivate,
        access_key: isPrivate ? accessKey || null : null,
      });
      addRoom(res.data);
      setShowCreate(false);
      setRoomName(""); setIsPrivate(false); setAccessKey("");
      router.push(`/room/${res.data.id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to create room.";
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  };

  /* ── Join Room ───────────────────────────────────────────────── */
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinId.trim()) { setJoinError("Room ID is required."); return; }
    setJoining(true);
    setJoinError("");
    try {
      const res = await api.post<Room>("/api/rooms/join", {
        room_id: joinId.trim(),
        access_key: joinKey || undefined,
      });
      addRoom(res.data);
      setShowJoin(false);
      setJoinId(""); setJoinKey("");
      router.push(`/room/${res.data.id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Could not join room.";
      setJoinError(msg);
    } finally {
      setJoining(false);
    }
  };

  /* ── Delete Room ─────────────────────────────────────────────── */
  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await api.delete(`/api/rooms/${id}`);
      removeRoom(id);
    } catch {
      // Silently remove locally even on 404
      removeRoom(id);
    } finally {
      setDeletingId(null);
    }
  };

  if (!token) return null;

  return (
    <div className="page-with-nav">
      <Navbar />

      <main className="main-content">
        {/* Header */}
        <div className="dashboard-header">
          <div>
            <h1>Dashboard</h1>
            <p>Welcome back, {user?.username} 👋</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-secondary" onClick={() => { setShowJoin(true); setJoinError(""); }}>
              Join room
            </button>
            <button className="btn btn-primary" onClick={() => { setShowCreate(true); setCreateError(""); }}>
              + New room
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Your rooms</div>
            <div className="stat-value">{rooms.length}</div>
            <div className="stat-sub">Created or joined</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Account type</div>
            <div className="stat-value" style={{ fontSize: 20, paddingTop: 4 }}>
              <span className={`badge ${user?.is_guest ? "badge-muted" : "badge-accent"}`}>
                {user?.is_guest ? "Guest" : "Member"}
              </span>
            </div>
            <div className="stat-sub">@{user?.username}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Private rooms</div>
            <div className="stat-value">{rooms.filter((r) => r.is_private === 1).length}</div>
            <div className="stat-sub">Access-key protected</div>
          </div>
        </div>

        {/* Rooms grid */}
        <div className="section-label">Your rooms</div>
        <div className="rooms-grid">
          {rooms.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <h3>No rooms yet</h3>
              <p>Create a room or join one with an ID to get started.</p>
              <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                + Create your first room
              </button>
            </div>
          ) : (
            rooms.map((room) => (
              <div className="room-card" key={room.id}>
                <div className="room-card-header">
                  <div className="room-card-icon">{room.is_private === 1 ? "🔒" : "🎙"}</div>
                  <span className={`badge ${room.is_private === 1 ? "badge-muted" : "badge-success"}`}>
                    {room.is_private === 1 ? "Private" : "Public"}
                  </span>
                </div>
                <p className="room-card-name">{room.name}</p>
                <p className="room-card-meta">ID: {room.id.slice(0, 8)}…</p>
                <div className="room-card-footer">
                  <Link href={`/room/${room.id}`} className="btn btn-primary btn-sm">
                    Enter →
                  </Link>
                  {room.owner_id === user?.id && (
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: "var(--error)" }}
                      disabled={deletingId === room.id}
                      onClick={() => handleDelete(room.id)}
                    >
                      {deletingId === room.id ? <span className="spinner" style={{ borderTopColor: "var(--error)" }} /> : "Delete"}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* ── Create Room Modal ─────────────────────────────────── */}
      {showCreate && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2>Create a room</h2>
              <button className="modal-close" onClick={() => setShowCreate(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Room name</label>
                <input
                  type="text"
                  placeholder="e.g. Team standup"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="form-group" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  id="private-toggle"
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  style={{ width: "auto", cursor: "pointer" }}
                />
                <label className="form-label" htmlFor="private-toggle" style={{ margin: 0, cursor: "pointer" }}>
                  Private room (requires access key)
                </label>
              </div>

              {isPrivate && (
                <div className="form-group">
                  <label className="form-label">Access key</label>
                  <input
                    type="text"
                    placeholder="leave blank for random"
                    value={accessKey}
                    onChange={(e) => setAccessKey(e.target.value)}
                  />
                </div>
              )}

              {createError && <p className="form-error"><span>⚠</span> {createError}</p>}

              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary btn-full" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-full" disabled={creating}>
                  {creating ? <span className="spinner" /> : "Create & enter →"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Join Room Modal ───────────────────────────────────── */}
      {showJoin && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowJoin(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2>Join a room</h2>
              <button className="modal-close" onClick={() => setShowJoin(false)}>✕</button>
            </div>
            <form onSubmit={handleJoin}>
              <div className="form-group">
                <label className="form-label">Room ID</label>
                <input
                  type="text"
                  placeholder="Paste the room ID here"
                  value={joinId}
                  onChange={(e) => setJoinId(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Access key (if private)</label>
                <input
                  type="text"
                  placeholder="optional"
                  value={joinKey}
                  onChange={(e) => setJoinKey(e.target.value)}
                />
              </div>

              {joinError && <p className="form-error"><span>⚠</span> {joinError}</p>}

              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary btn-full" onClick={() => setShowJoin(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-full" disabled={joining}>
                  {joining ? <span className="spinner" /> : "Join room →"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

