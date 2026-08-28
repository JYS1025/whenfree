import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow server components to use node built-in modules
  serverExternalPackages: ["node:sqlite"],
};

export default nextConfig;
