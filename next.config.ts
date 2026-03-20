import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output bundles server + dependencies into .next/standalone
  // This is required for Electron packaging
  output: "standalone",
};

export default nextConfig;
