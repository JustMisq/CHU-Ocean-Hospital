/**
 * Outils communs à la génération des régions « corps entier » (scripts/build-body.mts) : figures Servier recalées,
 * découpage en structures, mesure des os de la planche, images de contrôle.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import type { loadPlate } from "./plate.mts";
import { pathsOf, type ArtPath } from "./plate.mts";
import { loadSlide, openDeck, type SvgShape } from "./pptx-svg.mts";
import { convexHull, Mask, polyPath, reduceHull, rowEdges, simplify, type Box } from "./raster.mts";
import { affine, mapSegs, parsePath, segPoints, writePath, type Pt, type Seg } from "./svg-path.mts";

export type Plate = ReturnType<typeof loadPlate>;
export type BuildContext = { plate: Plate; servierDir: string; atlasDir: string; debug: Debug };

export const PT = 12700;
export type Shape = { s: SvgShape; segs: Seg[]; center: Pt };

export const centerOf = (segs: Seg[]): Pt => {
  const pts = segPoints(segs);
  return [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
};

/** Formes d'une diapositive Servier (groupes de premier niveau choisis), en pt, éventuellement décalées. */
export function figure(servierDir: string, kit: string, slide: number, groups: number[] | null, offset: Pt = [0, 0]): Shape[] {
  const deck = openDeck(join(servierDir, `x-${kit}`));
  return loadSlide(deck, slide).shapes.filter((s) => !groups || groups.includes(s.path[0])).map((s) => {
    const segs = mapSegs(parsePath(s.d), (p) => {
      const q = affine(s.transform)(p);
      return [q[0] / PT + offset[0], q[1] / PT + offset[1]];
    });
    return { s, segs, center: centerOf(segs) };
  });
}

/** Applique une déformation à des formes. */
export const warpShapes = <T extends { segs: Seg[] }>(list: T[], warp: (p: Pt) => Pt): T[] => list.map((x) => ({ ...x, segs: mapSegs(x.segs, warp) }));

/** Épaisseur de trait recalée : repère de la forme → pt → unités de la planche (facteur d'échelle de la figure). */
export const strokeOf = (s: SvgShape, scale: number) => {
  const [a, b, c, d] = s.transform;
  return (((s.strokeWidth ?? 9525) * Math.sqrt(Math.abs(a * d - b * c))) / PT) * scale;
};
export const toArt = (x: { s: SvgShape; segs: Seg[] }, scale: number, override?: Partial<ArtPath>): ArtPath => ({
  d: writePath(x.segs, 2),
  fill: x.s.fill,
  ...(x.s.stroke && { stroke: x.s.stroke, sw: Math.round(strokeOf(x.s, scale) * 1000) / 1000 }),
  ...override,
});

/** Formes en noir (masques). */
export const shapesBody = (list: { segs: Seg[] }[], stroke?: number) =>
  list.map(({ segs }) => `<path d="${writePath(segs, 3)}" ${stroke ? `fill="none" stroke="#000" stroke-width="${stroke}" stroke-linejoin="round" stroke-linecap="round"` : 'fill="#000"'}/>`).join("");

/** Bords d'une forme à la hauteur y : depuis un point intérieur, première sortie à gauche et à droite. */
export function edges(m: Mask, y: number, x0: number): [number, number] {
  const step = 1 / m.scale;
  let l = x0, r = x0;
  while (m.inside([l - step, y])) l -= step;
  while (m.inside([r + step, y])) r += step;
  return [l, r];
}
export const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// ─── Os de la planche ────────────────────────────────────────────────────────

/** Os de la planche : groupes (chemins d'indices), éléments hors groupe (rang), découpe éventuelle. */
export type BoneSpec = { groups?: string[]; top?: number[]; clip?: Box };
export type PlateBoneData = { hull: Pt[]; paths: ArtPath[]; clip?: Box };

export const boneBody = (plate: Plate, spec: BoneSpec) => [...(spec.groups ?? []).map(plate.group), ...(spec.top ?? []).map(plate.top)].join("");

/**
 * Mesure d'un os : contour réel du dessin (découpe comprise), simplifié. Plus fidèle qu'une enveloppe convexe
 * pour les os obliques (fémur) : les parties découpées dedans (tiers de diaphyse…) restent sur l'os.
 */
