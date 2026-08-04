import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import { getUweSecurityHeaderEntries } from "@uwe/auth/security-headers";
import {
  applyUweWebpackDefaults,
  getUweStandaloneNextConfig,
} from "@uwe/config/next-standalone";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const standalone = getUweStandaloneNextConfig(appDir);

// Brain runs on its own origin (default :3002) and is never proxied under a
// sub-path, so there is no basePath. Access needs the brain checkbox — every route verifies
// the `owner` role server-side; how it is reached (loopback / lan / public via
// the owner-gated tunnel) is a separate deployment choice (see ADR 004/007).
// Turbopack-Entscheidung (Next 16): Alle fünf Apps bauen mit `--webpack`.
// Der Grund ist der webpack-Block unten — `applyUweWebpackDefaults` braucht
// IgnorePlugin (libsql-Doku-Dateien) und die Server-`externals` (Prisma-
// Runtime + jsdom-Familie, #84). Turbopack kennt weder IgnorePlugin noch
// diese externals-Form; `serverExternalPackages` allein reicht nicht, weil
// Workspace-Pakete isomorphic-dompurify per require() ziehen. Wer auf
// Turbopack umstellen will, muss zuerst nachweisen, dass kein Server-Chunk
// jsdom-Interna enthält (scripts/server-externals-check.mjs bleibt das Gate).
const nextConfig: NextConfig = {
  output: "standalone",
  ...standalone,
  // jsdom/isomorphic-dompurify bleiben extern (#84) — zentral in @uwe/config.
  serverExternalPackages: [...(standalone.serverExternalPackages ?? [])],
  transpilePackages: [
    "@uwe/shared-ui",
    "@uwe/auth",
    "@uwe/env",
    "@uwe/mail",
    "@uwe/mail-core",
    "@uwe/ai-brain",
    "@uwe/brain-assistant",
  ],
  async headers() {
    return [
      {
        source: "/:path*",
        // Brain is the only surface that may use the microphone (assistant
        // dictation, same-origin). Camera and everything else stay denied.
        headers: getUweSecurityHeaderEntries(process.env, {
          allowYouTubeEmbeds: true,
          allowMicrophone: true,
        }),
      },
    ];
  },
  webpack: (config, context) => applyUweWebpackDefaults(config, context),
};

export default nextConfig;
