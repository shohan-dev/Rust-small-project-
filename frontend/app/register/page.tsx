"use client";

import { useState } from "react";
import { api } from "../../services/api";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [result, setResult] = useState("");

  const submit = async () => {
    try {
      const res = await api.post("/api/auth/register", { username, password });
      setResult(JSON.stringify(res.data));
    } catch {
      setResult("register failed");
    }
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Register</h1>
      <input placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)} />
      <input placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button onClick={submit}>Create account</button>
      <pre>{result}</pre>
    </main>
  );
}
