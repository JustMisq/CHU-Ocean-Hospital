/**
 * Tête et cou vus de profil (face à droite) : crâne Servier (kit des os, diapositive 7, profil) découpé en os le long des
 * sutures, cerveau Servier (kit nerveux, diapositive 10, lobes colorés) recalé dans la boîte crânienne, rachis cervical
 * repris de la figure du rachis. Écrit atlas/head-shapes.ts (structures) et head-art.ts (dessin détaillé).
 */
import { join } from "node:path";
import { figure, maskPath, regionPath, shapesBody, toArt, warpShapes, writeTs, type BuildContext, type Seeds } from "../lib/body.mts";
import { Mask, type Box } from "../lib/raster.mts";
import { writePath, type Pt } from "../lib/svg-path.mts";
import { thinPlate } from "../lib/warp.mts";

/** Repères du cerveau (figure Servier, face à gauche) → boîte crânienne (crâne de profil, face à droite). */
const BRAIN_PAIRS: [Pt, Pt][] = [
  [[261, 273], [573, 262]], // pôle frontal
  [[470, 134], [471, 168]], // vertex
  [[681, 288], [371, 279]], // pôle occipital
  [[362, 345], [526, 314]], // pôle temporal
  [[413, 402], [480, 331]], // face inférieure du lobe temporal
  [[319, 356], [548, 282]], // face orbitaire du lobe frontal
  [[564, 422], [418, 339]], // face inférieure du cervelet
  [[531, 446], [452, 354]], // tronc cérébral (trou occipital)
  [[671, 342], [380, 318]], // bas du lobe occipital
  [[360, 160], [530, 186]], // convexité frontale
  [[600, 175], [405, 200]], // convexité pariéto-occipitale
];

/** Lobes et structures du cerveau, par couleur de la figure. */
const BRAIN_COLORS: Record<string, string[]> = {
  "lobe-frontal": ["#cbefb4", "#a0d880"],
  "lobe-parietal": ["#a7a7f9", "#6666ff"],
  "lobe-temporal": ["#f7cd79", "#ffb000"],
  "lobe-occipital": ["#bc5abf", "#a027a0"],
  cervelet: ["#e2cfd6", "#bfa5af", "#f2e9ed"],
  "tronc-cerebral": ["#f7cbdc", "#f99bbb"],
};

/** Os du crâne : points de départ dans le crâne découpé le long des sutures (relevés sur l'image de contrôle). */
const SKULL_SEEDS: Record<string, Seeds> = {
  "os-frontal": { seeds: [[550.8, 218], [530.7, 236]] },
  "os-parietal": { seeds: [[442.2, 218]] },
  "os-occipital": { seeds: [[380, 281]] },
  "os-temporal": { seeds: [[469.5, 298.3], [476, 336.6]], clip: [350, 230, 172, 140] },
  sphenoide: { seeds: [[514.3, 280], [515, 325.6]] },
  "os-zygomatique": { seeds: [[469.5, 298.3]], clip: [522, 290, 45, 50] },
  orbite: { seeds: [[559.9, 288], [550.8, 290]] },
  "os-nasal": { seeds: [[584.5, 293.7]] },
  maxillaire: { seeds: [[562.6, 336.6]] },
  mandibule: { seeds: [[528, 380]] },
  dents: {
    seeds: [
      [538, 368], [548.6, 370.6], [559.9, 372.2], [568.5, 373.1], [575, 373.5], [581.4, 374.2],
      [537.6, 378.6], [548.9, 381.3], [559.5, 383.2], [569.5, 385], [576.8, 385.2], [581, 385.5],
    ],
  },
};

