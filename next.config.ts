import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "12mb" }, // fotky k poptávce
  },
};

export default nextConfig;
