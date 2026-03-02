"use client";

import { useParams } from "next/navigation";

export default function RoomPage() {
  const params = useParams<{ id: string }>();

  return (
    <main style={{ padding: 24 }}>
      <h1>Room {params.id}</h1>
      <p>Video grid, controls, and chat sidebar are scaffold targets for next phase.</p>
    </main>
  );
}
