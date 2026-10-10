import "server-only";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createCanvas } from "@napi-rs/canvas";

/**
 * Dossier des polices standard de pdf.js (Helvetica… : les PDF générés ne les incluent pas).
 * node_modules de l'appli ou, en monorepo, celui de la racine (inclus au déploiement : voir next.config.ts).
 */
function standardFonts() {
  const candidates = [join(process.cwd(), "node_modules"), join(process.cwd(), "../../node_modules")].map((dir) => join(dir, "pdfjs-dist", "standard_fonts"));
  const found = candidates.find((dir) => existsSync(dir));
  return found ? `${found}/` : undefined;
}

/**
 * PDF → image PNG (toutes les pages l'une sous l'autre), rendue par pdf.js : exactement le même document que le PDF.
 * `scale` 2 ≈ 144 ppp, net à l'écran et à l'impression.
 */
export async function pdfToPng(pdf: Uint8Array, scale = 2): Promise<Buffer> {
  // Pas de thread séparé côté serveur : le « worker » de pdf.js tourne dans le même processus. Il doit être chargé AVANT
  // pdf.js, qui sinon cherche à l'importer lui-même par un chemin que le bundler ne connaît pas (et garde l'échec en cache).
  const g = globalThis as { pdfjsWorker?: unknown };
  g.pdfjsWorker ??= await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: pdf, standardFontDataUrl: standardFonts() }).promise;

  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    // @ts-expect-error -- canvas de @napi-rs/canvas, compatible avec celui du navigateur pour pdf.js
    await page.render({ canvasContext: context, viewport, canvas }).promise;
    pages.push(canvas);
  }
  await doc.destroy();

  // Pages empilées, séparées par une marge grise.
  const gap = pages.length > 1 ? Math.round(16 * scale) : 0;
  const width = Math.max(...pages.map((p) => p.width));
  const height = pages.reduce((h, p) => h + p.height, 0) + gap * (pages.length - 1);
  const out = createCanvas(width, height);
  const ctx = out.getContext("2d");
  ctx.fillStyle = "#d1d5db";
  ctx.fillRect(0, 0, width, height);
  let y = 0;
  for (const p of pages) {
    ctx.drawImage(p, 0, y);
    y += p.height + gap;
  }
  return out.encode("png");
}
