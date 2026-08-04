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

// Die Landing läuft auf dem Apex-Origin (uwe.example, Standard-Port 3103)
// und wird nie unter einem Sub-Pfad geproxied — deshalb kein basePath. Sie ist
// bewusst die einzige öffentliche Fläche dieses Origins: Studio, Portal und
// Brain liegen auf eigenen Subdomains (siehe middleware.ts).
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
  transpilePackages: ["@uwe/shared-ui", "@uwe/auth", "@uwe/env"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: getUweSecurityHeaderEntries(),
      },
    ];
  },
  webpack: (config, context) => applyUweWebpackDefaults(config, context),
};

export default nextConfig;
