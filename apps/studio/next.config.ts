import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@uwe/shared-ui", "@uwe/database", "@uwe/wiki-engine", "@uwe/ai-brain"],
};

export default nextConfig;
