import type { NextConfig } from "next";
import { getUweSecurityHeaderEntries } from "@uwe/auth/security-headers";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: [
    "@uwe/shared-ui",
    "@uwe/wiki-engine",
    "@uwe/ai-brain",
    "@uwe/static-export",
    "@uwe/env",
  ],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: getUweSecurityHeaderEntries(),
      },
    ];
  },
  serverExternalPackages: [
    "@libsql/client",
    "@prisma/adapter-libsql",
    "@prisma/client",
    "libsql",
    "better-sqlite3",
  ],
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
        "libsql",
      ];
    }

    return config;
  },
};

export default nextConfig;
