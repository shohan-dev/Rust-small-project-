"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../store/auth";

export default function Navbar() {
  const { user, token, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link href={token ? "/dashboard" : "/"} className="navbar-brand">
          <div className="navbar-brand-icon">🎥</div>
          <span>NexRoom</span>
        </Link>

        <div className="navbar-actions">
          {token && user ? (
            <div className="navbar-user">
              <div className="avatar" style={{ width: 30, height: 30, fontSize: 12 }}>
                {user.username.charAt(0).toUpperCase()}
              </div>
              <span>{user.username}</span>
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
