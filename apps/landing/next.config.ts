import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import { getUweSecurityHeaderEntries } from "@uwe/auth/security-headers";
import { getUweStandaloneNextConfig } from "@uwe/config/next-standalone";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const standalone = getUweStandaloneNextConfig(appDir);

// Die Landing läuft auf dem Apex-Origin (uwe.example, Standard-Port 3103)
// und wird nie unter einem Sub-Pfad geproxied — deshalb kein basePath. Sie ist
// bewusst die einzige öffentliche Fläche dieses Origins: Studio, Portal und
// Brain liegen auf eigenen Subdomains (siehe middleware.ts).
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
