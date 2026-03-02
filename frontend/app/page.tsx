import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Real-Time WebRTC Platform</h1>
      <p>Phase 1 scaffold is ready.</p>
      <div style={{ display: "flex", gap: 12 }}>
        <Link href="/login">Login</Link>
        <Link href="/register">Register</Link>
        <Link href="/dashboard">Dashboard</Link>
      </div>
    </main>
  );
}
