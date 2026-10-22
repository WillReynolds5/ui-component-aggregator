import type { NextConfig } from "next";

const RENDER_CSP = "sandbox allow-scripts allow-pointer-lock allow-forms";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  output: "standalone",
  async headers() {
    return [
      {
        // Live component renders are third-party code. Force them into a sandbox (opaque
        // origin) even when opened directly; CloudFront sets the same header in production.
        source: "/renders/:path*",
        headers: [{ key: "Content-Security-Policy", value: RENDER_CSP }],
      },
    ];
  },
  images: {
    unoptimized: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
