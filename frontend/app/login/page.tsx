"use client";

import { useState } from "react";
import { api } from "../../services/api";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [result, setResult] = useState("");

  const submit = async () => {
    try {
      const res = await api.post("/api/auth/login", { username, password });
      setResult(JSON.stringify(res.data));
    } catch {
      setResult("login failed");
    }
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Login</h1>
      <input placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)} />
      <input placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button onClick={submit}>Login</button>
      <pre>{result}</pre>
    </main>
  );
}
