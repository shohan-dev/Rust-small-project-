import type { NextConfig } from "next";

const backendBaseUrl = (process.env.BACKEND_INTERNAL_URL ?? "http://127.0.0.1:8080").replace(/\/$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendBaseUrl}/api/:path*`,
      },
      {
        source: "/ws",
        destination: `${backendBaseUrl}/ws`,
      },
    ];
  },
};

export default nextConfig;
