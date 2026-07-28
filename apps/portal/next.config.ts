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
