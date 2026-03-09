"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "../../../services/api";
import { useAuthStore } from "../../../store/auth";
import type { Message } from "../../../types/api";

/* ─── Types ──────────────────────────────────────────────────── */

interface PeerView {
  userId: string;
  stream: MediaStream;
  micOn: boolean;
  camOn: boolean;
  isScreenSharing: boolean;
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
  micOn: boolean;
  camOn: boolean;
  isScreenSharing: boolean;
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
  micOn?: boolean;
  camOn?: boolean;
  isScreenSharing?: boolean;
};

/* ─── Constants ──────────────────────────────────────────────── */

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

/* ─── VideoTile ──────────────────────────────────────────────── */

function VideoTile({
  stream,
  label,
  userId,
  isLocal,
  micOn,
  camOn,
  isScreenSharing,
  status,
}: {
  stream: MediaStream | null;
  label: string;
  userId: string;
  isLocal?: boolean;
  micOn: boolean;
  camOn: boolean;
  isScreenSharing?: boolean;
  status?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  const initial = label.charAt(0).toUpperCase() || "?";
  const hasVideo = Boolean(stream && stream.getVideoTracks().length > 0 && (camOn || isScreenSharing));

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
          {!camOn && !isScreenSharing && <span className="vt-icon-badge">Cam off</span>}
          {isScreenSharing && <span className="vt-icon-badge">Presenting</span>}
          {status && <span className="vt-icon-badge">{status}</span>}
        </span>
      </div>
    </div>
  );
}

/* ─── Icons ──────────────────────────────────────────────────── */

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

/* ─── Media Constraints ──────────────────────────────────────── */

const MEDIA_CONSTRAINTS: MediaStreamConstraints = {
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
};

/* ═══════════════════════════════════════════════════════════════
   RoomPage — complete multi-peer WebRTC with perfect negotiation
   ═══════════════════════════════════════════════════════════════ */

