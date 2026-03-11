'use client';

/**
 * Room page – premium video call interface with grid, controls, and chat.
 */
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { apiFetch } from '@/lib/api';
import useWebRTC from '@/hooks/useWebRTC';
import VideoTile from '@/components/VideoTile';
import CallControls from '@/components/CallControls';
import ChatSidebar from '@/components/ChatSidebar';
import { MeetLogo, CopyIcon, UsersIcon } from '@/components/Icons';

export default function RoomPage() {
  const params = useParams();
  const roomId = params.id;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [roomInfo, setRoomInfo] = useState(null);
  const [joined, setJoined] = useState(false);
  const [copied, setCopied] = useState(false);

  const {
    localStream, screenStream, peers, chatMessages,
    isAudioEnabled, isVideoEnabled, isScreenSharing,
    connected, error, participantCount,
    joinRoom, leaveRoom, toggleAudio, toggleVideo,
    toggleScreenShare, sendChatMessage,
  } = useWebRTC(roomId);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/login?redirect=/room/${roomId}`);
    }
  }, [user, authLoading, router, roomId]);

  useEffect(() => {
    if (!user || !roomId) return;
    apiFetch(`/api/rooms/${roomId}`).then((d) => setRoomInfo(d.room)).catch(() => {});
    apiFetch(`/api/rooms/${roomId}/join`, { method: 'POST' }).catch(() => {});
  }, [user, roomId]);

  useEffect(() => {
    if (user && roomId && !joined) {
      setJoined(true);
      joinRoom();
    }
  }, [user, roomId, joined, joinRoom]);

  const handleLeave = () => {
    leaveRoom();
    apiFetch(`/api/rooms/${roomId}/leave`, { method: 'POST' }).catch(() => {});
    router.push('/dashboard');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`${window.location.origin}/room/${roomId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (authLoading || !user) {
    return (
      <div className="auth-container">
        <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
      </div>
    );
  }

  const peerEntries = Object.entries(peers);
  const total = peerEntries.length + 1;
  const gridClass =
    total <= 1 ? 'grid-1' : total <= 2 ? 'grid-2' : total <= 4 ? 'grid-4' : 'grid-many';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}>
      {/* ─── Top Bar ───────────────────────────────────────────── */}
      <div className="room-top-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <MeetLogo size={28} />
          <span style={{ fontWeight: 600, fontSize: 15, letterSpacing: '-0.3px' }}>
            {roomInfo?.name || `Room ${roomId}`}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span className={`status-dot ${connected ? 'connected' : 'disconnected'}`} />
            <span style={{ color: connected ? 'var(--success)' : 'var(--danger)' }}>
              {connected ? 'Connected' : 'Connecting...'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)', fontSize: 13 }}>
            <UsersIcon size={14} />
            <span>{total}</span>
          </div>
          <button
            onClick={handleCopy}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 12px', borderRadius: 'var(--radius-sm)',
              background: copied ? 'var(--success-soft)' : 'var(--surface-hover)',
              color: copied ? 'var(--success)' : 'var(--text-secondary)',
              fontSize: 12, fontWeight: 500, transition: 'all var(--transition)',
            }}
          >
            <CopyIcon size={13} />
            {copied ? 'Copied!' : 'Copy link'}
          </button>
        </div>
      </div>

      {/* ─── Main Area ─────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {error && (
            <div style={{
              padding: '10px 20px', background: 'var(--danger-soft)',
              color: 'var(--danger)', textAlign: 'center', fontSize: 13, fontWeight: 500,
            }}>
              {error}
            </div>
          )}

          <div className={`video-grid ${gridClass}`} style={{ height: '100%' }}>
            {/* Self tile */}
            <VideoTile
              stream={isScreenSharing ? screenStream : localStream}
              displayName={user.displayName || user.email}
              avatarColor={user.avatarColor}
              hasVideo={isScreenSharing || isVideoEnabled}
              hasAudio={isAudioEnabled}
              isSelf={true}
              isScreenShare={isScreenSharing}
            />

            {/* Remote peers */}
            {peerEntries.map(([peerId, peer]) => (
              <VideoTile
                key={peerId}
                stream={peer.screenStream || peer.stream}
                displayName={peer.user?.displayName || 'Participant'}
                avatarColor={peer.user?.avatarColor || '#6366f1'}
                hasVideo={peer.hasVideo || !!peer.screenStream}
                hasAudio={peer.hasAudio}
                isSelf={false}
                isScreenShare={peer.isScreenSharing}
              />
            ))}
          </div>
        </div>

        {isChatOpen && (
          <ChatSidebar
            messages={chatMessages}
            onSend={sendChatMessage}
            onClose={() => setIsChatOpen(false)}
          />
        )}
      </div>

      {/* ─── Bottom Controls ───────────────────────────────────── */}
      <CallControls
        isAudioEnabled={isAudioEnabled}
        isVideoEnabled={isVideoEnabled}
        isScreenSharing={isScreenSharing}
        isChatOpen={isChatOpen}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onToggleScreenShare={toggleScreenShare}
        onToggleChat={() => setIsChatOpen(!isChatOpen)}
        onLeave={handleLeave}
        participantCount={total}
      />
    </div>
  );
}
