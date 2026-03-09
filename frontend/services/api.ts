import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8080",
  timeout: 10_000,
});

// Attach JWT on every request when present.
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("nexroom-auth");
      if (raw) {
        const { state } = JSON.parse(raw) as { state: { token: string | null } };
        if (state?.token) {
          config.headers = config.headers ?? {};
          config.headers["Authorization"] = `Bearer ${state.token}`;
        }
      }
    } catch {
      // ignore parse errors
    }
  }
  return config;
});

