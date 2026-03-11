'use client';

/**
 * Dashboard – premium meeting hub with rooms, create/join options.
 */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { apiFetch } from '@/lib/api';
import { MeetLogo, PlusIcon, LinkIcon, LogOutIcon, UserIcon, CalendarIcon, VideoIcon } from '@/components/Icons';

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [rooms, setRooms] = useState([]);
  const [joinCode, setJoinCode] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      apiFetch('/api/rooms')
        .then((data) => setRooms(data.rooms || []))
        .catch(() => {});
    }
  }, [user]);

  const handleCreateRoom = async () => {
    setCreating(true);
    try {
      const data = await apiFetch('/api/rooms', {
        method: 'POST',
        body: JSON.stringify({ name: newRoomName || undefined }),
      });
      router.push(`/room/${data.room.id}`);
    } catch (err) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleJoinRoom = () => {
    const code = joinCode.trim();
    if (!code) return;
    const match = code.match(/\/room\/([a-z]{3}-[a-z]{4}-[a-z]{3})/);
    const roomId = match ? match[1] : code;
    router.push(`/room/${roomId}`);
  };

  if (loading || !user) {
    return (
      <div className="auth-container">
        <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
      </div>
    );
  }

  const initial = (user.displayName || user.email || '?')[0].toUpperCase();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* ─── Header ─────────────────────────────────────────────── */}
      <header className="dashboard-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <MeetLogo size={30} />
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.4px' }}>MeetClone</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link
            href="/profile"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500,
              padding: '6px 12px', borderRadius: 'var(--radius-sm)',
              transition: 'all var(--transition)',
            }}
          >
            <UserIcon size={15} />
            Profile
          </Link>
          <div
            style={{
              width: 34, height: 34, borderRadius: '50%',
              background: user.avatarColor || '#6366f1',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 14, color: 'white',
            }}
          >
            {initial}
          </div>
          <button
            onClick={logout}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 14px', borderRadius: 'var(--radius-sm)',
              background: 'var(--surface-hover)', color: 'var(--text-secondary)',
              fontSize: 13, fontWeight: 500, transition: 'all var(--transition)',
            }}
          >
            <LogOutIcon size={14} />
            Logout
          </button>
        </div>
      </header>

      {/* ─── Main Content ───────────────────────────────────────── */}
      <main style={{ maxWidth: 960, margin: '0 auto', padding: '48px 24px' }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 48 }} className="animate-fade-in">
          <h1 style={{ fontSize: 40, fontWeight: 300, marginBottom: 8, letterSpacing: '-1px' }}>
            Premium video meetings
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 17 }}>
            Secure, real-time video conferencing for everyone.
          </p>
        </div>

        {/* Action Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 20,
            marginBottom: 48,
          }}
          className="animate-fade-in"
        >
          {/* Create Room */}
          <div className="room-card" style={{ cursor: 'default' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                background: 'var(--primary-soft)', color: 'var(--primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <PlusIcon size={18} />
              </div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>New Meeting</h3>
            </div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Room name (optional)"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateRoom()}
              />
            </div>
            <button className="btn-primary" onClick={handleCreateRoom} disabled={creating}>
              {creating ? 'Creating...' : 'Create Room'}
            </button>
          </div>

          {/* Join Room */}
          <div className="room-card" style={{ cursor: 'default' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                background: 'var(--success-soft)', color: 'var(--success)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <LinkIcon size={18} />
              </div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Join Meeting</h3>
            </div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Enter room code or link"
                onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
              />
            </div>
            <button className="btn-primary" onClick={handleJoinRoom}>
              Join
            </button>
          </div>
        </div>

        {/* Recent Rooms */}
        <div className="animate-fade-in">
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 14, letterSpacing: '-0.3px' }}>Recent Meetings</h2>
          {rooms.length === 0 ? (
            <div style={{
              padding: 40, textAlign: 'center', color: 'var(--text-muted)',
              background: 'var(--surface)', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
            }}>
              <VideoIcon size={32} />
              <div style={{ marginTop: 12, fontSize: 14 }}>No meetings yet. Create one to get started!</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="room-card"
                  onClick={() => router.push(`/room/${room.id}`)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 'var(--radius-sm)',
                      background: 'var(--primary-soft)', color: 'var(--primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <VideoIcon size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{room.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                        <span>{room.id}</span>
                        <span style={{ opacity: 0.3 }}>|</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <CalendarIcon size={11} />
                          {new Date(room.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    style={{
                      padding: '7px 18px', borderRadius: 'var(--radius-xl)',
                      background: 'var(--primary)', color: 'white',
                      fontSize: 13, fontWeight: 600, transition: 'all var(--transition)',
                    }}
                  >
                    Join
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
