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

// Family runs on its own origin (default :3004) and is never proxied under a
// sub-path, so there is no basePath. Zugang braucht das Häkchen `Family` — jede
// Route prüft es server-seitig; wie die App erreicht wird (loopback / LAN /
// Tunnel) ist eine getrennte Deployment-Entscheidung.
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
  transpilePackages: ["@uwe/shared-ui", "@uwe/auth", "@uwe/env", "@uwe/ai-brain"],
  async headers() {
    return [
      {
        source: "/:path*",
        // Kein Mikrofon: das Diktat gibt es nur in Brain. Family bleibt bei den
        // Standard-Berechtigungen.
        headers: getUweSecurityHeaderEntries(process.env, { allowYouTubeEmbeds: false }),
      },
    ];
  },
  webpack: (config, context) => applyUweWebpackDefaults(config, context),
};

export default nextConfig;
