import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@uwe/shared-ui", "@uwe/wiki-engine", "@uwe/auth"],
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
