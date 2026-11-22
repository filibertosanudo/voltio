import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // One self-contained server.js with only the traced dependencies: a small
  // image that runs on any host with Node, not just a managed platform.
  output: "standalone",
  turbopack: {
    root: __dirname,
  },
  // Native binaries: required at runtime with Node's own resolution rather
  // than passed through the bundler.
  serverExternalPackages: ["@node-rs/argon2", "nodemailer"],
  experimental: {
    serverActions: {
      // Intake photos come straight from a phone camera. The action itself
      // enforces the real per-file limit (lib/photos/validate.ts); this only
      // has to be high enough to let that check run.
      bodySizeLimit: "9mb",
    },
  },
  // Content-Security-Policy is set per request in proxy.ts: it needs a fresh
  // nonce every time, which a static header list cannot give it.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
