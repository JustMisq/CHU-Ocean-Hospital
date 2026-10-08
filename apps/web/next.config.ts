import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ocean/db"],
  // Génération des PDF d'ordonnance côté serveur : chargés tels quels par Node, pas bundlés.
  serverExternalPackages: ["@react-pdf/renderer", "jsbarcode"],
  // Photo + bannière envoyées ensemble depuis /pro/profil (déjà compressées, ~200 Ko en général).
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
};

export default nextConfig;
