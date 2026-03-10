"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "../../../services/api";
import { useAuthStore } from "../../../store/auth";
import type { Message, Room } from "../../../types/api";

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
  username?: string;
  // Real-time chat fields
  content?: string;
  msgId?: string;
  timestamp?: string;
};

/* ─── Constants ──────────────────────────────────────────────── */

const ICE_SERVERS: RTCIceServer[] = (() => {
  const servers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];

  // Support configurable TURN server via environment variables.
  // Set NEXT_PUBLIC_TURN_URL, NEXT_PUBLIC_TURN_USERNAME, NEXT_PUBLIC_TURN_CREDENTIAL
  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  if (turnUrl) {
    servers.push({
      urls: turnUrl,
      username: process.env.NEXT_PUBLIC_TURN_USERNAME ?? "",
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL ?? "",
    });
  }

  return servers;
})();

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
  if (process.env.NEXT_PUBLIC_WS_BASE_URL) {
    return process.env.NEXT_PUBLIC_WS_BASE_URL.replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}`;
  }

  const rawBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? api.defaults.baseURL ?? "http://127.0.0.1:8080";
  return rawBase.replace(/^http/i, "ws").replace(/\/$/, "");
}

function formatParticipantLabel(userId: string, currentUserId?: string) {
  if (userId === currentUserId) return "You";
  return userId.length > 12 ? `${userId.slice(0, 8)}…${userId.slice(-4)}` : userId;
}

function syncTransceiverDirection(transceiver: RTCRtpTransceiver, hasTrack: boolean) {
  if (hasTrack) {
    if (transceiver.direction === "recvonly") transceiver.direction = "sendrecv";
    if (transceiver.direction === "inactive") transceiver.direction = "sendonly";
    return;
  }

  if (transceiver.direction === "sendrecv") transceiver.direction = "recvonly";
  if (transceiver.direction === "sendonly") transceiver.direction = "inactive";
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

  /**
   * Zoom / Google Meet strategy:
   *  - The <video> element is ALWAYS mounted in the DOM.
   *  - srcObject is ALWAYS assigned.
   *  - Show / hide is determined purely by the declared media state
   *    (camOn or isScreenSharing), NOT by checking track.muted or
   *    track.readyState. A brief black frame during transitions is
   *    normal and accepted — exactly like Zoom / Meet.
   *  - The avatar / placeholder is an OVERLAY that sits on top of the
   *    <video> and fades away when video should be visible.
   */
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (stream) {
      if (el.srcObject !== stream) {
        el.srcObject = stream;
      }
      // Re-trigger play() whenever screen-sharing or camera state changes.
      // replaceTrack() swaps content in-place without firing ontrack, so
      // many browsers need a fresh play() call to render the new frames.
      el.play().catch(() => { /* autoplay blocked until user gesture */ });
    } else {
      el.srcObject = null;
    }
  }, [stream, isScreenSharing, camOn]);

  const initial = label.charAt(0).toUpperCase() || "?";
  const showVideo = camOn || Boolean(isScreenSharing);

  return (
    <div className={`vt-tile${isLocal ? " vt-local" : ""}`}>
      {/* Video element is ALWAYS mounted — Zoom / Meet pattern */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className="vt-video"
        style={{
          objectFit: isScreenSharing ? "contain" : "cover",
          background: isScreenSharing ? "#000" : undefined,
          opacity: showVideo ? 1 : 0,
          position: showVideo ? "relative" : "absolute",
        }}
      />

      {/* Avatar overlay — visible when camera & screen share are off */}
      {!showVideo && (
        <div className="vt-placeholder" style={{ background: avatarColor(userId) }}>
          <div className="vt-avatar" style={{ background: "rgba(0,0,0,0.25)" }}>
            {initial}
          </div>
          <span className="vt-cam-label">Camera off</span>
        </div>
      )}

      <div className="vt-overlay">
        <span className="vt-name">
          {label}
          {isLocal && <span className="vt-you-tag">you</span>}
        </span>
        <span className="vt-icons">
          {!micOn && <span className="vt-icon-badge vt-badge-muted">🔇</span>}
          {!camOn && !isScreenSharing && (
            <span className="vt-icon-badge">Cam off</span>
          )}
          {isScreenSharing && (
            <span className="vt-icon-badge vt-badge-presenting">Presenting</span>
          )}
          {status && status !== "connected" && (
            <span className="vt-icon-badge vt-badge-status">{status}</span>
          )}
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

/** Fallback: simpler constraints for devices that reject specific resolutions. */
const FALLBACK_VIDEO: MediaTrackConstraints = {
  facingMode: "user",
  width: { ideal: 640 },
  height: { ideal: 480 },
};

/** Helper: try getUserMedia with primary constraints, then fallback, then bare minimum. */
async function safeGetUserMedia(
  constraints: MediaStreamConstraints,
): Promise<MediaStream> {
  // On non-secure origins (HTTP), navigator.mediaDevices is undefined
  // in most mobile browsers (Android Chrome, iOS Safari).
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new DOMException(
      "Camera/microphone requires HTTPS. Use localhost or an HTTPS URL.",
      "NotAllowedError",
    );
  }

  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    // If the specific video constraints failed, try simpler ones.
    if (constraints.video && constraints.video !== true) {
      try {
        return await navigator.mediaDevices.getUserMedia({
          ...constraints,
          video: FALLBACK_VIDEO,
        });
      } catch {
        // If video still fails, try with just { video: true }.
        try {
          return await navigator.mediaDevices.getUserMedia({
            ...constraints,
            video: true,
          });
        } catch {
          // Final attempt: video: {facingMode: "user"} — helps on some Android devices.
          return await navigator.mediaDevices.getUserMedia({
            ...constraints,
            video: { facingMode: "user" },
          });
        }
      }
    }
    throw err;
  }
}

/**
 * Adapt video encoding parameters based on participant count.
 * Fewer participants = higher quality, more participants = lower quality.
 */
function getAdaptiveVideoParams(participantCount: number): {
  maxBitrate: number;
  maxFramerate: number;
  scaleResolutionDownBy: number;
} {
  if (participantCount <= 2) {
    return { maxBitrate: 1_500_000, maxFramerate: 30, scaleResolutionDownBy: 1 };
  }
  if (participantCount <= 4) {
    return { maxBitrate: 800_000, maxFramerate: 24, scaleResolutionDownBy: 1.5 };
  }
  if (participantCount <= 8) {
    return { maxBitrate: 500_000, maxFramerate: 20, scaleResolutionDownBy: 2 };
  }
  return { maxBitrate: 300_000, maxFramerate: 15, scaleResolutionDownBy: 2.5 };
}

/** Apply adaptive bitrate to all video senders on a peer connection. */
async function applyAdaptiveBitrate(pc: RTCPeerConnection, peerCount: number) {
  const params = getAdaptiveVideoParams(peerCount);
  const senders = pc.getSenders().filter((s) => s.track?.kind === "video");

  for (const sender of senders) {
    try {
      const sendParams = sender.getParameters();
      if (!sendParams.encodings || sendParams.encodings.length === 0) {
        sendParams.encodings = [{}];
      }
      sendParams.encodings[0].maxBitrate = params.maxBitrate;
      sendParams.encodings[0].maxFramerate = params.maxFramerate;
      sendParams.encodings[0].scaleResolutionDownBy = params.scaleResolutionDownBy;
      await sender.setParameters(sendParams);
    } catch {
      // Some browsers don't support all encoding params — ignore.
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   RoomPage — complete multi-peer WebRTC with perfect negotiation
   ═══════════════════════════════════════════════════════════════ */

export default function RoomPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { hydrated, token, user, rooms, addRoom } = useAuthStore();
  const room = useMemo(() => rooms.find((r) => r.id === params.id), [rooms, params.id]);
  const [roomDetails, setRoomDetails] = useState<Room | null>(room ?? null);

  /* ── Chat state ─────────────────────────────────────────────── */
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [participantNames, setParticipantNames] = useState<Map<string, string>>(new Map());
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
  const screenAudioTrackRef = useRef<MediaStreamTrack | null>(null);
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
  const roomName = roomDetails?.name ?? `Room ${params.id.slice(0, 8)}`;
  const peerList = useMemo(() => Array.from(peerViews.values()), [peerViews]);
  const totalCount = peerList.length + 1;

  // Detect if anyone (including self) is screen sharing for spotlight layout.
  const screenSharingPeer = peerList.find((p) => p.isScreenSharing);
  const hasScreenPresenter = isScreenSharing || Boolean(screenSharingPeer);

  const gridClass = hasScreenPresenter
    ? "vg-spotlight"
    : totalCount === 1
      ? "vg-solo"
      : totalCount === 2
        ? "vg-duo"
        : totalCount <= 4
          ? "vg-quad"
          : "vg-many";

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

  const syncPeerTrack = useCallback(
    (
      pc: RTCPeerConnection,
      kind: "audio" | "video",
      track: MediaStreamTrack | null,
      stream: MediaStream,
    ) => {
      // Find the transceiver for this media kind.  Check mid+kind first,
      // then fallback to sender track kind, then receiver track kind.
      const transceiver = pc.getTransceivers().find((t) => {
        // Prefer matching by sender track kind (most reliable).
        if (t.sender.track?.kind === kind) return true;
        // Fallback: match by receiver track kind (for recvonly transceivers).
        try {
          if (t.receiver?.track?.kind === kind) return true;
        } catch { /* receiver may not be ready */ }
        return false;
      });

      if (transceiver) {
        void transceiver.sender.replaceTrack(track).catch(() => {
          // replaceTrack can fail if the transceiver is stopped.
        });
        syncTransceiverDirection(transceiver, Boolean(track));
        return;
      }

      if (track) {
        pc.addTrack(track, stream);
        return;
      }

      pc.addTransceiver(kind, { direction: "recvonly" });
    },
    [],
  );

  /** Replace/add local tracks on every peer connection. */
  const syncLocalMediaToPeers = useCallback(() => {
    const compositeStream = buildCompositeStream();
    const audioTrack = audioTrackRef.current;
    const videoTrack = screenTrackRef.current ?? cameraTrackRef.current;

    peersRef.current.forEach((runtime) => {
      syncPeerTrack(runtime.pc, "audio", audioTrack, compositeStream);
      syncPeerTrack(runtime.pc, "video", videoTrack, compositeStream);
    });
  }, [buildCompositeStream, syncPeerTrack]);

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
    // Clear stale ref — the track may have ended without triggering onended.
    if (audioTrackRef.current && audioTrackRef.current.readyState !== "live") {
      audioTrackRef.current = null;
    }
    if (audioTrackRef.current) return audioTrackRef.current;

    const stream = await safeGetUserMedia({ audio: MEDIA_CONSTRAINTS.audio, video: false });
    const track = stream.getAudioTracks()[0] ?? null;
    // Stop any video tracks that might have been acquired accidentally.
    stream.getVideoTracks().forEach((t) => t.stop());
    if (track) {
      track.enabled = true;
      audioTrackRef.current = track;
      track.onended = () => {
        if (audioTrackRef.current?.id === track.id) {
          audioTrackRef.current = null;
          setMicOn(false);
          buildCompositeStream();
          syncLocalMediaToPeers();
          publishMediaState({ micOn: false });
        }
      };
    }
    return track;
  }, [buildCompositeStream, publishMediaState, syncLocalMediaToPeers]);

  const ensureCameraTrack = useCallback(async () => {
    // Clear stale ref — the track may have ended without triggering onended.
    if (cameraTrackRef.current && cameraTrackRef.current.readyState !== "live") {
      cameraTrackRef.current = null;
    }
    if (cameraTrackRef.current) return cameraTrackRef.current;

    const stream = await safeGetUserMedia({ audio: false, video: MEDIA_CONSTRAINTS.video });
    const track = stream.getVideoTracks()[0] ?? null;
    // Stop any audio tracks that might have been acquired accidentally.
    stream.getAudioTracks().forEach((t) => t.stop());
    if (track) {
      track.enabled = true;
      track.contentHint = "motion";
      cameraTrackRef.current = track;
      track.onended = () => {
        if (cameraTrackRef.current?.id === track.id) {
          cameraTrackRef.current = null;
          setCamOn(false);
          buildCompositeStream();
          syncLocalMediaToPeers();
          publishMediaState({ camOn: false });
        }
      };
    }
    return track;
  }, [buildCompositeStream, syncLocalMediaToPeers, publishMediaState]);

  const stopScreenShare = useCallback(
    (fromTrackEnd = false) => {
      const track = screenTrackRef.current;
      screenTrackRef.current = null;
      setIsScreenSharing(false);
      if (track) {
        track.onended = null;
        if (!fromTrackEnd) track.stop();
      }
      // Stop and clean up screen audio track.
      const audioTrack = screenAudioTrackRef.current;
      screenAudioTrackRef.current = null;
      if (audioTrack) {
        audioTrack.stop();
        // Remove screen audio senders from all peer connections.
        peersRef.current.forEach((runtime) => {
          const sender = runtime.pc.getSenders().find((s) => s.track === audioTrack);
          if (sender) {
            try { runtime.pc.removeTrack(sender); } catch { /* PC may be closed */ }
          }
        });
      }
      // Restore camera if it was on (read from ref for stable closure).
      if (cameraTrackRef.current) cameraTrackRef.current.enabled = camOnRef.current;
      // Publish state BEFORE syncing tracks so peers know we stopped sharing.
      publishMediaState({ isScreenSharing: false });
      buildCompositeStream();
      syncLocalMediaToPeers();
    },
    [syncLocalMediaToPeers, publishMediaState, buildCompositeStream],
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
        camOn: false,   // Default OFF — show gradient avatar until media-state confirms camera is on.
        isScreenSharing: false,
      };

      peersRef.current.set(remoteId, runtime);

      // Feed local tracks into the peer connection.
      const localTracks = compositeStream.getTracks();
      const hasAudioTrack = localTracks.some((t) => t.kind === "audio");
      const hasVideoTrack = localTracks.some((t) => t.kind === "video");
      localTracks.forEach((track) => pc.addTrack(track, compositeStream));

      // Always ensure both audio and video transceivers exist so that:
      //  (a) We can RECEIVE remote media even when not sending that kind.
      //  (b) The initial SDP contains both m-lines, allowing a later
      //      screen-share to use the fast replaceTrack() path instead of
      //      the heavier addTrack + full renegotiation path.
      if (!hasAudioTrack) {
        pc.addTransceiver("audio", { direction: "recvonly" });
      }
      if (!hasVideoTrack) {
        pc.addTransceiver("video", { direction: "recvonly" });
      }

      /* ontrack — accumulate remote tracks into runtime.stream.
       * After adding tracks we create a NEW MediaStream so that the
       * React component receives a different object reference, which
       * triggers the VideoTile useEffect to re-assign srcObject and
       * call play(). Without this, replaceTrack()-driven content
       * changes and late-arriving tracks would never be rendered. */
      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        const addTrack = (track: MediaStreamTrack) => {
          if (!runtime.stream.getTracks().some((t) => t.id === track.id)) {
            runtime.stream.addTrack(track);
          }
          track.onended = () => {
            // Rebuild stream without ended tracks so the video element
            // drops the dead track and React detects the change.
            const liveTracks = runtime.stream.getTracks().filter((t) => t.readyState === "live");
            runtime.stream = new MediaStream(liveTracks);
            updatePeerView(runtime);
          };
          track.onmute = () => updatePeerView(runtime);
          track.onunmute = () => updatePeerView(runtime);
        };

        if (remoteStream) {
          remoteStream.getTracks().forEach(addTrack);
        } else {
          addTrack(event.track);
        }
        // Create a new MediaStream reference with all accumulated tracks
        // so React detects the change and VideoTile re-assigns srcObject.
        runtime.stream = new MediaStream(runtime.stream.getTracks());
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

      // Share our display name so the remote peer can label us.
      sendSignal({
        type: "user-info",
        from: uid,
        to: remoteId,
        username: userRef.current?.username ?? uid,
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
    if (hydrated && !token) router.replace("/login");
  }, [hydrated, router, token]);

  useEffect(() => {
    setRoomDetails(room ?? null);
  }, [room]);

  useEffect(() => {
    if (!hydrated || !token || room) return;

    let active = true;

    const loadRoomDetails = async () => {
      try {
        const res = await api.get<Room>(`/api/rooms/${params.id}`);
        if (!active) return;
        setRoomDetails(res.data);
        addRoom(res.data);
      } catch {
        if (active) setStatusText("Unable to load room details.");
      }
    };

    void loadRoomDetails();

    return () => {
      active = false;
    };
  }, [addRoom, hydrated, params.id, room, token]);

  /* 2. Acquire local media — audio and video acquired SEPARATELY so
   *    one failing (e.g. no camera permission) doesn't kill the other.
   *    IMPORTANT: even if BOTH fail, we still set mediaReady=true so the
   *    WebSocket connects and the user can participate with just audio or
   *    as a viewer with a coloured avatar tile (Google Meet style). */
  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      let gotAudio = false;
      let gotVideo = false;

      // ── Audio ──────────────────────────────────────────
      try {
        const audioStream = await safeGetUserMedia({ audio: MEDIA_CONSTRAINTS.audio, video: false });
        if (cancelled) { audioStream.getTracks().forEach((t) => t.stop()); return; }
        const audioTrack = audioStream.getAudioTracks()[0] ?? null;
        if (audioTrack) {
          audioTrack.enabled = true;
          audioTrackRef.current = audioTrack;
          audioTrack.onended = () => {
            if (audioTrackRef.current?.id === audioTrack.id) {
              audioTrackRef.current = null;
              setMicOn(false);
              buildCompositeStream();
              syncLocalMediaToPeers();
              publishMediaState({ micOn: false });
            }
          };
          gotAudio = true;
        }
      } catch (err) {
        if (cancelled) return;
        console.warn("[NexRoom] Audio acquisition failed:", (err as Error)?.name, (err as Error)?.message);
        setMicOn(false);
      }

      // ── Video ──────────────────────────────────────────
      try {
        const videoStream = await safeGetUserMedia({ audio: false, video: MEDIA_CONSTRAINTS.video });
        if (cancelled) { videoStream.getTracks().forEach((t) => t.stop()); return; }
        const videoTrack = videoStream.getVideoTracks()[0] ?? null;
        if (videoTrack) {
          videoTrack.enabled = true;
          videoTrack.contentHint = "motion";
          cameraTrackRef.current = videoTrack;
          videoTrack.onended = () => {
            if (cameraTrackRef.current?.id === videoTrack.id) {
              cameraTrackRef.current = null;
              setCamOn(false);
              buildCompositeStream();
              syncLocalMediaToPeers();
              publishMediaState({ camOn: false });
            }
          };
          gotVideo = true;
        }
      } catch (err) {
        if (cancelled) return;
        console.warn("[NexRoom] Video acquisition failed:", (err as Error)?.name, (err as Error)?.message);
        setCamOn(false);
      }

      if (cancelled) return;

      buildCompositeStream();

      if (gotAudio && gotVideo) {
        setStatusText("Media ready. Connecting to room…");
      } else if (gotAudio) {
        setStatusText("Microphone ready. Camera unavailable — showing avatar.");
      } else if (gotVideo) {
        setStatusText("Camera ready. Microphone unavailable.");
      } else {
        const isSecure = typeof window !== "undefined" &&
          (window.location.protocol === "https:" || window.location.hostname === "localhost");
        if (!isSecure) {
          setStatusText("Camera/mic require HTTPS. Use localhost or an HTTPS URL to enable media.");
        } else {
          setStatusText("No camera or mic detected — joined as viewer.");
        }
      }

      // ALWAYS mark media as ready so WS connection proceeds even with no media.
      setMediaReady(true);
    };

    void setup();
    return () => {
      cancelled = true;
    };
  }, [buildCompositeStream, publishMediaState, syncLocalMediaToPeers]);

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

  /* 4b. Adapt video bitrate based on participant count */
  useEffect(() => {
    const count = peerViews.size + 1;
    peersRef.current.forEach((runtime) => {
      void applyAdaptiveBitrate(runtime.pc, count);
    });
  }, [peerViews.size]);

  /* 5. WebSocket connection + signaling with auto-reconnection
   *    Dependencies are ONLY things that change once or are stable.
   *    publishMediaState / ensurePeer / etc. are stable so they never
   *    tear the WS down on mic/cam toggles.
   */
  useEffect(() => {
    if (!mediaReady || !hydrated || !token) return;
    const currentUser = userRef.current;
    if (!currentUser) return;
    const userId = currentUser.id;

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    const MAX_BACKOFF = 15_000;

    function connect() {
      if (cancelled) return;

      const ws = new WebSocket(
        `${getWsBaseUrl()}/ws?room_id=${encodeURIComponent(params.id)}&user_id=${encodeURIComponent(userId)}&token=${encodeURIComponent(token ?? "")}`,
      );
      wsRef.current = ws;
      setStatusText(attempt > 0 ? `Reconnecting (attempt ${attempt})…` : "Connecting to room…");

    ws.onopen = () => {
      attempt = 0;
      setWsConnected(true);
      setStatusText("Connected. Waiting for participants…");
    };

    ws.onclose = () => {
      setWsConnected(false);
      if (!cancelled) {
        const delay = Math.min(1000 * 2 ** attempt, MAX_BACKOFF);
        attempt += 1;
        setStatusText(`Disconnected. Reconnecting in ${Math.round(delay / 1000)}s…`);
        reconnectTimer = setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      setStatusText("Realtime signaling error.");
    };

    /* ── Serialized message queue ─────────────────────────── */
    const signalQueue: string[] = [];
    let draining = false;

    async function drainSignalQueue() {
      if (draining) return;
      draining = true;
      while (signalQueue.length > 0) {
        await handleSignalingMsg(signalQueue.shift()!);
      }
      draining = false;
    }

    async function handleSignalingMsg(raw: string) {
      let msg: SignalMessage;
      try {
        msg = JSON.parse(raw) as SignalMessage;
      } catch {
        return;
      }

      const sourceId = msg.from ?? msg.userId;

      if (msg.to && msg.to !== userId) return;
      if (sourceId === userId) return;

      /* ── participants snapshot (sent on connect) ─────────── */
      if (msg.type === "participants") {
        const users = msg.users?.filter(Boolean) ?? [];
        // Extract usernames from enhanced participant list if available.
        const participantList = (msg as Record<string, unknown>).participants as
          | { userId: string; username: string }[]
          | undefined;
        if (participantList) {
          setParticipantNames((prev) => {
            const n = new Map(prev);
            participantList.forEach((p) => {
              if (p.userId !== userId && p.username) {
                n.set(p.userId, p.username);
              }
            });
            return n;
          });
        }
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
        // Extract username from join message if available.
        if (msg.username) {
          setParticipantNames((prev) => { const n = new Map(prev); n.set(sourceId, msg.username!); return n; });
        }
        setStatusText("A participant joined.");
        return;
      }
      if (msg.type === "leave") {
        removePeer(sourceId);
        setParticipantNames((prev) => { const n = new Map(prev); n.delete(sourceId); return n; });
        setStatusText("A participant left.");
        return;
      }

      /* ── user-info (display name) ───────────────────────── */
      if (msg.type === "user-info" && msg.username) {
        setParticipantNames((prev) => { const n = new Map(prev); n.set(sourceId, msg.username!); return n; });
        return;
      }

      /* ── real-time chat message ─────────────────────────── */
      if (msg.type === "chat" && msg.content) {
        setMessages((prev) => {
          // Deduplicate by msgId if provided.
          if (msg.msgId && prev.some((m) => m.id?.toString() === msg.msgId)) return prev;
          const newMsg: Message = {
            id: msg.msgId ? parseInt(msg.msgId, 10) || Date.now() : Date.now(),
            room_id: params.id,
            user_id: sourceId,
            content: msg.content!,
            created_at: msg.timestamp ?? new Date().toISOString(),
          };
          return [...prev, newMsg];
        });
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
    }

    ws.onmessage = (event) => {
      signalQueue.push(event.data as string);
      void drainSignalQueue();
    };
    } // end connect()

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws) ws.close();
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
      setParticipantNames(new Map());
    };
    // All callback deps below are **stable** (no state in their dep arrays),
    // so this effect only truly re-runs when mediaReady / params.id / token change.
  }, [hydrated, mediaReady, params.id, token, ensurePeer, sendSignal, updatePeerView, removePeer]);

  /* 6. Stop all media tracks on unmount */
  useEffect(() => {
    return () => {
      audioTrackRef.current?.stop();
      cameraTrackRef.current?.stop();
      screenTrackRef.current?.stop();
      screenAudioTrackRef.current?.stop();
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
    // With real-time WS delivery, HTTP polling is just a consistency fallback.
    const id = window.setInterval(() => void loadMessages(), 15000);
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
    const msgId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      // Optimistically add message to local state.
      const optimisticMsg: Message = {
        id: Date.now(),
        room_id: params.id,
        user_id: user?.id ?? "",
        content: text,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticMsg]);

      // Broadcast via WebSocket for instant delivery to peers.
      sendSignal({
        type: "chat",
        from: user?.id,
        content: text,
        msgId,
        timestamp: new Date().toISOString(),
      });

      // Also persist via HTTP API.
      await api.post("/api/chat/send", { room_id: params.id, content: text });
    } catch {
      setChatInput(text);
      // Remove optimistic message on failure.
      setMessages((prev) => prev.filter((m) => m.id !== Date.now()));
    } finally {
      setSending(false);
    }
  };

  const toggleMic = async () => {
    if (micOn) {
      if (audioTrackRef.current) audioTrackRef.current.enabled = false;
      setMicOn(false);
      setStatusText("Microphone muted.");
      publishMediaState({ micOn: false });
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
      publishMediaState({ micOn: true });
    } catch (err) {
      setMicOn(false);
      const name = (err as { name?: string })?.name;
      if (name === "NotAllowedError") {
        setStatusText("Microphone permission denied. Allow access in browser settings.");
      } else if (name === "NotFoundError") {
        setStatusText("No microphone found on this device.");
      } else {
        setStatusText("Unable to access microphone. Check permissions.");
      }
    }
  };

  const toggleCamera = async () => {
    if (camOn) {
      if (cameraTrackRef.current && !isScreenSharing) cameraTrackRef.current.enabled = false;
      setCamOn(false);
      setStatusText(isScreenSharing ? "Camera will remain off after sharing ends." : "Camera turned off.");
      publishMediaState({ camOn: false });
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
      publishMediaState({ camOn: true });
    } catch (err) {
      setCamOn(false);
      const name = (err as { name?: string })?.name;
      if (name === "NotAllowedError") {
        setStatusText("Camera permission denied. Allow access in browser settings.");
      } else if (name === "NotFoundError") {
        setStatusText("No camera found on this device.");
      } else if (name === "NotReadableError") {
        setStatusText("Camera is in use by another app. Close it and try again.");
      } else {
        setStatusText("Unable to access camera. Check permissions.");
      }
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
        audio: true, // Request audio — Chrome tab sharing can provide it.
      });
      const track = display.getVideoTracks()[0];
      if (!track) throw new Error("No screen track");
      track.contentHint = "detail";
      screenTrackRef.current = track;

      // If screen share includes audio, store it and add to peers.
      const screenAudio = display.getAudioTracks()[0] ?? null;
      screenAudioTrackRef.current = screenAudio;

      if (screenAudio) {
        const compositeStream = localStreamRef.current ?? new MediaStream();
        peersRef.current.forEach((runtime) => {
          runtime.pc.addTrack(screenAudio, compositeStream);
        });
      }

      track.onended = () => {
        stopScreenShare(true);
      };

      setIsScreenSharing(true);
      // Publish media-state BEFORE syncing tracks so the remote peer knows
      // isScreenSharing=true before the renegotiation offer arrives.
      publishMediaState({ isScreenSharing: true });
      buildCompositeStream();
      syncLocalMediaToPeers();
      setStatusText("Screen sharing started.");
    } catch {
      setStatusText("Screen sharing cancelled or unavailable.");
    }
  };

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     Render
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

  if (!hydrated) {
    return (
      <div className="auth-page">
        <div className="card auth-status-card">
          <span className="spinner" />
          <p>Restoring your room session…</p>
        </div>
      </div>
    );
  }

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
              {roomDetails?.is_private === 1 && (
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
          <button className={`rh-pill${participantsOpen ? " rh-pill-active" : ""}`} onClick={() => setParticipantsOpen((v) => !v)} title="Show participants">
            <PeopleIcon />
            <span>{totalCount} in room</span>
          </button>
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
          />

          {peerList.map((peer) => (
            <VideoTile
              key={peer.userId}
              stream={peer.stream}
              label={participantNames.get(peer.userId) ?? formatParticipantLabel(peer.userId, user?.id)}
              userId={peer.userId}
              micOn={peer.micOn}
              camOn={peer.camOn}
              isScreenSharing={peer.isScreenSharing}
              status={peer.connectionState === "failed" ? "reconnecting" : undefined}
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

        {participantsOpen && (
          <aside className="participants-panel">
            <div className="pp-header">
              <PeopleIcon />
              <span>Participants ({totalCount})</span>
              <button className="pp-close" onClick={() => setParticipantsOpen(false)}>✕</button>
            </div>
            <div className="pp-list">
              <div className="pp-item">
                <div className="pp-avatar" style={{ background: avatarColor(user?.id ?? "") }}>
                  {user?.username?.charAt(0).toUpperCase() ?? "?"}
                </div>
                <span className="pp-name">{user?.username ?? "You"}</span>
                <span className="pp-you">(You)</span>
                <span className="pp-badges">
                  {!micOn && <span className="pp-badge" title="Mic off">🔇</span>}
                  {!camOn && <span className="pp-badge" title="Cam off">📷</span>}
                  {isScreenSharing && <span className="pp-badge" title="Presenting">🖥️</span>}
                </span>
              </div>
              {peerList.map((peer) => (
                <div key={peer.userId} className="pp-item">
                  <div className="pp-avatar" style={{ background: avatarColor(peer.userId) }}>
                    {(participantNames.get(peer.userId) ?? peer.userId).charAt(0).toUpperCase()}
                  </div>
                  <span className="pp-name">
                    {participantNames.get(peer.userId) ?? formatParticipantLabel(peer.userId, user?.id)}
                  </span>
                  <span className="pp-badges">
                    {!peer.micOn && <span className="pp-badge" title="Mic off">🔇</span>}
                    {!peer.camOn && <span className="pp-badge" title="Cam off">📷</span>}
                    {peer.isScreenSharing && <span className="pp-badge" title="Presenting">🖥️</span>}
                    <span className={`pp-conn-dot${peer.connectionState === "connected" ? " pp-conn-ok" : ""}`} title={peer.connectionState} />
                  </span>
                </div>
              ))}
            </div>
          </aside>
        )}

        {chatOpen && (
          <aside className="chat-panel">
            <div className="cp-header">
              <ChatBubbleIcon />
              <span>Room Chat</span>
              {messages.length > 0 && <span className="cp-count">{messages.length}</span>}
              <button className="cp-close" onClick={() => setChatOpen(false)} title="Close chat">✕</button>
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
