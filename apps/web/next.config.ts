import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ocean/db"],
  // Photo + bannière envoyées ensemble depuis /pro/profil (déjà compressées, ~200 Ko en général).
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
};

export default nextConfig;
