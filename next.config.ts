import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: generates out/ directory, no Node.js server needed.
  // Electron serves the files directly via a custom app:// protocol.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