export async function measureBone(plate: Plate, spec: BoneSpec): Promise<PlateBoneData> {
  const body = boneBody(plate, spec);
  const masked = body.replace(/fill="#FFFFFF"/g, 'fill="#000"');
  // Boîte approximative (rendu grossier), puis rendu fin de cette zone seulement.
  const rough = rowEdges(await Mask.render(masked, [0, 0, plate.width, plate.height], 1, 250));
  const xs = rough.map((p) => p[0]), ys = rough.map((p) => p[1]);
  const region: Box = [Math.min(...xs) - 3, Math.min(...ys) - 3, Math.max(...xs) - Math.min(...xs) + 6, Math.max(...ys) - Math.min(...ys) + 6];
  let m = await Mask.render(masked, region, 6, 245);
  if (spec.clip) m = m.and(await Mask.render(`<rect x="${spec.clip[0]}" y="${spec.clip[1]}" width="${spec.clip[2]}" height="${spec.clip[3]}" fill="#000"/>`, region, 6));
  const largest = m.components().sort((a, b) => b.size - a.size)[0];
  const outline = largest ? simplify(largest.mask.outline(), 0.3) : [];
  // Os minuscules : l'enveloppe convexe suffit et reste lisible.
  const pts = outline.length >= 6 ? outline : reduceHull(convexHull(rowEdges(m)), 24);
  return { hull: pts.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10] as Pt), paths: pathsOf(body), ...(spec.clip && { clip: spec.clip }) };
}

// ─── Découpage en structures ─────────────────────────────────────────────────

/** Points de départ (zones d'un masque découpé) → structure ; `clip` : n'en garder qu'un rectangle. */
export type Seeds = { seeds: Pt[]; clip?: Box };

export async function regionPath(m: Mask, { seeds, clip }: Seeds, tol = 0.2) {
  const box = clip ? await Mask.render(`<rect x="${clip[0]}" y="${clip[1]}" width="${clip[2]}" height="${clip[3]}" fill="#000"/>`, m.box, m.scale) : null;
  return seeds.map((p) => {
    let c = m.component(p);
    if (!c.count()) throw new Error(`Point de départ hors de toute zone : ${p}`);
    if (box) c = c.and(box);
    return c.components(20).map((k) => polyPath(simplify(k.mask.outline(), tol))).join(" ");
  }).join(" ");
}

/** Contour d'un masque entier (toutes ses composantes). */
export const maskPath = (m: Mask, tol = 0.2, minPixels = 20) => m.components(minPixels).map((k) => polyPath(simplify(k.mask.outline(), tol))).join(" ");

/** Distance d'un point à une ligne brisée. */
function distToRoute([px, py]: Pt, route: Pt[]) {
  let best = Infinity;
  for (let k = 0; k + 1 < route.length; k++) {
    const [ax, ay] = route[k], [bx, by] = route[k + 1];
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(px - ax - t * dx, py - ay - t * dy));
  }
  return best;
}

/**
 * Découpe d'un arbre dessiné d'un seul tenant (nerfs, artères) : chaque structure est décrite par son trajet approximatif
 * (lignes brisées) ; chaque pixel revient au trajet le plus proche (dans la limite de `maxDist`).
 */
export function splitTree(tree: Mask, routes: Record<string, Pt[][]>, maxDist = 6, tol = 0.15) {
  const ids = Object.keys(routes);
  const parts = ids.map(() => Mask.empty(tree.box, tree.scale));
  for (let k = 0; k < tree.data.length; k++) {
    if (!tree.data[k]) continue;
    const i = k % tree.w, j = (k - i) / tree.w;
    const p = tree.toPoint(i + 0.5, j + 0.5);
    let best = -1, bestD = maxDist;
    ids.forEach((id, n) => {
      for (const r of routes[id]) {
        const d = distToRoute(p, r);
        if (d < bestD) { bestD = d; best = n; }
      }
    });
    if (best >= 0) parts[best].data[k] = 1;
  }
  return { ids, parts, paths: Object.fromEntries(ids.map((id, n) => [id, maskPath(parts[n], tol, 12)])) };
}

// ─── Écriture ────────────────────────────────────────────────────────────────

export function writeTs(file: string, header: string, body: string) {
  writeFileSync(file, `${header}\n\n${body}\n`);
}

// ─── Images de contrôle ──────────────────────────────────────────────────────

