"use client";

import Link from "next/link";

export default function DashboardPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Dashboard</h1>
      <p>Create/join room UI will be expanded in next phase.</p>
      <Link href="/room/demo-room">Open demo room page</Link>
    </main>
  );
}
