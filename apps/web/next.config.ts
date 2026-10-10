import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ocean/db"],
  // Génération des PDF d'ordonnance côté serveur : chargés tels quels par Node, pas bundlés.
  // Conversion PDF → PNG (pdf.js + canvas natif) : idem.
  serverExternalPackages: ["@react-pdf/renderer", "jsbarcode", "pdfjs-dist", "@napi-rs/canvas"],
  // Polices standard de pdf.js, lues sur le disque (pas importées) : à embarquer dans la fonction au déploiement.
  outputFileTracingIncludes: { "/api/documents/[id]": ["../../node_modules/pdfjs-dist/standard_fonts/**", "./node_modules/pdfjs-dist/standard_fonts/**"] },
  // Photo + bannière envoyées ensemble depuis /pro/profil (déjà compressées, ~200 Ko en général).
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
};

export default nextConfig;
