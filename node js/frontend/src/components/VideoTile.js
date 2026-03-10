'use client';

/**
 * VideoTile – premium participant video/avatar tile with status indicators.
 */
import { useEffect, useRef } from 'react';
import { MicOffIcon, ScreenShareIcon } from './Icons';

export default function VideoTile({
  stream,
  displayName,
  avatarColor,
  hasVideo,
  hasAudio,
  isSelf,
  isScreenShare,
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    const el = videoRef.current;
    if (el && stream) {
      if (el.srcObject !== stream) {
        el.srcObject = stream;
      }
    }
    return () => {
      if (el) el.srcObject = null;
    };
  }, [stream]);

  const initial = (displayName || '?')[0].toUpperCase();
  const showVideo = stream && hasVideo;
  const color = avatarColor || '#6366f1';

  return (
    <div className="video-tile">
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSelf}
          style={{
            transform: isSelf && !isScreenShare ? 'scaleX(-1)' : 'none',
          }}
        />
      ) : (
        <div className="avatar-fallback" style={{ background: color }}>
          {initial}
        </div>
      )}

      {isScreenShare && (
        <div className="screen-badge">
          <ScreenShareIcon size={12} />
          <span>Presenting</span>
        </div>
      )}

      <div className="name-tag">
        {!hasAudio && (
          <span style={{ color: 'var(--danger)', display: 'flex' }}>
            <MicOffIcon size={13} />
          </span>
        )}
        <span>{isSelf ? `${displayName || 'You'} (You)` : displayName || 'Participant'}</span>
      </div>
    </div>
  );
}
