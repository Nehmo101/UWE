import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@uwe/shared-ui", "@uwe/database", "@uwe/wiki-engine"],
};

export default nextConfig;
