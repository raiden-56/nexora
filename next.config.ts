import type { NextConfig } from "next";

/**
 * Two builds from one codebase:
 *  - default: the real app — Next.js server, API routes, JSON-file database, background scheduler.
 *  - NEXORA_STATIC=1 (`npm run build:pages`): a static export for GitHub Pages. The same route
 *    handlers and services are bundled into the browser (src/demo/backend.ts) with Node built-ins
 *    replaced by the shims in src/demo/shims, and data stored in the visitor's localStorage.
 */
const STATIC = process.env.NEXORA_STATIC === "1";
const basePath = STATIC ? (process.env.NEXORA_BASE_PATH ?? "") : "";
const shim = (f: string) => `./src/demo/shims/${f}`;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_NEXORA_STATIC: STATIC ? "1" : "0",
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  turbopack: {
    resolveAlias: STATIC
      ? {
          "nexora-demo-backend": "./src/demo/backend.ts",
          "@/server/guard": shim("empty.ts"),
          "@/server/next-headers": shim("headers.ts"),
          "@/server/next-server": shim("server.ts"),
          "@/server/node-fs": shim("fs.ts"),
          "@/server/node-path": shim("path.ts"),
          "@/server/node-crypto": shim("crypto.ts"),
        }
      : { "nexora-demo-backend": "./src/demo/disabled.ts" },
  },
  ...(STATIC
    ? {
        output: "export" as const,
        basePath,
        trailingSlash: true,
        images: { unoptimized: true },
        // Route handlers (*.ts) can't be exported; the browser bundle imports them directly instead.
        pageExtensions: ["tsx"],
      }
    : {
        async headers() {
          return [
            {
              source: "/(.*)",
              headers: [
                { key: "X-Content-Type-Options", value: "nosniff" },
                { key: "X-Frame-Options", value: "DENY" },
                { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
              ],
            },
          ];
        },
      }),
};

export default nextConfig;
