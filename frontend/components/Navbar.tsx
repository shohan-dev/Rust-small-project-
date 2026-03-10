"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../store/auth";

export default function Navbar() {
  const { hydrated, user, token, logout } = useAuthStore();
  const router = useRouter();
  const isAuthenticated = hydrated && Boolean(token && user);
  const currentUser = isAuthenticated ? user : null;

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link href={isAuthenticated ? "/dashboard" : "/"} className="navbar-brand">
          <div className="navbar-brand-icon">🎥</div>
          <span>NexRoom</span>
        </Link>

        <div className="navbar-actions">
          {!hydrated ? null : currentUser ? (
            <div className="navbar-user">
              <div className="avatar" style={{ width: 30, height: 30, fontSize: 12 }}>
                {currentUser.username.charAt(0).toUpperCase()}
              </div>
              <span>{currentUser.username}</span>
              <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
                Sign out
              </button>
            </div>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm">
                Sign in
              </Link>
              <Link href="/register" className="btn btn-primary btn-sm">
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
