'use client';

/**
 * Root page – redirects to dashboard if logged in, otherwise to login.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      router.replace(user ? '/dashboard' : '/login');
    }
  }, [user, loading, router]);

  return (
    <div className="auth-container">
      <div style={{ color: '#9aa0a6', fontSize: 18 }}>Loading...</div>
    </div>
  );
}
