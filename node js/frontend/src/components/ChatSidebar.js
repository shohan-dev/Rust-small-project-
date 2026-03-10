'use client';

/**
 * ChatSidebar – premium real-time chat panel with grouped messages.
 */
import { useState, useRef, useEffect } from 'react';
import { CloseIcon, SendIcon, ChatIcon } from './Icons';

export default function ChatSidebar({ messages, onSend, onClose }) {
  const [text, setText] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text);
    setText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const fmt = (ts) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="chat-sidebar">
      {/* Header */}
      <div className="chat-header">
        <h3>In-call messages</h3>
        <button
          onClick={onClose}
          style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--surface-hover)', color: 'var(--text-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all var(--transition)',
          }}
        >
          <CloseIcon size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <ChatIcon size={36} />
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}>No messages yet</div>
              <div>Messages are visible to everyone in the call and deleted when it ends.</div>
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className="chat-msg-group">
              {(i === 0 || messages[i - 1]?.peerId !== msg.peerId) && (
                <div className="chat-msg-sender">
                  {msg.user?.displayName || 'Unknown'}
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>{fmt(msg.timestamp)}</span>
                </div>
              )}
              <div className="chat-msg-bubble">{msg.content}</div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Send a message..."
        />
        <button onClick={handleSend} disabled={!text.trim()}>
          <SendIcon size={16} />
        </button>
      </div>
    </div>
  );
}
