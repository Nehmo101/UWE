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

const rawPortalPath = process.env.PORTAL_PATH?.trim();
const basePath = rawPortalPath && rawPortalPath !== "/" ? rawPortalPath : undefined;

const nextConfig: NextConfig = {
  output: "standalone",
  basePath,
  ...standalone,
  /* jsdom/isomorphic-dompurify muessen extern bleiben (#84) — die Liste lebt
     zentral in @uwe/config (`uweServerOnlyHtmlPackages`), Begruendung dort. */
  serverExternalPackages: [...standalone.serverExternalPackages],
  transpilePackages: ["@uwe/shared-ui", "@uwe/auth", "@uwe/env"],
  async redirects() {
    // Gegenstueck zu apps/studio/next.config.ts — dieselbe Begruendung, dieselbe
    // Wahl von 307 statt 308. Die Ansicht im Portal ist die lesende.
    return [
      {
        source: "/auth/worlds/:worldSlug/atlas3d",
        destination: "/auth/worlds/:worldSlug/karten",
        permanent: false,
      },
      {
        source: "/auth/worlds/:worldSlug/atlas3d/:rest*",
        destination: "/auth/worlds/:worldSlug/karten",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: getUweSecurityHeaderEntries(),
      },
      {
        // Der Service Worker darf nicht altern: ein zwischengespeicherter
        // sw.js liefert wochenlang eine Fassung aus, die niemand mehr hat.
        source: "/sw.js",
        headers: [
          ...getUweSecurityHeaderEntries(),
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
  // Der gemeinsame Block traegt seit #84 auch jsdom/isomorphic-dompurify —
  // die Begruendung steht bei `uweServerOnlyHtmlPackages`.
  webpack: (config, context) => applyUweWebpackDefaults(config, context),
};

export default nextConfig;
