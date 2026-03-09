"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "../../../services/api";
import { useAuthStore } from "../../../store/auth";
import type { Message } from "../../../types/api";

export default function RoomPage() {
  const params     = useParams<{ id: string }>();
  const router     = useRouter();
  const { token, user, rooms } = useAuthStore();

  const room = rooms.find((r) => r.id === params.id);

  // Chat state
  const [messages, setMessages]     = useState<Message[]>([]);
  const [chatInput, setChatInput]   = useState("");
  const [sending, setSending]       = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Controls
  const [micOn, setMicOn]     = useState(true);
  const [camOn, setCamOn]     = useState(true);

  /* ── Guard ───────────────────────────────────────────────────── */
  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  /* ── Load messages ───────────────────────────────────────────── */
  const loadMessages = useCallback(async () => {
    try {
      const res = await api.get<Message[]>(`/api/chat/${params.id}`);
      setMessages(res.data);
    } catch {
      // room may not have messages yet
    }
  }, [params.id]);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 4000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  /* ── Auto-scroll chat ───────────────────────────────────────── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ── Send message ────────────────────────────────────────────── */
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || sending) return;
    setSending(true);
    const text = chatInput.trim();
    setChatInput("");
    try {
      await api.post("/api/chat/send", { room_id: params.id, content: text });
      await loadMessages();
    } catch {
      setChatInput(text); // restore on failure
    } finally {
      setSending(false);
    }
  };

  if (!token) return null;

  const roomName = room?.name ?? `Room ${params.id.slice(0, 8)}`;

  return (
    <div className="room-page">
      {/* ── Top bar ──────────────────────────────────────────── */}
      <div className="room-topbar">
        <div className="room-topbar-left">
          <Link href="/dashboard" className="btn btn-ghost btn-sm" style={{ padding: "6px 10px" }}>
            ← Back
          </Link>
          <div
            style={{
              width: 1,
              height: 20,
              background: "var(--border)",
              margin: "0 4px",
            }}
          />
          <span style={{ fontSize: 18 }}>{room?.is_private === 1 ? "🔒" : "🎙"}</span>
          <span className="room-topbar-name">{roomName}</span>
          {room?.is_private === 1 && (
            <span className="badge badge-muted" style={{ fontSize: 11 }}>Private</span>
          )}
        </div>

        <div className="room-topbar-right">
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              padding: "4px 10px",
              background: "var(--bg-hover)",
              borderRadius: 6,
              fontFamily: "monospace",
            }}
          >
            {params.id.slice(0, 8)}…
          </div>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => router.push("/dashboard")}
          >
            Leave
          </button>
        </div>
      </div>

      {/* ── Main body ────────────────────────────────────────── */}
      <div className="room-body">
        {/* Video grid */}
        <div className="video-grid">
          {/* Local tile */}
          <div className={`video-tile ${camOn ? "active-tile" : ""}`}>
            <div className="video-tile-placeholder">
              <div
                className="avatar"
                style={{ width: 56, height: 56, fontSize: 22 }}
              >
                {user?.username?.charAt(0).toUpperCase() ?? "?"}
              </div>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                {camOn ? "Camera off" : "Camera off"}
              </span>
            </div>
            <div className="video-tile-label">
              {user?.username ?? "You"} (you)
            </div>
          </div>

          {/* Waiting placeholder */}
          <div className="video-tile">
            <div className="video-tile-placeholder">
              <span style={{ fontSize: 36 }}>👤</span>
              <span>Waiting for others…</span>
            </div>
          </div>
        </div>

        {/* Chat sidebar */}
        <aside className="chat-sidebar">
          <div className="chat-header">💬 Room chat</div>

          <div className="chat-messages">
            {messages.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: 13,
                  marginTop: 24,
                }}
              >
                No messages yet. Say hi! 👋
              </div>
            )}
            {messages.map((msg) => (
              <div className="chat-msg" key={msg.id}>
                <div
                  className="avatar"
                  style={{ width: 26, height: 26, fontSize: 11, flexShrink: 0 }}
                >
                  {msg.user_id === user?.id
                    ? (user?.username?.charAt(0).toUpperCase() ?? "?")
                    : "?"}
                </div>
                <div className="chat-msg-body">
                  <div className="chat-msg-user">
                    {msg.user_id === user?.id ? user?.username : msg.user_id.slice(0, 6)}
                  </div>
                  <span className="chat-msg-text">{msg.content}</span>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-wrap">
            <form onSubmit={sendMessage} className="chat-input-row">
              <input
                type="text"
                placeholder="Type a message…"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={sending}
              />
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={sending || !chatInput.trim()}
                style={{ flexShrink: 0 }}
              >
                {sending ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "↑"}
              </button>
            </form>
          </div>
        </aside>
      </div>

      {/* ── Controls bar ─────────────────────────────────────── */}
      <div className="controls-bar">
        <button
          title={micOn ? "Mute mic" : "Unmute mic"}
          className={`control-btn ${micOn ? "ctrl-active" : ""}`}
          onClick={() => setMicOn((v) => !v)}
        >
          {micOn ? "🎤" : "🔇"}
        </button>

        <button
          title={camOn ? "Disable camera" : "Enable camera"}
          className={`control-btn ${camOn ? "ctrl-active" : ""}`}
          onClick={() => setCamOn((v) => !v)}
        >
          {camOn ? "📷" : "🚫"}
        </button>

        <button title="Share screen" className="control-btn">
          🖥
        </button>

        <button
          title="Leave room"
          className="control-btn ctrl-danger"
          onClick={() => router.push("/dashboard")}
        >
          📴
        </button>
      </div>
    </div>
  );
}

