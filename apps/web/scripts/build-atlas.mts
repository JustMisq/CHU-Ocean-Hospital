/**
 * Génère les données anatomiques du site à partir des sources (voir src/lib/imaging/atlas/source/SOURCES.md) :
 *  - src/lib/imaging/atlas/skeleton-arm.ts : os du membre supérieur GAUCHE de la planche LadyofHats
 *    (position anatomique : paume en avant, pouce en dehors), retrouvés par leur boîte englobante ;
 *  - src/lib/imaging/atlas/body-zones.ts : silhouette de face (react-body-highlighter) regroupée par zone.
 *
 * Usage (depuis apps/web) : npx tsx scripts/build-atlas.mts
 * Ne lit et n'écrit que des fichiers locaux.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const atlas = join(here, "../src/lib/imaging/atlas");

// ─── Squelette ───────────────────────────────────────────────────────────────

const svg = readFileSync(join(atlas, "source/skeleton-front.svg"), "utf8");
const head = svg.slice(0, svg.indexOf(">", svg.indexOf("<svg")) + 1);

type Span = { path: number[]; start: number; end: number };
const spans: Span[] = [];
{
  const stack: { path: number[]; start: number; children: number }[] = [];
  let top = 0;
  for (const m of svg.matchAll(/<g\b[^>]*>|<\/g>/g)) {
    if (m[0] === "</g>") {
      const g = stack.pop()!;
      spans.push({ path: g.path, start: g.start, end: m.index! + 4 });
      continue;
    }
    const parent = stack[stack.length - 1];
    stack.push({ path: parent ? [...parent.path, parent.children++] : [top++], start: m.index!, children: 0 });
  }
}

type Box = [number, number, number, number];

type Pt = [number, number];
const round = (v: number) => Math.round(v * 10) / 10;

/** Enveloppe convexe (chaîne monotone d'Andrew). */
function convexHull(points: Pt[]): Pt[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: Pt[]) => {
    const out: Pt[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(pts), ...half([...pts].reverse())];
}

/** Réduit une enveloppe à `max` points environ (en gardant les plus « saillants »). */
function simplify(hull: Pt[], max: number): Pt[] {
  let pts = hull;
  while (pts.length > max) {
    let worst = 0, area = Infinity;
    pts.forEach((p, i) => {
      const a = pts[(i + pts.length - 1) % pts.length], b = pts[(i + 1) % pts.length];
      const s = Math.abs((a[0] - p[0]) * (b[1] - p[1]) - (a[1] - p[1]) * (b[0] - p[0]));
      if (s < area) { area = s; worst = i; }
    });
    pts = pts.filter((_, i) => i !== worst);
  }
  return pts;
}

/**
 * Mesure d'un fragment au pixel près (rendu isolé dans la zone `region`) : boîte englobante et enveloppe convexe.
 * L'enveloppe sert à recalculer une boîte serrée une fois l'os tourné dans le repère du modèle.
 */
async function measure(body: string, region: Box): Promise<{ box: Box; hull: Pt[] } | null> {
  const S = 8;
  const [rx, ry, rw, rh] = region;
  const doc = head
    .replace(/width="[^"]+"/, `width="${Math.round(rw * S)}"`)
    .replace(/height="[^"]+"/, `height="${Math.round(rh * S)}"`)
    .replace(/viewBox="[^"]+"/, `viewBox="${rx} ${ry} ${rw} ${rh}"`);
  const png = `${doc}<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="#fff"/>${body.replace(/fill="#FFFFFF"/g, 'fill="#000"')}</svg>`;
  const { data, info } = await sharp(Buffer.from(png)).flatten({ background: "#fff" }).raw().toBuffer({ resolveWithObject: true });
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  // Pour l'enveloppe : extrémités gauche et droite de chaque ligne de pixels suffisent.
  const edges: Pt[] = [];
  for (let y = 0; y < info.height; y++) {
    let first = -1, last = -1;
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * info.channels] < 245) {
        if (first < 0) first = x;
        last = x;
      }
    }
    if (first < 0) continue;
    edges.push([first, y], [last, y]);
    if (first < x0) x0 = first; if (last > x1) x1 = last; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return null;
  const hull = simplify(convexHull(edges), 24).map(([x, y]) => [round(rx + x / S), round(ry + y / S)] as Pt);
  return { box: [round(rx + x0 / S), round(ry + y0 / S), round((x1 - x0) / S), round((y1 - y0) / S)], hull };
}

