import type { NextConfig } from "next";
import path from "path";

const isDevServer = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  distDir: isDevServer ? ".next-dev" : ".next-build",
  outputFileTracingRoot: path.join(__dirname),
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "basemap.nationalmap.gov"
      }
    ]
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb"
    }
  }
};

export default nextConfig;
