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
