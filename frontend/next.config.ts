import type { NextConfig } from "next";

// The browser only ever talks to the Next.js server: /api/* is proxied to the
// FastAPI backend. This keeps the auth cookie first-party (no CORS in the
// browser) and works both locally and inside docker-compose.
const backendUrl = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${backendUrl.replace(/\/$/, "")}/api/:path*` },
    ];
  },
};

export default nextConfig;
