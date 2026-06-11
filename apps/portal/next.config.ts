import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@uwe/shared-ui", "@uwe/wiki-engine", "@uwe/auth"],
  serverExternalPackages: [
    "@libsql/client",
    "@prisma/adapter-libsql",
    "@prisma/client",
    "libsql",
  ],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)),
        "@libsql/client",
        "@prisma/adapter-libsql",
        "libsql",
      ];
    }
    return config;
  },
};

export default nextConfig;
