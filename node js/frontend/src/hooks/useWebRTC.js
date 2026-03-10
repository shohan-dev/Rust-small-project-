'use client';

/**
 * useWebRTC – manages WebSocket signaling, WebRTC peer connections,
 * local media, screen sharing, and chat for a room.
 *
 * KEY FIXES:
 *  - Screen share uses addTrack/removeTrack + renegotiation (not replaceTrack)
 *    so it works even when user had no camera initially
 *  - ontrack handler properly detects screen vs camera streams
 *  - ICE candidate queuing until remote description is set
 *  - Proper cleanup of all resources
 */
import { useState, useRef, useCallback, useEffect } from 'react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5000/ws';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

export default function useWebRTC(roomId) {
  /* ─── State ────────────────────────────────────────────────────── */
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [peers, setPeers] = useState({});
  const [chatMessages, setChatMessages] = useState([]);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [myPeerId, setMyPeerId] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [participantCount, setParticipantCount] = useState(1);

  /* ─── Refs ─────────────────────────────────────────────────────── */
  const wsRef = useRef(null);
  const pcsRef = useRef({});               // peerId → RTCPeerConnection
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const myPeerIdRef = useRef(null);
  const pendingIceRef = useRef({});         // peerId → candidate[]
  const negotiatingRef = useRef({});        // peerId → bool (avoid glare)
  const makingOfferRef = useRef({});        // peerId → bool

  /* ─── Helpers ──────────────────────────────────────────────────── */
  const wsSend = useCallback((data) => {
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  /* ─── Get local media ─────────────────────────────────────────── */
  const getLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsAudioEnabled(true);
      setIsVideoEnabled(true);
      return stream;
    } catch {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;
        setLocalStream(stream);
        setIsAudioEnabled(true);
        setIsVideoEnabled(false);
        return stream;
      } catch {
        console.warn('[Media] No camera/mic – avatar mode');
        setIsAudioEnabled(false);
        setIsVideoEnabled(false);
        return null;
      }
    }
  }, []);

  /* ─── Renegotiate a peer connection (polite peer pattern) ──────── */
  const renegotiate = useCallback(async (remotePeerId) => {
    const pc = pcsRef.current[remotePeerId];
    if (!pc) return;
    try {
      makingOfferRef.current[remotePeerId] = true;
      const offer = await pc.createOffer();
      if (pc.signalingState !== 'stable') return;
      await pc.setLocalDescription(offer);
      wsSend({ type: 'offer', targetPeerId: remotePeerId, offer: pc.localDescription });
    } catch (e) {
      console.error('[Renegotiate] Error:', e);
    } finally {
      makingOfferRef.current[remotePeerId] = false;
    }
  }, [wsSend]);

  /* ─── Create peer connection ───────────────────────────────────── */
  const createPC = useCallback((remotePeerId, remoteUser, isPolite) => {
    if (pcsRef.current[remotePeerId]) return pcsRef.current[remotePeerId];

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcsRef.current[remotePeerId] = pc;

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Add screen track if currently sharing
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, screenStreamRef.current);
      });
    }

    /* ICE candidates */
    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        wsSend({ type: 'ice-candidate', targetPeerId: remotePeerId, candidate: ev.candidate });
      }
    };

    /* Remote tracks – distinguish camera vs screen by stream id */
    pc.ontrack = (ev) => {
      for (const stream of ev.streams) {
        setPeers((prev) => {
          const existing = prev[remotePeerId] || {};
          // Use first stream as main, second as screen (heuristic)
          const hasExistingStream = existing.stream && existing.stream.id !== stream.id;
          if (hasExistingStream) {
            return {
              ...prev,
              [remotePeerId]: { ...existing, screenStream: stream },
            };
          }
          return {
            ...prev,
            [remotePeerId]: {
              ...existing,
              user: remoteUser || existing.user || {},
              stream,
              hasVideo: stream.getVideoTracks().some((t) => t.enabled),
              hasAudio: stream.getAudioTracks().some((t) => t.enabled),
            },
          };
        });
      }
    };

    /* Negotiation needed – create offer automatically */
    pc.onnegotiationneeded = async () => {
      try {
        makingOfferRef.current[remotePeerId] = true;
        const offer = await pc.createOffer();
        if (pc.signalingState !== 'stable') return;
        await pc.setLocalDescription(offer);
        wsSend({ type: 'offer', targetPeerId: remotePeerId, offer: pc.localDescription });
      } catch (e) {
        console.error('[Negotiation] Error:', e);
      } finally {
        makingOfferRef.current[remotePeerId] = false;
      }
    };

    /* Connection monitoring */
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') pc.restartIce();
    };

    /* Init peer state */
    setPeers((prev) => ({
      ...prev,
      [remotePeerId]: {
        user: remoteUser || {},
        stream: null,
        hasVideo: false,
        hasAudio: false,
        screenStream: null,
        ...(prev[remotePeerId] || {}),
        user: remoteUser || prev[remotePeerId]?.user || {},
      },
    }));

    return pc;
  }, [wsSend]);

  /* ─── Flush queued ICE candidates ──────────────────────────────── */
  const flushIce = useCallback(async (peerId) => {
    const pc = pcsRef.current[peerId];
    const q = pendingIceRef.current[peerId] || [];
    for (const c of q) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
    }
    pendingIceRef.current[peerId] = [];
  }, []);

  /* ─── Join room ────────────────────────────────────────────────── */
  const joinRoom = useCallback(async () => {
    setError(null);
    await getLocalStream();
    const token = localStorage.getItem('token');
    if (!token) { setError('Not authenticated'); return; }

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => wsSend({ type: 'join-room', roomId, token });

    ws.onmessage = async (ev) => {
      const msg = JSON.parse(ev.data);

      switch (msg.type) {
        case 'room-joined': {
          myPeerIdRef.current = msg.peerId;
          setMyPeerId(msg.peerId);
          setConnected(true);
          setParticipantCount(msg.peers.length + 1);

          // We are "impolite" (offerer) toward existing peers
          for (const p of msg.peers) {
            const pc = createPC(p.peerId, p.user, false);
            // onnegotiationneeded fires automatically after addTrack
          }
          break;
        }

        case 'user-joined': {
          // We are "polite" toward newcomers (they send offers)
          createPC(msg.peerId, msg.user, true);
          setParticipantCount((c) => c + 1);
          break;
        }

        case 'offer': {
          let pc = pcsRef.current[msg.fromPeerId];
          if (!pc) pc = createPC(msg.fromPeerId, msg.user, true);

          const offerCollision =
            makingOfferRef.current[msg.fromPeerId] ||
            pc.signalingState !== 'stable';

          // If collision and we're impolite, ignore the offer
          // (Here the responder is always polite towards the offerer)
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));
            await flushIce(msg.fromPeerId);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            wsSend({ type: 'answer', targetPeerId: msg.fromPeerId, answer: pc.localDescription });
          } catch (e) {
            console.error('[Offer handling]', e);
          }
          break;
        }

        case 'answer': {
          const pc = pcsRef.current[msg.fromPeerId];
          if (pc) {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(msg.answer));
              await flushIce(msg.fromPeerId);
            } catch (e) {
              console.error('[Answer handling]', e);
            }
          }
          break;
        }

        case 'ice-candidate': {
          const pc = pcsRef.current[msg.fromPeerId];
          if (pc?.remoteDescription) {
            try { await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch {}
          } else {
            if (!pendingIceRef.current[msg.fromPeerId]) pendingIceRef.current[msg.fromPeerId] = [];
            pendingIceRef.current[msg.fromPeerId].push(msg.candidate);
          }
          break;
        }

        case 'user-toggle': {
          setPeers((prev) => ({
            ...prev,
            [msg.peerId]: {
              ...prev[msg.peerId],
              hasVideo: msg.kind === 'video' ? msg.enabled : prev[msg.peerId]?.hasVideo,
              hasAudio: msg.kind === 'audio' ? msg.enabled : prev[msg.peerId]?.hasAudio,
            },
          }));
          break;
        }

        case 'screen-share': {
          setPeers((prev) => ({
            ...prev,
            [msg.peerId]: { ...prev[msg.peerId], isScreenSharing: msg.active },
          }));
          break;
        }

        case 'user-left': {
          pcsRef.current[msg.peerId]?.close();
          delete pcsRef.current[msg.peerId];
          setPeers((prev) => { const n = { ...prev }; delete n[msg.peerId]; return n; });
          setParticipantCount((c) => Math.max(1, c - 1));
          break;
        }

        case 'chat-message': {
          setChatMessages((prev) => [...prev, {
            peerId: msg.peerId,
            user: msg.user,
            content: msg.content,
            timestamp: msg.timestamp,
          }]);
          break;
        }

        case 'error': setError(msg.message); break;
        default: break;
      }
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = () => setError('WebSocket connection failed');
  }, [roomId, getLocalStream, createPC, flushIce, wsSend]);

  /* ─── Toggle audio ─────────────────────────────────────────────── */
  const toggleAudio = useCallback(() => {
    if (!localStreamRef.current) return;
    const tracks = localStreamRef.current.getAudioTracks();
    tracks.forEach((t) => { t.enabled = !t.enabled; });
    const enabled = tracks[0]?.enabled ?? false;
    setIsAudioEnabled(enabled);
    wsSend({ type: 'user-toggle', kind: 'audio', enabled });
  }, [wsSend]);

  /* ─── Toggle video ─────────────────────────────────────────────── */
  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current) return;
    const tracks = localStreamRef.current.getVideoTracks();
    tracks.forEach((t) => { t.enabled = !t.enabled; });
    const enabled = tracks[0]?.enabled ?? false;
    setIsVideoEnabled(enabled);
    wsSend({ type: 'user-toggle', kind: 'video', enabled });
  }, [wsSend]);

  /* ─── Screen share (add/remove track + renegotiate) ────────────── */
  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      // STOP sharing — remove screen tracks from all PCs
      const stream = screenStreamRef.current;
      if (stream) {
        stream.getTracks().forEach((track) => {
          track.stop();
          for (const pc of Object.values(pcsRef.current)) {
            const sender = pc.getSenders().find((s) => s.track === track);
            if (sender) pc.removeTrack(sender);
          }
        });
      }
      screenStreamRef.current = null;
      setScreenStream(null);
      setIsScreenSharing(false);
      wsSend({ type: 'screen-share', active: false });
    } else {
      // START sharing — getDisplayMedia + add track to all PCs
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        screenStreamRef.current = stream;
        setScreenStream(stream);
        setIsScreenSharing(true);

        const screenTrack = stream.getVideoTracks()[0];

        // Add screen track to every peer connection
        for (const pc of Object.values(pcsRef.current)) {
          pc.addTrack(screenTrack, stream);
        }

        // When user clicks browser "Stop sharing"
        screenTrack.onended = () => {
          // Clean up
          stream.getTracks().forEach((t) => {
            t.stop();
            for (const pc of Object.values(pcsRef.current)) {
              const sender = pc.getSenders().find((s) => s.track === t);
              if (sender) pc.removeTrack(sender);
            }
          });
          screenStreamRef.current = null;
          setScreenStream(null);
          setIsScreenSharing(false);
          wsSend({ type: 'screen-share', active: false });
        };

        wsSend({ type: 'screen-share', active: true });
      } catch {
        console.warn('[ScreenShare] Cancelled');
      }
    }
  }, [isScreenSharing, wsSend]);

  /* ─── Chat ─────────────────────────────────────────────────────── */
  const sendChatMessage = useCallback((content) => {
    if (!content.trim()) return;
    wsSend({ type: 'chat-message', content: content.trim() });
  }, [wsSend]);

  /* ─── Leave ────────────────────────────────────────────────────── */
  const leaveRoom = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    Object.values(pcsRef.current).forEach((pc) => pc.close());
    pcsRef.current = {};
    try { wsSend({ type: 'leave-room' }); } catch {}
    wsRef.current?.close();
    wsRef.current = null;
    setLocalStream(null);
    setScreenStream(null);
    setPeers({});
    setConnected(false);
    setMyPeerId(null);
    setIsScreenSharing(false);
    setParticipantCount(1);
  }, [wsSend]);

  /* ─── Cleanup ──────────────────────────────────────────────────── */
  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      Object.values(pcsRef.current).forEach((pc) => pc.close());
      wsRef.current?.close();
    };
  }, []);

  return {
    localStream, screenStream, peers, chatMessages,
    isAudioEnabled, isVideoEnabled, isScreenSharing,
    myPeerId, connected, error, participantCount,
    joinRoom, leaveRoom, toggleAudio, toggleVideo,
    toggleScreenShare, sendChatMessage,
  };
}
