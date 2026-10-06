import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ocean/db"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.discordapp.com" }],
  },
};

export default nextConfig;
