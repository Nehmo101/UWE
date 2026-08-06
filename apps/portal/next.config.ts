import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import { getUweSecurityHeaderEntries } from "@uwe/auth/security-headers";
import { getUweStandaloneNextConfig } from "@uwe/config/next-standalone";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const standalone = getUweStandaloneNextConfig(appDir);

const rawPortalPath = process.env.PORTAL_PATH?.trim();
const basePath = rawPortalPath && rawPortalPath !== "/" ? rawPortalPath : undefined;

const nextConfig: NextConfig = {
  output: "standalone",
  basePath,
  ...standalone,
  /* Gegenstueck zu apps/studio/next.config.ts.

     `sanitizeWikiHtml` laeuft ueber isomorphic-dompurify und damit ueber jsdom,
     und jsdom liest zur Laufzeit eine eigene Datei: `browser/default-stylesheet.css`,
     aufgeloest gegen sein `__dirname`. Wird das Paket ins Server-Bundle gezogen,
     zeigt dieses `__dirname` auf das App-Verzeichnis — die Datei liegt aber
     weiterhin im Paket. Ergebnis im Standalone-Build:

       ENOENT … apps/portal/browser/default-stylesheet.css

     und zwar bei **jeder** Wiki-Seite, deren Inhalt HTML ist. Das Portal ist
     genau die lesende Ansicht, also trifft es dort alles. Extern gehalten
     behaelt jsdom sein eigenes Verzeichnis und findet seine Datei. */
  serverExternalPackages: [
    ...standalone.serverExternalPackages,
    "jsdom",
    "isomorphic-dompurify",
  ],
  // @uwe/character-creator liefert wie die anderen Pakete rohes TypeScript und
  // wird aus einer "use client"-Komponente importiert (der Charakter-Ersteller
  // liest den Katalog im Browser). Ohne Eintrag hier scheitert das Client-Bündel
  // stumm: der Chunk kommt nicht zustande, die Hydration bleibt aus, und die
  // Seite steht für immer auf „Portal wird geladen…".
  transpilePackages: ["@uwe/shared-ui", "@uwe/auth", "@uwe/env", "@uwe/character-creator"],
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
        // Nachlass des entfernten Tischmodus: Browser, die den alten Service
        // Worker noch registriert haben, sollen bei jedem Besuch die frische
        // (jetzt fehlende) Datei sehen und ihn dadurch loswerden — nicht
        // wochenlang eine zwischengespeicherte Fassung weiterfahren.
        source: "/sw.js",
        headers: [
          ...getUweSecurityHeaderEntries(),
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
  webpack: (config, { isServer, webpack }) => {
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /\.(md|txt)$/,
        contextRegExp: /[\\/]@libsql[\\/]/,
      }),
    );

    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals)
          ? config.externals
          : [config.externals].filter(Boolean)),
        "@libsql/client",
        "@prisma/adapter-libsql",
        "@prisma/adapter-pg",
        "@prisma/client",
        "libsql",
        "pg",
        // `serverExternalPackages` allein reicht hier nicht: `html-sanitize.ts`
        // holt isomorphic-dompurify per `require()` aus einem Workspace-Paket,
        // und webpack zieht es trotzdem ins Server-Bundle. Dann verrutscht
        // jsdoms `__dirname` und seine `browser/default-stylesheet.css` wird
        // unter `apps/portal/browser/` gesucht, wo sie nie liegt.
        "isomorphic-dompurify",
        "jsdom",
      ];
    }

    return config;
  },
};

export default nextConfig;