export default function RoomPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { token, user, rooms } = useAuthStore();
  const room = useMemo(() => rooms.find((r) => r.id === params.id), [rooms, params.id]);

  /* ── Chat state ─────────────────────────────────────────────── */
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /* ── Media-control state ────────────────────────────────────── */
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  /* ── Connection state ───────────────────────────────────────── */
  const [mediaReady, setMediaReady] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [statusText, setStatusText] = useState("Preparing camera and microphone…");

  /* ── Media track refs ───────────────────────────────────────── */
  const audioTrackRef = useRef<MediaStreamTrack | null>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  /* ── Peer / WS refs ─────────────────────────────────────────── */
  const peersRef = useRef<Map<string, PeerRuntime>>(new Map());
  const [peerViews, setPeerViews] = useState<Map<string, PeerView>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);

  /* ── Stable refs for values used inside callbacks / effects ─── */
  const userRef = useRef(user);
  userRef.current = user;
  const micOnRef = useRef(micOn);
  micOnRef.current = micOn;
  const camOnRef = useRef(camOn);
  camOnRef.current = camOn;
  const screenSharingRef = useRef(isScreenSharing);
  screenSharingRef.current = isScreenSharing;

  /* ── Derived ────────────────────────────────────────────────── */
  const roomName = room?.name ?? `Room ${params.id.slice(0, 8)}`;
  const peerList = useMemo(() => Array.from(peerViews.values()), [peerViews]);
  const totalCount = peerList.length + 1;
  const gridClass =
    totalCount === 1 ? "vg-solo" : totalCount === 2 ? "vg-duo" : totalCount <= 4 ? "vg-quad" : "vg-many";

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     Stable helper callbacks (all deps are [] or other stable fns)
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

  /** Build the local composite MediaStream from current track refs. */
  const buildCompositeStream = useCallback(() => {
    const stream = new MediaStream();
    if (audioTrackRef.current && audioTrackRef.current.readyState === "live") {
      stream.addTrack(audioTrackRef.current);
    }
    const videoTrack = screenTrackRef.current ?? cameraTrackRef.current;
    if (videoTrack && videoTrack.readyState === "live") {
      stream.addTrack(videoTrack);
    }
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

  /** Find an RTP sender by track kind, falling back to transceiver receiver kind. */
  const findSender = useCallback((pc: RTCPeerConnection, kind: "audio" | "video"): RTCRtpSender | null => {
    const directSender = pc.getSenders().find((s) => s.track?.kind === kind);
    if (directSender) return directSender;
    const transceiver = pc.getTransceivers().find((t) => t.receiver.track.kind === kind);
    return transceiver?.sender ?? null;
  }, []);

  /** Flush a PeerRuntime snapshot into the React peerViews state for rendering. */
  const updatePeerView = useCallback((peer: PeerRuntime) => {
    setPeerViews((prev) => {
      const next = new Map(prev);
      next.set(peer.userId, {
        userId: peer.userId,
        stream: peer.stream,
        micOn: peer.micOn,
        camOn: peer.camOn,
        isScreenSharing: peer.isScreenSharing,
        connectionState: peer.pc.connectionState,
      });
      return next;
    });
  }, []);

  /** Tear down a peer connection and remove from maps. */
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

  /** Send a JSON signaling message through the WebSocket. */
  const sendSignal = useCallback((payload: object) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify(payload));
  }, []);

  /** Replace/add local tracks on every peer connection. */
  const syncLocalMediaToPeers = useCallback(() => {
    const compositeStream = buildCompositeStream();
    const audioTrack = audioTrackRef.current;
    const videoTrack = screenTrackRef.current ?? cameraTrackRef.current;

    peersRef.current.forEach((runtime) => {
      const audioSender = findSender(runtime.pc, "audio");
      const videoSender = findSender(runtime.pc, "video");

      if (audioSender) {
        void audioSender.replaceTrack(audioTrack);
      } else if (audioTrack) {
        runtime.pc.addTrack(audioTrack, compositeStream);
      }

      if (videoSender) {
        void videoSender.replaceTrack(videoTrack);
      } else if (videoTrack) {
        runtime.pc.addTrack(videoTrack, compositeStream);
      }
    });
  }, [buildCompositeStream, findSender]);

  /**
   * Publish current mic/cam/screen state to all peers.
   * Reads from REFS so the callback identity is stable and never triggers
   * effect re-runs.
   */
  const publishMediaState = useCallback(
    (overrides?: { micOn?: boolean; camOn?: boolean; isScreenSharing?: boolean }) => {
      const uid = userRef.current?.id;
      if (!uid) return;
      sendSignal({
        type: "media-state",
        from: uid,
        micOn: overrides?.micOn ?? micOnRef.current,
        camOn: overrides?.camOn ?? camOnRef.current,
        isScreenSharing: overrides?.isScreenSharing ?? screenSharingRef.current,
      });
    },
    [sendSignal],
  );

  /* ── Track acquisition helpers ─────────────────────────────── */

  const ensureAudioTrack = useCallback(async () => {
    if (audioTrackRef.current && audioTrackRef.current.readyState === "live") {
      return audioTrackRef.current;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: MEDIA_CONSTRAINTS.audio, video: false });
    const track = stream.getAudioTracks()[0] ?? null;
    if (track) {
      track.enabled = true;
      audioTrackRef.current = track;
      track.onended = () => {
        if (audioTrackRef.current?.id === track.id) {
          audioTrackRef.current = null;
          setMicOn(false);
        }
      };
    }
    return track;
  }, []);

  const ensureCameraTrack = useCallback(async () => {
    if (cameraTrackRef.current && cameraTrackRef.current.readyState === "live") {
      return cameraTrackRef.current;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: MEDIA_CONSTRAINTS.video });
    const track = stream.getVideoTracks()[0] ?? null;
    if (track) {
      track.enabled = true;
      track.contentHint = "motion";
      cameraTrackRef.current = track;
      track.onended = () => {
        if (cameraTrackRef.current?.id === track.id) {
          cameraTrackRef.current = null;
          setCamOn(false);
          syncLocalMediaToPeers();
          publishMediaState({ camOn: false });
        }
      };
    }
    return track;
  }, [syncLocalMediaToPeers, publishMediaState]);

  const stopScreenShare = useCallback(
    (fromTrackEnd = false) => {
      const track = screenTrackRef.current;
      screenTrackRef.current = null;
      setIsScreenSharing(false);
      if (track) {
        track.onended = null;
        if (!fromTrackEnd) track.stop();
      }
      // Restore camera if it was on (read from ref for stable closure).
      if (cameraTrackRef.current) cameraTrackRef.current.enabled = camOnRef.current;
      syncLocalMediaToPeers();
      publishMediaState({ isScreenSharing: false });
    },
    [syncLocalMediaToPeers, publishMediaState],
  );

  /* ── Peer creation (uses refs — no state deps) ─────────────── */

  const ensurePeer = useCallback(
    (remoteId: string): PeerRuntime => {
      const existing = peersRef.current.get(remoteId);
      if (existing) return existing;

      const uid = userRef.current?.id ?? "";
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const compositeStream = localStreamRef.current ?? new MediaStream();

      const runtime: PeerRuntime = {
        userId: remoteId,
        pc,
        stream: new MediaStream(),
        polite: uid > remoteId,
        makingOffer: false,
        ignoreOffer: false,
        isSettingRemoteAnswerPending: false,
        micOn: true,
        camOn: true,
        isScreenSharing: false,
      };

      peersRef.current.set(remoteId, runtime);

      // Feed local tracks into the peer connection.
      const localTracks = compositeStream.getTracks();
      if (localTracks.length > 0) {
        localTracks.forEach((track) => pc.addTrack(track, compositeStream));
      } else {
        // No local media — add recvonly transceivers so negotiation still starts
        // and we can receive remote audio/video.
        pc.addTransceiver("audio", { direction: "recvonly" });
        pc.addTransceiver("video", { direction: "recvonly" });
      }

      /* ontrack — accumulate remote tracks into runtime.stream */
      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        const addTrack = (track: MediaStreamTrack) => {
          if (!runtime.stream.getTracks().some((t) => t.id === track.id)) {
            runtime.stream.addTrack(track);
          }
          track.onended = () => updatePeerView(runtime);
          track.onmute = () => updatePeerView(runtime);
          track.onunmute = () => updatePeerView(runtime);
        };

        if (remoteStream) {
          remoteStream.getTracks().forEach(addTrack);
        } else {
          addTrack(event.track);
        }
        updatePeerView(runtime);
      };

      /* ICE candidates */
      pc.onicecandidate = ({ candidate }) => {
        if (!candidate) return;
        sendSignal({ type: "ice", from: uid, to: remoteId, candidate: candidate.toJSON() });
      };

      /* Connection state — ICE restart on failure, remove on close */
      pc.onconnectionstatechange = () => {
        updatePeerView(runtime);
        if (pc.connectionState === "failed") {
          pc.restartIce();
        } else if (pc.connectionState === "closed") {
          removePeer(remoteId);
        }
      };

      /**
       * Negotiation-needed — BOTH sides may generate offers.
       * The "perfect negotiation" pattern handles collisions via
       * polite / impolite roles.
       */
      pc.onnegotiationneeded = async () => {
        try {
          runtime.makingOffer = true;
          await pc.setLocalDescription();
          if (pc.localDescription) {
            sendSignal({
              type: pc.localDescription.type,
              from: uid,
              to: remoteId,
              sdp: pc.localDescription.toJSON(),
            });
          }
        } catch {
          // Ignore — PC may have been closed during negotiation.
        } finally {
          runtime.makingOffer = false;
        }
      };

      updatePeerView(runtime);

      // Immediately tell the new peer our media state.
      sendSignal({
        type: "media-state",
        from: uid,
        to: remoteId,
        micOn: micOnRef.current,
        camOn: camOnRef.current,
        isScreenSharing: screenSharingRef.current,
      });

      return runtime;
    },
    [buildCompositeStream, removePeer, sendSignal, updatePeerView],
  );

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     Effects
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

  /* 1. Auth guard */
  useEffect(() => {
    if (!token) router.push("/login");
  }, [router, token]);

  /* 2. Acquire local media (runs once) */
  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(MEDIA_CONSTRAINTS);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const audioTrack = stream.getAudioTracks()[0] ?? null;
        const videoTrack = stream.getVideoTracks()[0] ?? null;

        if (audioTrack) {
          audioTrack.enabled = true;
          audioTrackRef.current = audioTrack;
          audioTrack.onended = () => {
            if (audioTrackRef.current?.id === audioTrack.id) {
              audioTrackRef.current = null;
              setMicOn(false);
            }
          };
        }

        if (videoTrack) {
          videoTrack.enabled = true;
          videoTrack.contentHint = "motion";
          cameraTrackRef.current = videoTrack;
          videoTrack.onended = () => {
            if (cameraTrackRef.current?.id === videoTrack.id) {
              cameraTrackRef.current = null;
              setCamOn(false);
            }
          };
        }

        buildCompositeStream();
        setStatusText("Media ready. Connecting to room…");
      } catch {
        if (cancelled) return;
        buildCompositeStream();
        setMicOn(false);
        setCamOn(false);
        setStatusText("Joined without camera or microphone access.");
      } finally {
        if (!cancelled) setMediaReady(true);
      }
    };

    void setup();
    return () => {
      cancelled = true;
    };
    // buildCompositeStream is stable (no deps).
  }, [buildCompositeStream]);

  /* 3. Keep track .enabled in sync with toggle state */
  useEffect(() => {
    if (audioTrackRef.current) audioTrackRef.current.enabled = micOn;
  }, [micOn]);

  useEffect(() => {
    if (cameraTrackRef.current && !screenSharingRef.current) {
      cameraTrackRef.current.enabled = camOn;
    }
  }, [camOn]);

  /* 4. Publish media state to peers whenever controls change */
  useEffect(() => {
    if (!wsConnected) return;
    publishMediaState();
  }, [micOn, camOn, isScreenSharing, wsConnected, publishMediaState]);

  /* 5. WebSocket connection + signaling
   *    Dependencies are ONLY things that change once or are stable.
   *    publishMediaState / ensurePeer / etc. are stable so they never
   *    tear the WS down on mic/cam toggles.
   */
  useEffect(() => {
    if (!mediaReady || !token) return;
    const currentUser = userRef.current;
    if (!currentUser) return;
    const userId = currentUser.id;

    const ws = new WebSocket(
      `${getWsBaseUrl()}/ws?room_id=${encodeURIComponent(params.id)}&user_id=${encodeURIComponent(userId)}`,
    );
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
      setStatusText("Realtime signaling error. Try rejoining the room.");
    };

    ws.onmessage = async (event) => {
      let msg: SignalMessage;
      try {
        msg = JSON.parse(event.data as string) as SignalMessage;
      } catch {
        return;
      }

      const sourceId = msg.from ?? msg.userId;

      // Server-side filtering should already handle these,
      // but defensively filter on the client too.
      if (msg.to && msg.to !== userId) return;
      if (sourceId === userId) return;

      /* ── participants snapshot (sent on connect) ─────────── */
      if (msg.type === "participants") {
        const users = msg.users?.filter(Boolean) ?? [];
        users.forEach((pid) => {
          if (pid !== userId) ensurePeer(pid);
        });
        setStatusText(users.length > 0 ? "Participants found. Connecting…" : "Waiting for participants…");
        return;
      }

      if (!sourceId) return;

      /* ── join / leave ───────────────────────────────────── */
      if (msg.type === "join") {
        ensurePeer(sourceId);
        setStatusText("A participant joined.");
        return;
      }
      if (msg.type === "leave") {
        removePeer(sourceId);
        setStatusText("A participant left.");
        return;
      }

      /* ── media-state ────────────────────────────────────── */
      const runtime = ensurePeer(sourceId);

      if (msg.type === "media-state") {
        runtime.micOn = msg.micOn ?? runtime.micOn;
        runtime.camOn = msg.camOn ?? runtime.camOn;
        runtime.isScreenSharing = msg.isScreenSharing ?? runtime.isScreenSharing;
        updatePeerView(runtime);
        return;
      }

      /* ── SDP offer / answer (perfect negotiation) ───────── */
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
                from: userId,
                to: sourceId,
                sdp: runtime.pc.localDescription.toJSON(),
              });
            }
          } catch {
            // PC may have been closed.
          }
        }
        return;
      }

      /* ── ICE candidate ──────────────────────────────────── */
      if (msg.candidate) {
        try {
          await runtime.pc.addIceCandidate(msg.candidate);
        } catch {
          if (!runtime.ignoreOffer) {
            // non-fatal
          }
        }
      }
    };

    return () => {
      wsRef.current = null;
      ws.close();
      setWsConnected(false);

      // Tear down every peer connection.
      peersRef.current.forEach((rt) => {
        rt.pc.onicecandidate = null;
        rt.pc.ontrack = null;
        rt.pc.onnegotiationneeded = null;
        rt.pc.onconnectionstatechange = null;
        rt.pc.close();
      });
      peersRef.current.clear();
      setPeerViews(new Map());

      // NOTE: media tracks are NOT stopped here.
      // They're managed independently and only stopped on component unmount.
    };
    // All callback deps below are **stable** (no state in their dep arrays),
    // so this effect only truly re-runs when mediaReady / params.id / token change.
  }, [mediaReady, params.id, token, ensurePeer, sendSignal, updatePeerView, removePeer]);

  /* 6. Stop all media tracks on unmount */
  useEffect(() => {
    return () => {
      audioTrackRef.current?.stop();
      cameraTrackRef.current?.stop();
      screenTrackRef.current?.stop();
    };
  }, []);

  /* 7. Chat polling */
  const loadMessages = useCallback(async () => {
    try {
      const res = await api.get<Message[]>(`/api/chat/${params.id}`);
      setMessages(res.data);
    } catch {
      /* keep latest */
    }
  }, [params.id]);

  useEffect(() => {
    void loadMessages();
    const id = window.setInterval(() => void loadMessages(), 4000);
    return () => window.clearInterval(id);
  }, [loadMessages]);

  /* 8. Auto-scroll chat */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     Event handlers
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const toggleMic = async () => {
    if (micOn) {
      if (audioTrackRef.current) audioTrackRef.current.enabled = false;
      setMicOn(false);
      setStatusText("Microphone muted.");
      return;
    }
    try {
      const track = await ensureAudioTrack();
      if (!track) throw new Error("No audio track");
      track.enabled = true;
      buildCompositeStream();
      syncLocalMediaToPeers();
      setMicOn(true);
      setStatusText("Microphone enabled.");
    } catch {
      setMicOn(false);
      setStatusText("Unable to access microphone.");
    }
  };

  const toggleCamera = async () => {
    if (camOn) {
      if (cameraTrackRef.current && !isScreenSharing) cameraTrackRef.current.enabled = false;
      setCamOn(false);
      setStatusText(isScreenSharing ? "Camera will remain off after sharing ends." : "Camera turned off.");
      return;
    }
    try {
      const track = await ensureCameraTrack();
      if (!track) throw new Error("No video track");
      if (!isScreenSharing) track.enabled = true;
      buildCompositeStream();
      syncLocalMediaToPeers();
      setCamOn(true);
      setStatusText(isScreenSharing ? "Camera ready for when sharing ends." : "Camera enabled.");
    } catch {
      setCamOn(false);
      setStatusText("Unable to access camera.");
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare();
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 15, max: 24 } },
        audio: false,
      });
      const track = display.getVideoTracks()[0];
      if (!track) throw new Error("No screen track");
      track.contentHint = "detail";
      screenTrackRef.current = track;
      setIsScreenSharing(true);
      buildCompositeStream();
      syncLocalMediaToPeers();
      setStatusText("Screen sharing started.");
      track.onended = () => stopScreenShare(true);
    } catch {
      setStatusText("Screen sharing cancelled or unavailable.");
    }
  };

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     Render
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

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
          <button className={`rh-chat-btn${chatOpen ? " active" : ""}`} onClick={() => setChatOpen((v) => !v)} title="Toggle chat panel">
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
            label={user?.username ?? formatParticipantLabel(user?.id ?? "local", user?.id)}
            userId={user?.id ?? "local"}
            isLocal
            micOn={micOn}
            camOn={camOn}
            isScreenSharing={isScreenSharing}
            status={isScreenSharing ? "Presenting" : localStream?.getTracks().length ? undefined : "No media"}
          />

          {peerList.map((peer) => (
            <VideoTile
              key={peer.userId}
              stream={peer.stream}
              label={formatParticipantLabel(peer.userId, user?.id)}
              userId={peer.userId}
              micOn={peer.micOn}
              camOn={peer.camOn}
              isScreenSharing={peer.isScreenSharing}
              status={peer.isScreenSharing ? "Presenting" : peer.connectionState === "connected" ? undefined : peer.connectionState}
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
                  const initChar = isMine ? user?.username?.charAt(0).toUpperCase() ?? "?" : msg.user_id.charAt(0).toUpperCase();

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
                onChange={(e) => setChatInput(e.target.value)}
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
        <button className={`ctrl-v2${micOn ? "" : " ctrl-v2-off"}`} onClick={toggleMic} title={micOn ? "Mute microphone" : "Unmute microphone"}>
          <MicIcon off={!micOn} />
          <span>{micOn ? "Mute" : "Unmute"}</span>
        </button>

        <button className={`ctrl-v2${camOn ? "" : " ctrl-v2-off"}`} onClick={toggleCamera} title={camOn ? "Stop camera" : "Start camera"}>
          <CamIcon off={!camOn} />
          <span>{camOn ? "Stop Cam" : "Start Cam"}</span>
        </button>

        <button className={`ctrl-v2${isScreenSharing ? " ctrl-v2-off" : ""}`} onClick={toggleScreenShare} title={isScreenSharing ? "Stop screen share" : "Share screen"}>
          <ScreenIcon />
          <span>{isScreenSharing ? "Stop Share" : "Share"}</span>
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
