import axios from "axios";

// Shared API client for backend communication.
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8080",
  timeout: 10_000,
});
