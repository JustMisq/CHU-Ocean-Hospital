/**
 * Rachis entier vu de profil (avant à droite) : figure Servier (kit des os, diapositive 8, profil), vertèbres découpées
 * entre les disques, disques, canal et moelle. Écrit atlas/spine-shapes.ts (vertèbres, disques, moelle) et spine-art.ts
 * (dessin des os, avec le rôle de chaque tracé pour les rendus radio et coupe).
 */
import { join } from "node:path";
import { figure, maskPath, shapesBody, splitTree, toArt, writeTs, type BuildContext } from "../lib/body.mts";
import { Mask, type Box } from "../lib/raster.mts";
import type { Pt } from "../lib/svg-path.mts";

/** Disques (niveau → bord antérieur, y), relevés sur la figure quadrillée, de C2-C3 à L5-S1. */
export const DISC_Y: [string, number][] = [
  ["C2-C3", 132.6], ["C3-C4", 139.7], ["C4-C5", 146], ["C5-C6", 152.6], ["C6-C7", 158.6], ["C7-T1", 166.6],
  ["T1-T2", 177.5], ["T2-T3", 190.6], ["T3-T4", 201], ["T4-T5", 211.8], ["T5-T6", 222.7], ["T6-T7", 235.6], ["T7-T8", 245],
  ["T8-T9", 256], ["T9-T10", 269], ["T10-T11", 281], ["T11-T12", 294.4], ["T12-L1", 308.7],
  ["L1-L2", 324], ["L2-L3", 343], ["L3-L4", 362], ["L4-L5", 381], ["L5-S1", 398],
];
export const LEVELS = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", ...Array.from({ length: 12 }, (_, i) => `T${i + 1}`), "L1", "L2", "L3", "L4", "L5"];

/** Abscisse du centre des corps vertébraux selon la hauteur (colonne antérieure, courbures comprises). */
const BODY_X: [y: number, x: number][] = [[110, 711], [150, 712], [165, 709], [185, 702], [205, 696], [230, 692], [260, 690], [290, 688], [320, 690], [350, 693], [375, 694], [395, 692]];
export function bodyX(y: number) {
  for (let i = 0; i + 1 < BODY_X.length; i++) {
    const [y0, x0] = BODY_X[i], [y1, x1] = BODY_X[i + 1];
    if (y <= y1) return x0 + ((x1 - x0) * Math.max(0, y - y0)) / (y1 - y0);
  }
  return BODY_X[BODY_X.length - 1][1];
}

/** Centre du corps de chaque vertèbre (entre ses deux disques). */
function centers(): Record<string, Pt> {
  const out: Record<string, Pt> = { C1: [710, 114], C2: [711, 125] };
  for (let i = 2; i < LEVELS.length; i++) {
    const above = DISC_Y[i - 2][1], below = i - 1 < DISC_Y.length ? DISC_Y[i - 1][1] : 398;
    const y = (above + below) / 2;
    out[LEVELS[i]] = [bodyX(y), y];
  }
  return out;
}

/** Décalage de la pointe de l'épineuse par rapport au corps (épineuses de plus en plus obliques au rachis dorsal). */
function spinousOffset(level: string): Pt {
  const n = Number(level.slice(1));
  if (level[0] === "C") return [-22, 3];
  if (level[0] === "L") return [-30, 5];
  if (n <= 3) return [-38, 6];
  if (n <= 9) return [-42, 11];
  return [-36, 8];
}

