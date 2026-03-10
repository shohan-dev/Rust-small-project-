'use client';

/**
 * Profile page – premium settings with avatar color picker.
 */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { MeetLogo, ArrowLeftIcon, CheckIcon, UserIcon } from '@/components/Icons';

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#a855f7', '#f43f5e',
];

export default function ProfilePage() {
  const { user, loading, updateProfile } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [avatarColor, setAvatarColor] = useState('#6366f1');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
    if (user) {
      setDisplayName(user.displayName || '');
      setAvatarColor(user.avatarColor || '#6366f1');
    }
  }, [user, loading, router]);

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      await updateProfile({ displayName, avatarColor });
      setMessage('Profile updated successfully!');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="auth-container">
        <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
      </div>
    );
  }

  const initial = (displayName || user.email || '?')[0].toUpperCase();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <header className="dashboard-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <MeetLogo size={32} />
          <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>MeetClone</span>
        </div>
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--primary)', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
          <ArrowLeftIcon size={14} />
          Back to Dashboard
        </Link>
      </header>

      <main style={{ maxWidth: 500, margin: '0 auto', padding: '40px 24px' }}>
        <div className="auth-card animate-fade-in">
          <h1 style={{ marginBottom: 8 }}>Edit Profile</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 28 }}>Customize how others see you in meetings</p>

          {/* Avatar Preview */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${avatarColor}, ${avatarColor}dd)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 38,
                fontWeight: 700,
                color: 'white',
                boxShadow: `0 0 0 4px var(--bg-secondary), 0 8px 24px ${avatarColor}40`,
                transition: 'all 0.3s ease',
              }}
            >
              {initial}
            </div>
          </div>

          {/* Display Name */}
          <div className="form-group">
            <label htmlFor="name">Display Name</label>
            <input
              id="name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your display name"
            />
          </div>

          {/* Avatar Color Picker */}
          <div className="form-group">
            <label>Avatar Color</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setAvatarColor(color)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: color,
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    outline: avatarColor === color ? `2px solid ${color}` : '2px solid transparent',
                    outlineOffset: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {avatarColor === color && <CheckIcon size={16} />}
                </button>
              ))}
            </div>
          </div>

          {/* Email (read-only) */}
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={user.email} disabled style={{ opacity: 0.4 }} />
          </div>

          {message && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                marginBottom: 16,
                fontSize: 13,
                background: message.includes('success')
                  ? 'rgba(34,197,94,0.12)'
                  : 'rgba(239,68,68,0.12)',
                color: message.includes('success') ? '#22c55e' : '#ef4444',
                border: `1px solid ${message.includes('success') ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
              }}
            >
              {message}
            </div>
          )}

          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </main>
    </div>
  );
}