/** Os à extraire : identifiant du site → boîte attendue sur la planche (relevée à la main). */
const TARGETS: Record<string, Box> = {
  clavicule: [218, 176, 78, 19],
  scapula: [245.7, 180, 66, 83],
  humerus: [288.3, 199.7, 56, 157.3],
  radius: [333.3, 347, 47.7, 115],
  ulna: [319.3, 351, 44.7, 112],
  scaphoide: [366.7, 457.7, 15.3, 9],
  lunatum: [358, 459.3, 10.3, 7.7],
  triquetrum: [356, 463.7, 6.3, 9.7],
  pisiforme: [354.7, 467, 6.3, 8],
  trapeze: [378, 463.7, 9, 8.3],
  trapezoide: [374.7, 466.3, 6.7, 7.3],
  capitatum: [366.7, 462, 10.3, 14],
  hamatum: [358.3, 465.7, 10.7, 13.3],
  mc1: [386.7, 464.3, 21, 8.3],
  "doigt1-p1": [405, 468.7, 15.3, 13],
  "doigt1-p2": [417, 478.3, 10.3, 10],
  mc2: [380, 469.7, 16, 31],
  "doigt2-p1": [389.7, 499, 10.7, 20.7],
  "doigt2-p2": [395, 517.7, 6.7, 11.7],
  "doigt2-p3": [397.7, 528, 5.3, 9.3],
  mc3: [370, 474, 16.7, 31],
  "doigt3-p1": [380.3, 503, 11.7, 21.3],
  "doigt3-p2": [387.7, 522.3, 8.3, 13.3],
  "doigt3-p3": [391.7, 533.7, 7, 10],
  mc4: [362.7, 476.7, 14, 28.3],
  "doigt4-p1": [371, 503.3, 11, 20.3],
  "doigt4-p2": [377.3, 522, 10, 13.7],
  "doigt4-p3": [383.3, 534.3, 5.7, 8],
  mc5: [356.3, 476, 9.3, 27],
  "doigt5-p1": [359.7, 501.3, 9.7, 15],
  "doigt5-p2": [365, 515.3, 7.3, 10],
  "doigt5-p3": [369, 524.7, 6.7, 8],
};

/** Groupes de premier niveau concernés et leur zone (pour mesurer vite). */
const TOPS: [index: number, region: Box][] = [
  [8, [240, 170, 80, 100]],
  [27, [212, 170, 90, 30]],
  [28, [282, 194, 104, 274]],
  [30, [350, 452, 82, 98]],
];

const candidates: { span: Span; box: Box; hull: Pt[]; region: Box }[] = [];
for (const [top, region] of TOPS) {
  for (const span of spans.filter((s) => s.path[0] === top)) {
    const m = await measure(svg.slice(span.start, span.end), region);
    if (m) candidates.push({ span, box: m.box, hull: m.hull, region });
  }
}

