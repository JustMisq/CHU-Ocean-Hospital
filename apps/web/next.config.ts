import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ocean/db"],
  // Photo + bannière envoyées ensemble depuis /pro/profil (déjà compressées, ~200 Ko en général).
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.discordapp.com" }],
  },
};

export default nextConfig;