export async function buildSpine({ servierDir, atlasDir, debug }: BuildContext) {
  const spine = figure(servierDir, "Bones", 8, [0]);
  const BASE = new Set(["#f9d470", "#feeab2"]);
  const DISC = new Set(["#a5c7e0", "#5d9fc9"]);
  const roleOf = (fill: string, stroke?: string) => (DISC.has(fill) ? "skip" : BASE.has(fill) ? "base" : fill === "none" && stroke ? "line" : "shade");

  const BOX: Box = [636, 100, 92, 384];
  const S = 10;
  const boneMask = await Mask.render(shapesBody(spine.filter((x) => x.s.fill !== "none" && !DISC.has(x.s.fill))), BOX, S);
  const discMask = await Mask.render(shapesBody(spine.filter((x) => DISC.has(x.s.fill))), BOX, S);

  // Vertèbres : chaque pixel d'os revient au trajet (corps → pédicule → épineuse) le plus proche.
  const c = centers();
  const routes: Record<string, Pt[][]> = {};
  for (const level of LEVELS) {
    const [x, y] = c[level];
    const [dx, dy] = spinousOffset(level);
    routes[level] = [[[x + 6, y], [x - 8, y + 1], [x - 16, y + 2 + dy * 0.2], [x + dx, y + dy]]];
  }
  routes.C1 = [[[716, 113], [704, 114], [696, 117], [690, 121]]];
  routes.C2 = [[[712, 109], [712, 128], [700, 130], [690, 133]]];
  routes.sacrum = [[[694, 405], [688, 420], [676, 432], [668, 448], [668, 458]], [[700, 412], [704, 428]]];
  routes.coccyx = [[[672, 462], [678, 468], [682, 474]]];
  const split = splitTree(boneMask, routes, 30, 0.2);
  await debug.split("spine-split", split);

  // Disques : composantes rangées de haut en bas.
  // Les disques sont dessinés d'une seule bande, en arrière des corps : on ne garde que ce qui dépasse entre les corps.
  const discs = discMask.minus(boneMask).components(30).sort((a, b) => a.center[1] - b.center[1]);
  const discShapes: Record<string, string> = {};
  for (const comp of discs) {
    const near = DISC_Y.reduce((best, d) => (Math.abs(d[1] - comp.center[1]) < Math.abs(best[1] - comp.center[1]) ? d : best));
    const id = near[0];
    discShapes[id] = [discShapes[id], maskPath(comp.mask, 0.2, 10)].filter(Boolean).join(" ");
  }
  console.log(`Rachis : ${Object.keys(split.paths).length} vertèbres, ${Object.keys(discShapes).length} disques (sur ${DISC_Y.length}).`);

  // Canal rachidien : en arrière des corps (moelle jusqu'à L1, puis queue de cheval).
  const canal: Pt[] = [[700, 108], ...LEVELS.slice(1).map((l) => [c[l][0] - (l[0] === "C" ? 14 : l[0] === "T" ? 20 : 23), c[l][1]] as Pt), [670, 405], [664, 420]];

  const art = spine.map((x) => ({ ...toArt(x, 1), role: roleOf(x.s.fill, x.s.stroke) as "base" | "shade" | "line" | "skip" }));
  const round1 = (d: string) => d.replace(/(\d+\.\d)\d+/g, "$1");
  writeTs(
    join(atlasDir, "spine-shapes.ts"),
    `// Généré par scripts/build-body.mts à partir de Servier Medical Art (smart.servier.com, CC BY 4.0). Ne pas modifier.
// Rachis de profil (avant à droite), en coordonnées de la figure Servier (pt).

import type { ArtPath } from "../anatomy";`,
    `/** Vertèbres (C1 → L5, sacrum, coccyx), découpées dans le dessin. */
export const SPINE_VERTEBRAE: Record<string, string> = ${JSON.stringify(split.paths)};

/** Disques intervertébraux (C2-C3 → L5-S1). */
export const SPINE_DISCS: Record<string, string> = ${JSON.stringify(discShapes)};

/** Axe du canal rachidien (de C1 au sacrum). */
export const SPINE_CANAL: [number, number][] = ${JSON.stringify(canal.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]))};

/** Dessin des os (couleurs d'origine) et rôle de chaque tracé pour la radio et les coupes. */
export const SPINE_ART: ArtPath[] = ${JSON.stringify(art.map((a) => ({ ...a, d: round1(a.d) })))};`,
  );
}
