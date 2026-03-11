'use client';

/**
 * CallControls – premium bottom control bar with SVG icons & tooltips.
 */
import {
  MicIcon, MicOffIcon,
  VideoIcon, VideoOffIcon,
  ScreenShareIcon, ScreenShareOffIcon,
  ChatIcon, PhoneOffIcon,
} from './Icons';

export default function CallControls({
  isAudioEnabled,
  isVideoEnabled,
  isScreenSharing,
  isChatOpen,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onToggleChat,
  onLeave,
  participantCount,
}) {
  return (
    <div className="control-bar">
      {/* Left: room info */}
      <div style={{ position: 'absolute', left: 20, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
        <span>{participantCount || 1} in call</span>
      </div>

      {/* Center controls */}
      <button
        className={`control-btn ${!isAudioEnabled ? 'danger-state' : ''}`}
        onClick={onToggleAudio}
      >
        <span className="tooltip">{isAudioEnabled ? 'Mute' : 'Unmute'}</span>
        {isAudioEnabled ? <MicIcon size={20} /> : <MicOffIcon size={20} />}
      </button>

      <button
        className={`control-btn ${!isVideoEnabled ? 'danger-state' : ''}`}
        onClick={onToggleVideo}
      >
        <span className="tooltip">{isVideoEnabled ? 'Stop video' : 'Start video'}</span>
        {isVideoEnabled ? <VideoIcon size={20} /> : <VideoOffIcon size={20} />}
      </button>

      <button
        className={`control-btn ${isScreenSharing ? 'active' : ''}`}
        onClick={onToggleScreenShare}
      >
        <span className="tooltip">{isScreenSharing ? 'Stop presenting' : 'Present screen'}</span>
        {isScreenSharing ? <ScreenShareOffIcon size={20} /> : <ScreenShareIcon size={20} />}
      </button>

      <button
        className={`control-btn ${isChatOpen ? 'active' : ''}`}
        onClick={onToggleChat}
      >
        <span className="tooltip">Chat</span>
        <ChatIcon size={20} />
      </button>

      <div style={{ width: 12 }} />

      <button className="control-btn leave-btn" onClick={onLeave}>
        <span className="tooltip">Leave call</span>
        <PhoneOffIcon size={20} />
      </button>

      {/* Right: spacer for symmetry */}
      <div style={{ position: 'absolute', right: 20, width: 80 }} />
    </div>
  );
}
