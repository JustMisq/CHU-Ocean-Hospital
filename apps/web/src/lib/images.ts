import "server-only";
import { prisma } from "@ocean/db";

/** Taille max après redimensionnement côté navigateur (une photo fait ~30 Ko, une bannière ~150 Ko). */
const MAX_BYTES = 600 * 1024;
const PREFIX = "/api/images/";

/** Signature binaire de chaque format accepté : on ne se fie pas au type annoncé. */
const SIGNATURES: Record<string, (b: Buffer) => boolean> = {
  "image/webp": (b) => b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP",
  "image/png": (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
};

/** "data:image/webp;base64,…" → image enregistrée, ou message d'erreur. */
export async function saveDataUrlImage(dataUrl: string): Promise<{ url: string } | { error: string }> {
  const match = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match || !SIGNATURES[match[1]]) return { error: "Format d'image non pris en charge (PNG, JPEG ou WebP)." };

  const data = Buffer.from(match[2], "base64");
  if (data.length > MAX_BYTES) return { error: "Image trop lourde." };
  if (!SIGNATURES[match[1]](data)) return { error: "Fichier image invalide." };

  const image = await prisma.image.create({ data: { mimeType: match[1], data } });
  return { url: PREFIX + image.id };
}

/** Supprime une image envoyée sur le site (sans effet sur un lien externe). */
export async function deleteStoredImage(url: string | null | undefined) {
  if (!url?.startsWith(PREFIX)) return;
  await prisma.image.deleteMany({ where: { id: url.slice(PREFIX.length) } });
}
