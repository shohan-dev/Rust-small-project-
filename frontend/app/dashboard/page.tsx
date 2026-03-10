"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import { api } from "../../services/api";
import { useAuthStore } from "../../store/auth";
import type { Room } from "../../types/api";

/* ── icon helpers ───────────────────────────────────────────── */
const PlusIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const EnterIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h6v18h-6M10 17l5-5-5-5M15 12H3" />
  </svg>
);
const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6M9 6V4h6v2" />
  </svg>
);
const CopyIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
const LockIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const GlobeIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);
const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export default function DashboardPage() {
  const { hydrated, token, user, rooms, addRoom, removeRoom } = useAuthStore();
  const router = useRouter();

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin]     = useState(false);

  const [roomName, setRoomName]       = useState("");
  const [isPrivate, setIsPrivate]     = useState(false);
  const [accessKey, setAccessKey]     = useState("");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating]       = useState(false);

  const [joinId, setJoinId]       = useState("");
  const [joinKey, setJoinKey]     = useState("");
  const [joinError, setJoinError] = useState("");
  const [joining, setJoining]     = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId]     = useState<string | null>(null);
  const [copyError, setCopyError]   = useState("");

  useEffect(() => {
    if (hydrated && !token) router.replace("/login");
  }, [hydrated, token, router]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) { setCreateError("Room name is required."); return; }
    setCreating(true); setCreateError("");
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
      setCreateError(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to create room."
      );
    } finally { setCreating(false); }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinId.trim()) { setJoinError("Room ID is required."); return; }
    setJoining(true); setJoinError("");
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
      setJoinError(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Could not join room."
      );
    } finally { setJoining(false); }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try { await api.delete(`/api/rooms/${id}`); }
    catch { /* silently remove */ }
    finally { removeRoom(id); setDeletingId(null); }
  };

  const copyId = async (id: string) => {
    setCopyError("");

    const markCopied = () => {
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1500);
    };

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(id);
        markCopied();
        return;
      }

      if (typeof document !== "undefined") {
        const textarea = document.createElement("textarea");
        textarea.value = id;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        textarea.style.pointerEvents = "none";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        const copied = document.execCommand("copy");
        document.body.removeChild(textarea);

        if (copied) {
          markCopied();
          return;
        }
      }
    } catch {
      // Fall through to a user-visible error message.
    }

    setCopyError("Copy is not supported here. Please select and copy the room ID manually.");
  };

  if (!hydrated) {
    return (
      <div className="auth-page">
        <div className="card auth-status-card">
          <span className="spinner" />
          <p>Restoring your session…</p>
        </div>
      </div>
    );
  }

  if (!token) return null;

  const publicRooms  = rooms.filter((r) => r.is_private !== 1);
  const privateRooms = rooms.filter((r) => r.is_private === 1);
  const greeting     = (() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  })();

  return (
    <div className="page-with-nav">
      <Navbar />

      <main className="main-content">
        {/* ── Hero header ───────────────────────────────────── */}
        <div className="db-hero">
          <div className="db-hero-text">
            <h1 className="db-greeting">
              {greeting}, <span className="db-username">{user?.username}</span>
            </h1>
            <p className="db-sub">Manage your rooms and start collaborating instantly.</p>
          </div>
          <div className="db-hero-actions">
            <button
              className="btn btn-secondary"
              onClick={() => { setShowJoin(true); setJoinError(""); }}
            >
              Join room
            </button>
            <button
              className="btn btn-primary"
              onClick={() => { setShowCreate(true); setCreateError(""); }}
            >
              <PlusIcon />
              New room
            </button>
          </div>
        </div>

        {/* ── Stats ─────────────────────────────────────────── */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-card-icon" style={{ background: "rgba(99,102,241,0.15)", color: "var(--accent)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <div>
              <div className="stat-label">Total rooms</div>
              <div className="stat-value">{rooms.length}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-icon" style={{ background: "rgba(16,185,129,0.12)", color: "var(--success)" }}>
              <GlobeIcon />
            </div>
            <div>
              <div className="stat-label">Public</div>
              <div className="stat-value">{publicRooms.length}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-icon" style={{ background: "rgba(245,158,11,0.12)", color: "var(--warning)" }}>
              <LockIcon />
            </div>
            <div>
              <div className="stat-label">Private</div>
              <div className="stat-value">{privateRooms.length}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-icon" style={{ background: "rgba(99,102,241,0.1)", color: "var(--accent)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div>
              <div className="stat-label">Account</div>
              <div className="stat-value" style={{ fontSize: 16 }}>
                <span className={`badge ${user?.is_guest ? "badge-muted" : "badge-accent"}`}>
                  {user?.is_guest ? "Guest" : "Member"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Rooms grid ────────────────────────────────────── */}
        <div className="db-section-header">
          <span className="section-label" style={{ margin: 0 }}>Your rooms</span>
          {rooms.length > 0 && (
            <span className="db-count">{rooms.length} room{rooms.length !== 1 ? "s" : ""}</span>
          )}
        </div>

        {copyError && <p className="form-error" style={{ marginTop: 0, marginBottom: 14 }}>{copyError}</p>}

        {rooms.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35 }}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h3>No rooms yet</h3>
            <p>Create a room or join one to start collaborating.</p>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              <PlusIcon /> Create your first room
            </button>
          </div>
        ) : (
          <div className="rooms-grid">
            {rooms.map((room) => (
              <div className="room-card" key={room.id}>
                <div className="room-card-header">
                  <div className="room-card-icon">
                    {room.is_private === 1
                      ? <LockIcon />
                      : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
                    }
                  </div>
                  <span className={`badge ${room.is_private === 1 ? "badge-muted" : "badge-success"}`}>
                    {room.is_private === 1 ? "Private" : "Public"}
                  </span>
                </div>

                <p className="room-card-name">{room.name}</p>

                <div className="room-id-row">
                  <span className="room-id-text">{room.id.slice(0, 12)}…</span>
                  <button
                    className="room-copy-btn"
                    onClick={() => copyId(room.id)}
                    title="Copy room ID"
                  >
                    {copiedId === room.id ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : <CopyIcon />}
                  </button>
                </div>

                <div className="room-card-footer">
                  <Link href={`/room/${room.id}`} className="btn btn-primary btn-sm room-enter-btn">
                    <EnterIcon /> Enter
                  </Link>
                  {room.owner_id === user?.id && (
                    <button
                      className="btn btn-ghost btn-sm room-delete-btn"
                      disabled={deletingId === room.id}
                      onClick={() => handleDelete(room.id)}
                      title="Delete room"
                    >
                      {deletingId === room.id
                        ? <span className="spinner" style={{ width: 13, height: 13, borderTopColor: "var(--error)" }} />
                        : <TrashIcon />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── Create Modal ──────────────────────────────────────── */}
      {showCreate && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal">
            <div className="modal-header">
              <div>
                <h2>Create a room</h2>
                <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 0" }}>
                  Set up a new audio/video room
                </p>
              </div>
              <button className="modal-close" onClick={() => setShowCreate(false)}><XIcon /></button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Room name</label>
                <input type="text" placeholder="e.g. Team standup" value={roomName}
                  onChange={(e) => setRoomName(e.target.value)} autoFocus />
              </div>

              <div className="toggle-row">
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>Private room</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Require an access key to join</div>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
                  <span className="toggle-thumb" />
                </label>
              </div>

              {isPrivate && (
                <div className="form-group">
                  <label className="form-label">Access key</label>
                  <input type="text" placeholder="leave blank to auto-generate" value={accessKey}
                    onChange={(e) => setAccessKey(e.target.value)} />
                </div>
              )}

              {createError && (
                <p className="form-error">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                  {createError}
                </p>
              )}

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary btn-full" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-full" disabled={creating}>
                  {creating ? <span className="spinner" /> : "Create & enter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Join Modal ────────────────────────────────────────── */}
      {showJoin && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowJoin(false)}>
          <div className="modal">
            <div className="modal-header">
              <div>
                <h2>Join a room</h2>
                <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 0" }}>
                  Enter a room by its ID
                </p>
              </div>
              <button className="modal-close" onClick={() => setShowJoin(false)}><XIcon /></button>
            </div>

            <form onSubmit={handleJoin}>
              <div className="form-group">
                <label className="form-label">Room ID</label>
                <input type="text" placeholder="Paste the room ID" value={joinId}
                  onChange={(e) => setJoinId(e.target.value)} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Access key <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(if private)</span></label>
                <input type="text" placeholder="optional" value={joinKey}
                  onChange={(e) => setJoinKey(e.target.value)} />
              </div>

              {joinError && (
                <p className="form-error">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                  {joinError}
                </p>
              )}

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary btn-full" onClick={() => setShowJoin(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-full" disabled={joining}>
                  {joining ? <span className="spinner" /> : "Join room"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