function hsl(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/** Images de contrôle (seulement si un dossier est donné) : composantes numérotées, dessins sur grille, découpages. */
export class Debug {
  constructor(private dir?: string) {}

  /** Composantes numérotées d'un masque (et leurs centres dans un .txt), pour relever les points de départ. */
  async components(name: string, m: Mask, minPixels: number) {
    const comps = m.components(minPixels).sort((a, b) => a.center[1] - b.center[1] || a.center[0] - b.center[0]);
    if (!this.dir) return comps;
    const colors = new Uint8Array(m.w * m.h * 3).fill(255);
    comps.forEach((c, n) => {
      const [r, g, b] = hsl((n * 67) % 360, 0.7, 0.6);
      for (let k = 0; k < c.mask.data.length; k++) if (c.mask.data[k]) { colors[k * 3] = r; colors[k * 3 + 1] = g; colors[k * 3 + 2] = b; }
    });
    const labels = comps.map((c, n) => {
      const [i, j] = m.toPixel(c.center);
      return `<text x="${i}" y="${j}" font-size="22" font-weight="bold" text-anchor="middle" fill="#000" stroke="#fff" stroke-width="5" paint-order="stroke">${n}</text>`;
    }).join("");
    await sharp(colors, { raw: { width: m.w, height: m.h, channels: 3 } })
      .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${m.w}" height="${m.h}">${labels}</svg>`) }])
      .png().toFile(join(this.dir, `${name}.png`));
    writeFileSync(join(this.dir, `${name}.txt`), comps.map((c, n) => `${n}\t${c.center.map((v) => v.toFixed(1)).join(",")}\t${c.size}`).join("\n"));
    return comps;
  }

  /** Dessins sur une grille graduée (repère de la planche), pour placer points de départ, trajets et coupes. */
  async art(name: string, box: Box, list: ArtPath[], scale = 14, extra = "") {
    if (!this.dir) return;
    const [x, y, w, h] = box;
    let grid = "";
    for (let gx = Math.ceil(x / 5) * 5; gx <= x + w; gx += 5) grid += `<line x1="${gx}" y1="${y}" x2="${gx}" y2="${y + h}" stroke="${gx % 10 ? "#93c5fd" : "#2563eb"}" stroke-width="0.08"/>${gx % 10 ? "" : `<text x="${gx + 0.3}" y="${y + 2}" font-size="1.6" fill="#1d4ed8">${gx}</text>`}`;
    for (let gy = Math.ceil(y / 5) * 5; gy <= y + h; gy += 5) grid += `<line x1="${x}" y1="${gy}" x2="${x + w}" y2="${gy}" stroke="${gy % 10 ? "#fca5a5" : "#dc2626"}" stroke-width="0.08"/>${gy % 10 ? "" : `<text x="${x + 0.3}" y="${gy - 0.3}" font-size="1.6" fill="#b91c1c">${gy}</text>`}`;
    const body = list.map((a) => `<path d="${a.d}" fill="${a.fill}"${a.stroke ? ` stroke="${a.stroke}" stroke-width="${a.sw}"` : ""}/>`).join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w * scale)}" height="${Math.round(h * scale)}" viewBox="${x} ${y} ${w} ${h}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff"/>${body}${extra}${grid}</svg>`;
    await sharp(Buffer.from(svg), { limitInputPixels: false }).png().toFile(join(this.dir, `${name}.png`));
  }

  /** Découpage d'un arbre, une couleur par structure. */
  async split(name: string, split: ReturnType<typeof splitTree>) {
    if (!this.dir) return;
    const m = split.parts[0];
    const colors = new Uint8Array(m.w * m.h * 3).fill(255);
    split.parts.forEach((p, n) => {
      const [r, g, b] = hsl((n * 67) % 360, 0.8, 0.45);
      for (let k = 0; k < p.data.length; k++) if (p.data[k]) { colors[k * 3] = r; colors[k * 3 + 1] = g; colors[k * 3 + 2] = b; }
    });
    const legend = split.ids.map((id, n) => `<text x="10" y="${30 + n * 26}" font-size="22" font-weight="bold" fill="hsl(${(n * 67) % 360},80%,45%)">${id}</text>`).join("");
    await sharp(colors, { raw: { width: m.w, height: m.h, channels: 3 } })
      .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${m.w}" height="${m.h}">${legend}</svg>`) }])
      .png().toFile(join(this.dir, `${name}.png`));
  }
}
