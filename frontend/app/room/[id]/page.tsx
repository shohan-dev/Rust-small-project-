"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "../../../services/api";
import { useAuthStore } from "../../../store/auth";
import type { Message } from "../../../types/api";

interface PeerView {
  userId: string;
  stream: MediaStream;
  micOn: boolean;
  camOn: boolean;
  connectionState: RTCPeerConnectionState;
}

interface PeerRuntime {
  userId: string;
  pc: RTCPeerConnection;
  stream: MediaStream;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  isSettingRemoteAnswerPending: boolean;
}

type SignalMessage = {
  type: string;
  roomId?: string;
  userId?: string;
  from?: string;
  to?: string;
  users?: string[];
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

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
  for (let i = 0; i < uid.length; i += 1) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function getWsBaseUrl() {
  const rawBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? api.defaults.baseURL ?? "http://127.0.0.1:8080";
  return rawBase.replace(/^http/i, "ws").replace(/\/$/, "");
}

function formatParticipantLabel(userId: string, currentUserId?: string) {
  if (userId === currentUserId) return "You";
  return userId.length > 12 ? `${userId.slice(0, 8)}…${userId.slice(-4)}` : userId;
}

function VideoTile({
  stream,
  label,
  userId,
  isLocal,
  micOn,
  camOn,
  status,
}: {
  stream: MediaStream | null;
  label: string;
  userId: string;
  isLocal?: boolean;
  micOn: boolean;
  camOn: boolean;
  status?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  const initial = label.charAt(0).toUpperCase() || "?";
  const hasVideo = Boolean(stream && stream.getVideoTracks().length > 0 && camOn);

  return (
    <div className={`vt-tile${isLocal ? " vt-local" : ""}`}>
      {hasVideo ? (
        <video ref={videoRef} autoPlay playsInline muted={isLocal} className="vt-video" />
      ) : (
        <div className="vt-placeholder">
          <div className="vt-avatar" style={{ background: avatarColor(userId) }}>
            {initial}
          </div>
          <span className="vt-cam-label">{camOn ? "Joining video…" : "Camera off"}</span>
        </div>
      )}

      <div className="vt-overlay">
        <span className="vt-name">
          {label}
          {isLocal && <span className="vt-you-tag">you</span>}
        </span>
        <span className="vt-icons">
          {!micOn && <span className="vt-icon-badge">Mic off</span>}
          {!camOn && <span className="vt-icon-badge">Cam off</span>}
          {status && <span className="vt-icon-badge">{status}</span>}
        </span>
      </div>
    </div>
  );
}

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

export default function RoomPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { token, user, rooms } = useAuthStore();
  const room = useMemo(() => rooms.find((entry) => entry.id === params.id), [rooms, params.id]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [mediaReady, setMediaReady] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [statusText, setStatusText] = useState("Preparing camera and microphone…");

  const localStreamRef = useRef<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const peersRef = useRef<Map<string, PeerRuntime>>(new Map());
  const [peerViews, setPeerViews] = useState<Map<string, PeerView>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);

  const roomName = room?.name ?? `Room ${params.id.slice(0, 8)}`;
  const peerList = useMemo(() => Array.from(peerViews.values()), [peerViews]);
  const totalCount = peerList.length + 1;
  const gridClass =
    totalCount === 1 ? "vg-solo" : totalCount === 2 ? "vg-duo" : totalCount <= 4 ? "vg-quad" : "vg-many";

  const updatePeerView = useCallback((peer: PeerRuntime) => {
    const remoteVideoTracks = peer.stream.getVideoTracks();
    const remoteAudioTracks = peer.stream.getAudioTracks();

    setPeerViews((prev) => {
      const next = new Map(prev);
      next.set(peer.userId, {
        userId: peer.userId,
        stream: peer.stream,
        camOn: remoteVideoTracks.length > 0 && remoteVideoTracks.some((track) => track.readyState === "live"),
        micOn: remoteAudioTracks.length > 0 && remoteAudioTracks.some((track) => track.readyState === "live"),
        connectionState: peer.pc.connectionState,
      });
      return next;
    });
  }, []);

  const removePeer = useCallback((remoteId: string) => {
    const runtime = peersRef.current.get(remoteId);
    if (runtime) {
      runtime.pc.onicecandidate = null;
      runtime.pc.ontrack = null;
      runtime.pc.onnegotiationneeded = null;
      runtime.pc.onconnectionstatechange = null;
      runtime.pc.close();
      peersRef.current.delete(remoteId);
    }

    setPeerViews((prev) => {
      const next = new Map(prev);
      next.delete(remoteId);
      return next;
    });
  }, []);

  const sendSignal = useCallback((payload: SignalMessage) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify(payload));
  }, []);

  const ensurePeer = useCallback(
    (remoteId: string) => {
      const existing = peersRef.current.get(remoteId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const stream = new MediaStream();
      const polite = (user?.id ?? "") > remoteId;
      const runtime: PeerRuntime = {
        userId: remoteId,
        pc,
        stream,
        polite,
        makingOffer: false,
        ignoreOffer: false,
        isSettingRemoteAnswerPending: false,
      };

      peersRef.current.set(remoteId, runtime);

      localStreamRef.current?.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current as MediaStream);
      });

      pc.ontrack = (event) => {
        event.streams[0]?.getTracks().forEach((track) => {
          const alreadyAttached = runtime.stream.getTracks().some((existingTrack) => existingTrack.id === track.id);
          if (!alreadyAttached) runtime.stream.addTrack(track);

          track.onmute = () => updatePeerView(runtime);
          track.onunmute = () => updatePeerView(runtime);
          track.onended = () => updatePeerView(runtime);
        });

        updatePeerView(runtime);
      };

      pc.onicecandidate = ({ candidate }) => {
        if (!candidate || !user) return;
        sendSignal({
          type: "ice",
          from: user.id,
          to: remoteId,
          candidate: candidate.toJSON(),
        });
      };

      pc.onconnectionstatechange = () => {
        updatePeerView(runtime);
        if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
          window.setTimeout(() => removePeer(remoteId), 400);
        }
      };

      pc.onnegotiationneeded = async () => {
        if (!user || user.id > remoteId) return;

        try {
          runtime.makingOffer = true;
          await pc.setLocalDescription();

          if (pc.localDescription) {
            sendSignal({
              type: pc.localDescription.type,
              from: user.id,
              to: remoteId,
              sdp: pc.localDescription.toJSON(),
            });
          }
        } catch {
          // ignore transient glare or teardown race
        } finally {
          runtime.makingOffer = false;
        }
      };

      updatePeerView(runtime);
      return runtime;
    },
    [removePeer, sendSignal, updatePeerView, user]
  );

  const syncLocalTracks = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;

    peersRef.current.forEach((runtime) => {
      const senders = runtime.pc.getSenders();

      stream.getTracks().forEach((track) => {
        const existingSender = senders.find((sender) => sender.track?.kind === track.kind);
        if (existingSender) {
          void existingSender.replaceTrack(track);
        } else {
          runtime.pc.addTrack(track, stream);
        }
      });
    });
  }, []);

  useEffect(() => {
    if (!token) router.push("/login");
  }, [router, token]);

  useEffect(() => {
    let cancelled = false;

    const setupMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 24, max: 30 },
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        localStreamRef.current = stream;
        setLocalStream(stream);
        setStatusText("Media ready. Connecting to room…");
      } catch {
        if (cancelled) return;

        const fallback = new MediaStream();
        localStreamRef.current = fallback;
        setLocalStream(fallback);
        setMicOn(false);
        setCamOn(false);
        setStatusText("Joined without camera or microphone access.");
      } finally {
        if (!cancelled) setMediaReady(true);
      }
    };

    void setupMedia();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = micOn;
    });
  }, [micOn]);

  useEffect(() => {
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = camOn;
    });
  }, [camOn]);

  useEffect(() => {
    if (!mediaReady) return;
    syncLocalTracks();
  }, [localStream, mediaReady, syncLocalTracks]);

  useEffect(() => {
    if (!mediaReady || !user || !token) return;

    const ws = new WebSocket(`${getWsBaseUrl()}/ws?room_id=${encodeURIComponent(params.id)}&user_id=${encodeURIComponent(user.id)}`);
    wsRef.current = ws;
    setStatusText("Connecting to room…");

    ws.onopen = () => {
      setWsConnected(true);
      setStatusText("Connected. Waiting for participants…");
    };

    ws.onclose = () => {
      setWsConnected(false);
      setStatusText("Disconnected from signaling server.");
    };

    ws.onerror = () => {
      setStatusText("Realtime signaling error. Rejoin the room if calls stop.");
    };

    ws.onmessage = async (event) => {
      let msg: SignalMessage;

      try {
        msg = JSON.parse(event.data as string) as SignalMessage;
      } catch {
        return;
      }

      const sourceId = msg.from ?? msg.userId;
      if (msg.to && msg.to !== user.id) return;
      if (sourceId === user.id) return;

      if (msg.type === "participants") {
        msg.users?.filter(Boolean).forEach((participantId) => {
          if (participantId !== user.id) ensurePeer(participantId);
        });
        setStatusText(msg.users && msg.users.length > 0 ? "Participants connected." : "Waiting for participants…");
        return;
      }

      if (!sourceId) return;

      if (msg.type === "join") {
        ensurePeer(sourceId);
        setStatusText("Participant joined the room.");
        return;
      }

      if (msg.type === "leave") {
        removePeer(sourceId);
        setStatusText("Participant left the room.");
        return;
      }

      const runtime = ensurePeer(sourceId);
      const description = msg.sdp;

      if (description) {
        const readyForOffer =
          !runtime.makingOffer &&
          (runtime.pc.signalingState === "stable" || runtime.isSettingRemoteAnswerPending);
        const offerCollision = description.type === "offer" && !readyForOffer;

        runtime.ignoreOffer = !runtime.polite && offerCollision;
        if (runtime.ignoreOffer) return;

        runtime.isSettingRemoteAnswerPending = description.type === "answer";

        try {
          await runtime.pc.setRemoteDescription(description);
        } catch {
          runtime.isSettingRemoteAnswerPending = false;
          return;
        }

        runtime.isSettingRemoteAnswerPending = false;

        if (description.type === "offer") {
          try {
            await runtime.pc.setLocalDescription();
            if (runtime.pc.localDescription) {
              sendSignal({
                type: runtime.pc.localDescription.type,
                from: user.id,
                to: sourceId,
                sdp: runtime.pc.localDescription.toJSON(),
              });
            }
          } catch {
            // ignore shutdown race
          }
        }

        return;
      }

      if (msg.candidate) {
        try {
          await runtime.pc.addIceCandidate(msg.candidate);
        } catch {
          if (!runtime.ignoreOffer) {
            // ignore race during teardown only
          }
        }
      }
    };

    return () => {
      wsRef.current = null;
      ws.close();
      setWsConnected(false);

      Array.from(peersRef.current.keys()).forEach((peerId) => {
        removePeer(peerId);
      });

      peersRef.current.clear();
      setPeerViews(new Map());
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [ensurePeer, mediaReady, params.id, removePeer, sendSignal, token, user]);

  const loadMessages = useCallback(async () => {
    try {
      const response = await api.get<Message[]>(`/api/chat/${params.id}`);
      setMessages(response.data);
    } catch {
      // keep latest good state
    }
  }, [params.id]);

  useEffect(() => {
    void loadMessages();
    const intervalId = window.setInterval(() => {
      void loadMessages();
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, [loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!chatInput.trim() || sending) return;

    const text = chatInput.trim();
    setSending(true);
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

  const shareScreen = async () => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 15, max: 24 } },
        audio: false,
      });

      const screenTrack = displayStream.getVideoTracks()[0];
      if (!screenTrack) return;

      peersRef.current.forEach((runtime) => {
        const sender = runtime.pc.getSenders().find((entry) => entry.track?.kind === "video");
        if (sender) void sender.replaceTrack(screenTrack);
      });

      screenTrack.onended = () => {
        const cameraTrack = localStreamRef.current?.getVideoTracks()[0] ?? null;
        peersRef.current.forEach((runtime) => {
          const sender = runtime.pc.getSenders().find((entry) => entry.track?.kind === "video");
          if (sender) void sender.replaceTrack(cameraTrack);
        });
      };
    } catch {
      // user cancelled screen share
    }
  };

  if (!token) return null;

  return (
    <div className="room-shell">
      <header className="room-header">
        <div className="rh-left">
          <button className="rh-back-btn" onClick={() => router.push("/dashboard")} title="Back to dashboard">
            <BackArrowIcon />
          </button>
          <div className="rh-divider" />
          <div className="rh-room-info">
            <div className="rh-room-name">
              {room?.is_private === 1 && (
                <span className="rh-lock">
                  <LockSmIcon />
                </span>
              )}
              {roomName}
            </div>
            <div className="rh-room-sub">
              <span className="rh-signal-dot" style={{ background: wsConnected ? "var(--success)" : "var(--warning)" }} />
              <span style={{ color: wsConnected ? "var(--success)" : "var(--warning)", fontSize: 11 }}>
                {wsConnected ? "Live" : "Connecting…"}
              </span>
              <span className="rh-sep">·</span>
              <span className="rh-room-id">{params.id.slice(0, 8)}…</span>
              <span className="rh-sep">·</span>
              <span>{statusText}</span>
            </div>
          </div>
        </div>

        <div className="rh-right">
          <div className="rh-pill">
            <PeopleIcon />
            <span>{totalCount} in room</span>
          </div>
          <button className={`rh-chat-btn${chatOpen ? " active" : ""}`} onClick={() => setChatOpen((value) => !value)} title="Toggle chat panel">
            <ChatBubbleIcon />
            {messages.length > 0 && <span className="rh-badge">{messages.length > 99 ? "99+" : messages.length}</span>}
          </button>
          <button className="rh-leave" onClick={() => router.push("/dashboard")}>
            <PhoneOffIcon />
            <span>Leave</span>
          </button>
        </div>
      </header>

      <div className="room-body-v2">
        <div className={`video-grid-v2 ${gridClass}`}>
          <VideoTile
            stream={localStream}
            label={formatParticipantLabel(user?.id ?? "local", user?.id)}
            userId={user?.id ?? "local"}
            isLocal
            micOn={micOn}
            camOn={camOn}
            status={localStream?.getTracks().length ? undefined : "No media"}
          />

          {peerList.map((peer) => (
            <VideoTile
              key={peer.userId}
              stream={peer.stream}
              label={formatParticipantLabel(peer.userId, user?.id)}
              userId={peer.userId}
              micOn={peer.micOn}
              camOn={peer.camOn}
              status={peer.connectionState === "connected" ? undefined : peer.connectionState}
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
                <p className="vt-waiting-hint">Share the room ID to invite your team</p>
                <span className="vt-waiting-id">{params.id.slice(0, 8)}</span>
              </div>
            </div>
          )}
        </div>

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
                    ? user?.username?.charAt(0).toUpperCase() ?? "?"
                    : msg.user_id.charAt(0).toUpperCase();

                  return (
                    <div key={msg.id} className={`cp-msg${isMine ? " cp-mine" : ""}`}>
                      {!isMine && (
                        <div className="cp-avatar" style={{ background: avatarColor(msg.user_id) }}>
                          {initChar}
                        </div>
                      )}
                      <div className="cp-msg-body">
                        {!isMine && <span className="cp-author">{formatParticipantLabel(msg.user_id, user?.id)}</span>}
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
                onChange={(event) => setChatInput(event.target.value)}
                disabled={sending}
                autoComplete="off"
              />
              <button type="submit" className="cp-send" disabled={sending || !chatInput.trim()} title="Send message">
                {sending ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <SendIcon />}
              </button>
            </form>
          </aside>
        )}
      </div>

      <div className="controls-v2">
        <button className={`ctrl-v2${micOn ? "" : " ctrl-v2-off"}`} onClick={() => setMicOn((value) => !value)} title={micOn ? "Mute microphone" : "Unmute microphone"}>
          <MicIcon off={!micOn} />
          <span>{micOn ? "Mute" : "Unmute"}</span>
        </button>

        <button className={`ctrl-v2${camOn ? "" : " ctrl-v2-off"}`} onClick={() => setCamOn((value) => !value)} title={camOn ? "Stop camera" : "Start camera"}>
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
