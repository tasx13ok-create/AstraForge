import type { NextConfig } from "next";

function apiOrigin() {
  const raw = process.env.ASTRA_API_ORIGIN?.trim();
  if (!raw) return null;
  const url = new URL(raw);
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new Error("ASTRA_API_ORIGIN must use HTTPS outside local development.");
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error("ASTRA_API_ORIGIN must be an origin without a path, query, or hash.");
  }
  return url.origin;
}

const backendOrigin = apiOrigin();

const nextConfig: NextConfig = {
  async rewrites() {
    if (!backendOrigin) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${backendOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
