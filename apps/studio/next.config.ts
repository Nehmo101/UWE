import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import { getUweSecurityHeaderEntries } from "@uwe/auth/security-headers";
import { getUweStandaloneNextConfig } from "@uwe/config/next-standalone";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const standalone = getUweStandaloneNextConfig(appDir);

const nextConfig: NextConfig = {
  output: "standalone",
  ...standalone,
  serverExternalPackages: [
    ...standalone.serverExternalPackages,
    "jsdom",
    "isomorphic-dompurify",
    "pdf-parse",
  ],
  experimental: {
    // Import-Zentrale: PDF- und Obsidian-Vault-ZIP-Uploads laufen als Base64
    // durch Server Actions (max. 10 MB Datei ≈ 13,4 MB Base64-Payload).
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
  transpilePackages: [
    "@uwe/shared-ui",
    "@uwe/ai-brain",
    "@uwe/static-export",
    "@uwe/env",
  ],
  async redirects() {
    /* Die Karten lagen bis Juli 2026 unter /atlas3d. Terra hat den Editor
       abgeloest, und der Pfad heisst seither nach der Sache — aber gespeicherte
       Links und Lesezeichen sollen nicht ins Leere laufen.

       `permanent: false` (307) statt 308: die Umbenennung ist jung, und ein
       dauerhafter Redirect brennt sich in jeden Browsercache ein. Wer sie
       spaeter zurueckdrehen wollte, kaeme gegen die Caches nicht mehr an. */
    return [
      {
        source: "/worlds/:worldSlug/atlas3d",
        destination: "/worlds/:worldSlug/karten",
        permanent: false,
      },
      {
        source: "/worlds/:worldSlug/atlas3d/:rest*",
        destination: "/worlds/:worldSlug/karten",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    const portalPath = process.env.PORTAL_PATH?.trim();
    if (!portalPath || portalPath === "/") return [];
    const proxyBase = (
      process.env.PORTAL_PROXY_URL ||
      `http://127.0.0.1:${process.env.PORTAL_PORT || "3001"}`
    ).replace(/\/$/, "");
    return [
      { source: portalPath, destination: `${proxyBase}${portalPath}` },
      { source: `${portalPath}/:path*`, destination: `${proxyBase}${portalPath}/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: getUweSecurityHeaderEntries(),
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
      ];
    }

    return config;
  },
};

export default nextConfig;
