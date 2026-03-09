"use client";

/* ============================================================
   Room Page – full multi-peer WebRTC + premium UI
   ============================================================ */

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "../../../services/api";
import { useAuthStore } from "../../../store/auth";
import type { Message } from "../../../types/api";

/* ── Types ──────────────────────────────────────────────────── */
interface PeerEntry {
  userId: string;
  pc: RTCPeerConnection;
  stream: MediaStream | null;
  micOn: boolean;
  camOn: boolean;
}

/* ── SVG Icons ──────────────────────────────────────────────── */
const MicIcon = ({ off }: { off?: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {off ? (
      <>
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </>
    ) : (
      <>
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </>
    )}
  </svg>
);

const CamIcon = ({ off }: { off?: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {off ? (
      <>
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34" />
        <circle cx="12" cy="13" r="3" />
      </>
    ) : (
      <>
        <path d="M23 7l-7 5 7 5V7z" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </>
    )}
  </svg>
);

const ScreenIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const PhoneOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.42 19.42 0 0 1 4.26 9.11 19.79 19.79 0 0 1 1.2 .5 2 2 0 0 1 3.18 0h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.16 7.91" />
    <line x1="23" y1="1" x2="1" y2="23" />
  </svg>
);

const PeopleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const ChatBubbleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const SendIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const LockSmIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const BackArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

/* ── ICE servers ─────────────────────────────────────────────── */
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

/* ── Avatar colour ───────────────────────────────────────────── */
const PALETTE = [
  "linear-gradient(135deg,#6366f1,#8b5cf6)",
  "linear-gradient(135deg,#0ea5e9,#6366f1)",
  "linear-gradient(135deg,#10b981,#0ea5e9)",
  "linear-gradient(135deg,#f59e0b,#ef4444)",
  "linear-gradient(135deg,#ec4899,#8b5cf6)",
  "linear-gradient(135deg,#14b8a6,#6366f1)",
];
function avatarColor(uid: string) {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/* ── VideoTile ───────────────────────────────────────────────── */
function VideoTile({
  stream, label, userId, isLocal, micOn, camOn, speaking,
}: {
  stream: MediaStream | null;
  label: string;
  userId: string;
  isLocal?: boolean;
  micOn: boolean;
  camOn: boolean;
  speaking?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  const initial = label.charAt(0).toUpperCase() || "?";
  const bg = avatarColor(userId);
  const hasVideo =
    !!stream &&
    stream.getVideoTracks().some((t) => t.enabled) &&
    camOn;

  return (
    <div className={`vt-tile${speaking ? " vt-speaking" : ""}${isLocal ? " vt-local" : ""}`}>
      {hasVideo ? (
        <video ref={videoRef} autoPlay playsInline muted={isLocal} className="vt-video" />
      ) : (
        <div className="vt-placeholder">
          <div className="vt-avatar" style={{ background: bg }}>{initial}</div>
          <span className="vt-cam-label">Camera off</span>
        </div>
      )}
      <div className="vt-overlay">
        <span className="vt-name">
          {label}
          {isLocal && <span className="vt-you-tag">you</span>}
        </span>
        <span className="vt-icons">
          {!micOn && <span className="vt-icon-badge" title="Muted"><MicIcon off /></span>}
          {!camOn && <span className="vt-icon-badge" title="Camera off"><CamIcon off /></span>}
        </span>
      </div>
      {speaking && <div className="vt-ring" />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Page
═══════════════════════════════════════════════════════════════ */
export default function RoomPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { token, user, rooms } = useAuthStore();
  const room = useMemo(() => rooms.find((r) => r.id === params.id), [rooms, params.id]);

  /* ── chat state ─────────────────────────────────────────────── */
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /* ── local AV controls ──────────────────────────────────────── */
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  /* ── WebRTC state ───────────────────────────────────────────── */
  const [peers, setPeers] = useState<Map<string, PeerEntry>>(new Map());
  const peersRef = useRef<Map<string, PeerEntry>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  /* guard */
  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  /* ── Acquire local media ────────────────────────────────────── */
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        localStreamRef.current = stream;
        setLocalStream(stream);
      } catch {
        const empty = new MediaStream();
        localStreamRef.current = empty;
        setLocalStream(empty);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = micOn; });
  }, [micOn]);

  useEffect(() => {
    localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = camOn; });
  }, [camOn]);

  /* ── Peer connection factory ────────────────────────────────── */
  const createPeer = useCallback(
    (remoteId: string, polite: boolean) => {
      if (peersRef.current.has(remoteId)) return peersRef.current.get(remoteId)!.pc;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      localStreamRef.current?.getTracks().forEach((t) =>
        pc.addTrack(t, localStreamRef.current!)
      );

      pc.ontrack = (ev) => {
        const [remote] = ev.streams.length ? ev.streams : [new MediaStream([ev.track])];
        setPeers((prev) => {
          const next = new Map(prev);
          const e = next.get(remoteId);
          if (e) next.set(remoteId, { ...e, stream: remote });
          return next;
        });
        const entry = peersRef.current.get(remoteId);
        if (entry) entry.stream = remote;
      };

      pc.onicecandidate = (ev) => {
        if (!ev.candidate) return;
        wsRef.current?.readyState === WebSocket.OPEN &&
          wsRef.current.send(
            JSON.stringify({ type: "ice", to: remoteId, from: user!.id, candidate: ev.candidate })
          );
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          removePeer(remoteId);
        }
      };

      const entry: PeerEntry = { userId: remoteId, pc, stream: null, micOn: true, camOn: true };
      peersRef.current.set(remoteId, entry);
      setPeers((prev) => new Map(prev).set(remoteId, entry));

      if (!polite) {
        pc.createOffer().then((offer) => pc.setLocalDescription(offer)).then(() => {
          wsRef.current?.send(
            JSON.stringify({ type: "offer", to: remoteId, from: user!.id, sdp: pc.localDescription })
          );
        }).catch(() => {/* ignore */});
      }

      return pc;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user]
  );

  function removePeer(uid: string) {
    const entry = peersRef.current.get(uid);
    if (entry) { entry.pc.close(); peersRef.current.delete(uid); }
    setPeers((prev) => { const next = new Map(prev); next.delete(uid); return next; });
  }

  /* ── WebSocket signaling ────────────────────────────────────── */
  useEffect(() => {
    if (!user || !token) return;

    const wsBase = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080").replace(/^http/, "ws");
    const ws = new WebSocket(`${wsBase}/ws/signal?room_id=${params.id}&user_id=${user.id}`);
    wsRef.current = ws;

    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => setWsConnected(false);

    ws.onmessage = async (ev) => {
      let msg: Record<string, unknown>;
      try { msg = JSON.parse(ev.data as string); } catch { return; }
      const { type, from: fromId } = msg as { type: string; from: string };
      if (!fromId || fromId === user.id) return;

      if (type === "join") {
        createPeer(fromId, false);
      } else if (type === "leave") {
        removePeer(fromId);
      } else if (type === "offer") {
        const pc = createPeer(fromId, true);
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp as RTCSessionDescriptionInit));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ws.send(JSON.stringify({ type: "answer", to: fromId, from: user.id, sdp: pc.localDescription }));
        } catch {/* ignore */}
      } else if (type === "answer") {
        const entry = peersRef.current.get(fromId);
        if (entry?.pc.signalingState === "have-local-offer") {
          try { await entry.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp as RTCSessionDescriptionInit)); }
          catch {/* ignore */}
        }
      } else if (type === "ice") {
        const entry = peersRef.current.get(fromId);
        if (entry && msg.candidate) {
          try { await entry.pc.addIceCandidate(new RTCIceCandidate(msg.candidate as RTCIceCandidateInit)); }
          catch {/* ignore */}
        }
      }
    };

    return () => {
      ws.close();
      peersRef.current.forEach((e) => e.pc.close());
      peersRef.current.clear();
      setPeers(new Map());
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token, params.id]);

  /* ── Chat ───────────────────────────────────────────────────── */
  const loadMessages = useCallback(async () => {
    try {
      const res = await api.get<Message[]>(`/api/chat/${params.id}`);
      setMessages(res.data);
    } catch {/* ignore */}
  }, [params.id]);

  useEffect(() => {
    loadMessages();
    const id = setInterval(loadMessages, 4000);
    return () => clearInterval(id);
  }, [loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
      setChatInput(text);
    } finally {
      setSending(false);
    }
  };

  /* ── Screen share ───────────────────────────────────────────── */
  const shareScreen = async () => {
    try {
      const ss = await (navigator.mediaDevices as typeof navigator.mediaDevices & {
        getDisplayMedia(c: MediaStreamConstraints): Promise<MediaStream>;
      }).getDisplayMedia({ video: true });
      const track = ss.getVideoTracks()[0];
      peersRef.current.forEach(({ pc }) => {
        const s = pc.getSenders().find((x) => x.track?.kind === "video");
        if (s) s.replaceTrack(track);
      });
      track.onended = () => {
        const camTrack = localStreamRef.current?.getVideoTracks()[0] ?? null;
        peersRef.current.forEach(({ pc }) => {
          const s = pc.getSenders().find((x) => x.track?.kind === "video");
          if (s && camTrack) s.replaceTrack(camTrack);
        });
      };
    } catch {/* cancelled */}
  };

  if (!token) return null;

  const roomName = room?.name ?? `Room ${params.id.slice(0, 8)}`;
  const peerList = Array.from(peers.values());
  const totalCount = peerList.length + 1;
  const gridClass =
    totalCount === 1 ? "vg-solo"
    : totalCount === 2 ? "vg-duo"
    : totalCount <= 4 ? "vg-quad"
    : "vg-many";

  return (
    <div className="room-shell">
      {/* ── Header ───────────────────────────────────────────── */}
      <header className="room-header">
        <div className="rh-left">
          <button className="rh-back-btn" onClick={() => router.push("/dashboard")} title="Back">
            <BackArrowIcon />
          </button>
          <div className="rh-divider" />
          <div className="rh-room-info">
            <div className="rh-room-name">
              {room?.is_private === 1 && <span className="rh-lock"><LockSmIcon /></span>}
              {roomName}
            </div>
            <div className="rh-room-sub">
              <span
                className="rh-signal-dot"
                style={{ background: wsConnected ? "var(--success)" : "var(--warning)" }}
              />
              <span style={{ color: wsConnected ? "var(--success)" : "var(--warning)", fontSize: 11 }}>
                {wsConnected ? "Live" : "Connecting…"}
              </span>
              <span className="rh-sep">·</span>
              <span className="rh-room-id">{params.id.slice(0, 8)}…</span>
            </div>
          </div>
        </div>

        <div className="rh-right">
          <div className="rh-pill">
            <PeopleIcon />
            <span>{totalCount} in room</span>
          </div>
          <button
            className={`rh-chat-btn${chatOpen ? " active" : ""}`}
            onClick={() => setChatOpen((v) => !v)}
            title="Toggle chat"
          >
            <ChatBubbleIcon />
            {messages.length > 0 && (
              <span className="rh-badge">{messages.length > 99 ? "99+" : messages.length}</span>
            )}
          </button>
          <button className="rh-leave" onClick={() => router.push("/dashboard")}>
            <PhoneOffIcon />
            <span>Leave</span>
          </button>
        </div>
      </header>

      {/* ── Body ─────────────────────────────────────────────── */}
      <div className="room-body-v2">
        {/* Video grid */}
        <div className={`video-grid-v2 ${gridClass}`}>
          <VideoTile
            stream={localStream}
            label={user?.username ?? "You"}
            userId={user?.id ?? "local"}
            isLocal
            micOn={micOn}
            camOn={camOn}
          />
          {peerList.map((peer) => (
            <VideoTile
              key={peer.userId}
              stream={peer.stream}
              label={peer.userId.slice(0, 10)}
              userId={peer.userId}
              micOn={peer.micOn}
              camOn={peer.camOn}
            />
          ))}
          {totalCount === 1 && (
            <div className="vt-waiting">
              <div className="vt-waiting-inner">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <p className="vt-waiting-text">Waiting for others to join…</p>
                <p className="vt-waiting-hint">Share the room ID to invite</p>
                <span className="vt-waiting-id">{params.id.slice(0, 8)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Chat panel */}
        {chatOpen && (
          <aside className="chat-panel">
            <div className="cp-header">
              <ChatBubbleIcon />
              <span>Room Chat</span>
              {messages.length > 0 && <span className="cp-count">{messages.length}</span>}
            </div>

            <div className="cp-messages">
              {messages.length === 0 ? (
                <div className="cp-empty">
                  <ChatBubbleIcon />
                  <span>No messages yet</span>
                  <span className="cp-empty-hint">Be the first to say something</span>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.user_id === user?.id;
                  const initChar = isMine
                    ? (user?.username?.charAt(0).toUpperCase() ?? "?")
                    : msg.user_id.charAt(0).toUpperCase();
                  return (
                    <div key={msg.id} className={`cp-msg${isMine ? " cp-mine" : ""}`}>
                      {!isMine && (
                        <div className="cp-avatar" style={{ background: avatarColor(msg.user_id) }}>
                          {initChar}
                        </div>
                      )}
                      <div className="cp-msg-body">
                        {!isMine && (
                          <span className="cp-author">{msg.user_id.slice(0, 8)}</span>
                        )}
                        <div className={`cp-bubble${isMine ? " mine" : ""}`}>{msg.content}</div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <form className="cp-form" onSubmit={sendMessage}>
              <input
                type="text"
                placeholder="Message room…"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={sending}
                autoComplete="off"
              />
              <button
                type="submit"
                className="cp-send"
                disabled={sending || !chatInput.trim()}
                title="Send"
              >
                {sending ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <SendIcon />}
              </button>
            </form>
          </aside>
        )}
      </div>

      {/* ── Controls ─────────────────────────────────────────── */}
      <div className="controls-v2">
        <button
          className={`ctrl-v2${micOn ? "" : " ctrl-v2-off"}`}
          onClick={() => setMicOn((v) => !v)}
          title={micOn ? "Mute" : "Unmute"}
        >
          <MicIcon off={!micOn} />
          <span>{micOn ? "Mute" : "Unmuted"}</span>
        </button>

        <button
          className={`ctrl-v2${camOn ? "" : " ctrl-v2-off"}`}
          onClick={() => setCamOn((v) => !v)}
          title={camOn ? "Stop Camera" : "Start Camera"}
        >
          <CamIcon off={!camOn} />
          <span>{camOn ? "Stop Cam" : "Start Cam"}</span>
        </button>

        <button className="ctrl-v2" onClick={shareScreen} title="Share screen">
          <ScreenIcon />
          <span>Share</span>
        </button>

        <span className="ctrl-sep" />

        <button className="ctrl-v2 ctrl-v2-danger" onClick={() => router.push("/dashboard")}>
          <PhoneOffIcon />
          <span>Leave</span>
        </button>
      </div>
    </div>
  );
}