export async function buildHead({ servierDir, atlasDir, debug }: BuildContext) {
  // ─── Crâne ───
  const skull = figure(servierDir, "Bones", 7, [0]);
  const BOX: Box = [350, 145, 270, 365];
  const S = 8;
  const BASE = new Set(["#feeab2"]);
  const roleOf = (fill: string, stroke?: string) => (BASE.has(fill) ? "base" : fill === "none" && stroke ? "line" : "shade");
  const skullMask = await Mask.render(shapesBody(skull.filter((x) => x.s.fill !== "none")), BOX, S);
  // Sutures et contours : traits gris / noirs, épaissis pour couper le masque.
  const cuts = await Mask.render(skull.filter((x) => x.s.fill === "none" && (x.s.stroke === "#666666" || x.s.stroke === "#333333")).map((x) => `<path d="${writePath(x.segs, 3)}" fill="none" stroke="#000" stroke-width="1.4" stroke-linecap="round"/>`).join(""), BOX, S);
  const pieces = skullMask.minus(cuts);
  await debug.components("head-skull", pieces, 200);
  const skullShapes: Record<string, string> = {};
  for (const [id, s] of Object.entries(SKULL_SEEDS)) {
    const parts: string[] = [];
    for (const seed of s.seeds) {
      try {
        parts.push(await regionPath(pieces, { seeds: [seed], clip: s.clip }, 0.3));
      } catch (e) {
        console.log(`Crâne : ${id} — ${(e as Error).message}`);
      }
    }
    skullShapes[id] = parts.join(" ");
  }

  // ─── Cerveau recalé ───
  const brainFig = figure(servierDir, "Nervous-system", 10, [0]);
  const warp = thinPlate(BRAIN_PAIRS.map((p) => p[0]), BRAIN_PAIRS.map((p) => p[1]), 0.002);
  const brain = warpShapes(brainFig, warp);
  const brainShapes: Record<string, string> = {};
  for (const [id, colors] of Object.entries(BRAIN_COLORS)) {
    const m = await Mask.render(shapesBody(brain.filter((x) => colors.includes(x.s.fill))), BOX, S);
    brainShapes[id] = maskPath(m.grow(1), 0.3, 80);
  }
  const brainMask = await Mask.render(shapesBody(brain.filter((x) => x.s.fill !== "none")), BOX, S);
  const brainOutline = maskPath(brainMask.grow(2), 0.4, 200);

  // ─── Rachis cervical (figure du rachis, mise à l'échelle sous le crâne) ───
  const spine = figure(servierDir, "Bones", 8, [0]).filter((x) => x.center[1] < 166);
  const k = 2.25;
  const spineIn = warpShapes(spine, ([x, y]) => [490 + (x - 716) * k, 356 + (y - 113) * k]);
  const SPINE_BASE = new Set(["#f9d470", "#feeab2"]);
  const DISC = new Set(["#a5c7e0", "#5d9fc9"]);
  const spineRole = (fill: string, stroke?: string) => (DISC.has(fill) ? "skip" : SPINE_BASE.has(fill) ? "base" : fill === "none" && stroke ? "line" : "shade");

  const skullArt = skull.map((x) => ({ ...toArt(x, 1), role: roleOf(x.s.fill, x.s.stroke) as "base" | "shade" | "line" }));
  const spineArt = spineIn.map((x) => ({ ...toArt(x, k), role: spineRole(x.s.fill, x.s.stroke) as "base" | "shade" | "line" | "skip" }));
  const brainArt = brain.map((x) => toArt(x, 0.5));
  await debug.art("head-art", BOX, [...skullArt, ...spineArt, ...brainArt], 5);

  const round1 = (d: string) => d.replace(/(\d+\.\d)\d+/g, "$1");
  writeTs(
    join(atlasDir, "head-shapes.ts"),
    `// Généré par scripts/build-body.mts à partir de Servier Medical Art (smart.servier.com, CC BY 4.0). Ne pas modifier.
// Tête et cou de profil (face à droite), en coordonnées de la figure du crâne (pt).

import type { ArtPath } from "../anatomy";`,
    `/** Os du crâne et de la face, découpés le long des sutures. */
export const HEAD_SKULL: Record<string, string> = ${JSON.stringify(skullShapes)};

/** Lobes et structures du cerveau. */
export const HEAD_BRAIN: Record<string, string> = ${JSON.stringify(brainShapes)};

/** Contour du cerveau (espaces méningés le long de la convexité). */
export const HEAD_BRAIN_OUTLINE = ${JSON.stringify(brainOutline)};

/** Crâne et rachis cervical dessinés, avec le rôle de chaque tracé (radio, coupes). */
export const HEAD_BONE_ART: { skull: ArtPath[]; spine: ArtPath[] } = ${JSON.stringify({ skull: skullArt.map((a) => ({ ...a, d: round1(a.d) })), spine: spineArt.map((a) => ({ ...a, d: round1(a.d) })) })};`,
  );
  writeTs(
    join(atlasDir, "head-art.ts"),
    `// Généré par scripts/build-body.mts à partir de Servier Medical Art (smart.servier.com, CC BY 4.0), recalé dans la boîte
// crânienne. Modifications : cerveau retourné et déformé pour suivre le crâne. Ne pas modifier.

import type { RegionArt } from "../anatomy";`,
    `export const HEAD_ART: RegionArt = { layers: { nerfs: ${JSON.stringify(brainArt.map((a) => ({ ...a, d: round1(a.d) })))} } };`,
  );
  console.log(`Tête : ${Object.keys(skullShapes).length} os du crâne, ${Object.keys(brainShapes).length} structures cérébrales.`);
}