const dist = (a: Box, b: Box) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0);
type ArtPath = { d: string; fill: string; stroke?: string; sw?: number };
const bones: Record<string, { box: Box; hull: Pt[]; paths: ArtPath[] }> = {};
for (const [id, expected] of Object.entries(TARGETS)) {
  const ranked = candidates.map((c) => ({ c, score: dist(c.box, expected) })).sort((a, b) => a.score - b.score);
  // À boîte quasi identique, le groupe le plus englobant (un sous-groupe peut ne contenir qu'une partie du dessin).
  const near = ranked.filter((r) => r.score - ranked[0].score < 0.6 && dist(r.c.box, ranked[0].c.box) < 0.8);
  const best = near.sort((a, b) => a.c.span.path.length - b.c.span.path.length)[0];
  if (!best || best.score > 6) throw new Error(`${id} : aucun groupe ne correspond (meilleur écart ${best?.score.toFixed(1)})`);
  const rival = ranked.find((r) => dist(r.c.box, best.c.box) >= 0.8);
  if (rival && rival.score - best.score < 0.3) throw new Error(`${id} : ambigu entre ${best.c.span.path} et ${rival.c.span.path}`);
  const body = svg.slice(best.c.span.start, best.c.span.end);
  const paths: ArtPath[] = [];
  for (const m of body.matchAll(/<path\b([^>]*)\/?>/g)) {
    const attr = (name: string) => m[1].match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
    const d = attr("d")?.replace(/\s+/g, " ").trim();
    if (!d) continue;
    const sw = attr("stroke-width");
    paths.push({ d, fill: attr("fill") ?? "#000000", ...(attr("stroke") && { stroke: attr("stroke") }), ...(sw && { sw: Number(sw) }) });
  }
  bones[id] = { box: best.c.box, hull: best.c.hull, paths };
  console.log(`${id.padEnd(12)} ← groupe ${best.c.span.path.join(".")} (écart ${best.score.toFixed(1)}, ${paths.length} tracés)`);
}

writeFileSync(
  join(atlas, "skeleton-arm.ts"),
  `// Généré par scripts/build-atlas.mts à partir de source/skeleton-front.svg (LadyofHats, domaine public). Ne pas modifier.
// Membre supérieur GAUCHE de la planche, en coordonnées de la planche (456 × 926).

export type ArtPath = { d: string; fill: string; stroke?: string; sw?: number };
export type ArtBone = {
  box: [x: number, y: number, w: number, h: number];
  /** Enveloppe convexe de l'os (24 points max), pour des boîtes serrées après rotation. */
  hull: [number, number][];
  paths: ArtPath[];
};

export const ART_BONES: Record<string, ArtBone> = ${JSON.stringify(bones)};
`,
);

// ─── Silhouette de face (zones) ──────────────────────────────────────────────

const poly = readFileSync(join(atlas, "source/body-highlighter-polygons.ts.txt"), "utf8");
const anterior = poly.slice(poly.indexOf("export const anteriorData"), poly.indexOf("export const posteriorData"));
const ZONE_OF: Record<string, string> = {
  HEAD: "tete", NECK: "tete", CHEST: "thorax", ABS: "abdomen", OBLIQUES: "abdomen",
  FRONT_DELTOIDS: "membre-sup", BICEPS: "membre-sup", TRICEPS: "membre-sup", FOREARM: "membre-sup",
  ABDUCTORS: "membre-inf", QUADRICEPS: "membre-inf", KNEES: "membre-inf", CALVES: "membre-inf",
};
const zones: { zone: string; side: "D" | "G" | null; points: string }[] = [];
for (const m of anterior.matchAll(/muscle: MuscleType\.(\w+),\s*svgPoints: \[([\s\S]*?)\]/g)) {
  const zone = ZONE_OF[m[1]];
  if (!zone) throw new Error(`Zone inconnue pour ${m[1]}`);
  for (const p of m[2].matchAll(/'([^']+)'/g)) {
    const points = p[1].trim().replace(/\s+/g, " ");
    const xs = points.split(" ").filter((_, i) => i % 2 === 0).map(Number);
    const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
    // Vue de face : le côté droit du patient est à gauche de l'écran.
    const side = zone === "tete" || zone === "thorax" || zone === "abdomen" ? null : cx < 50 ? "D" : "G";
    zones.push({ zone, side, points });
  }
}
writeFileSync(
  join(atlas, "body-zones.ts"),
  `// Généré par scripts/build-atlas.mts à partir de react-body-highlighter (MIT, © 2020 GV79 — voir source/). Ne pas modifier.
// Silhouette de face, repère 100 × 200 ; le côté droit du patient est à gauche de l'écran.

export type BodyZonePolygon = { zone: string; side: "D" | "G" | null; points: string };

export const BODY_ZONES: BodyZonePolygon[] = ${JSON.stringify(zones)};
`,
);
console.log(`${Object.keys(bones).length} os, ${zones.length} polygones de silhouette.`);
