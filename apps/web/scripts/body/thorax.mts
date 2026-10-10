/**
 * Thorax : côtes, sternum, clavicules, scapulas et rachis dorsal de la planche ; poumons (par lobe), trachée, cœur et
 * gros vaisseaux Servier recalés dans la cage thoracique. Écrit src/lib/imaging/atlas/thorax-shapes.ts et thorax-art.ts.
 */
import { join } from "node:path";
import {
  figure, maskPath, shapesBody, splitTree, toArt, warpShapes, writeTs,
  type BoneSpec, type BuildContext, type Shape,
} from "../lib/body.mts";
import { Mask, polyPath, simplify, type Box } from "../lib/raster.mts";
import type { Pt } from "../lib/svg-path.mts";
import { thinPlate } from "../lib/warp.mts";

/** Ligne médiane du thorax sur la planche (sternum, rachis). */
const MID = 208.4;

/** Côtes de la planche (une par groupe) : droite = à gauche de l'écran. */
const RIBS: [n: number, right: string, left: string][] = [
  [2, "11.4.16.0.0", "11.4.17.0"],
  [3, "11.4.14", "11.4.15"],
  [4, "11.4.13.0", "11.4.12.0"],
  [5, "11.4.10.0", "11.4.11.0"],
  [6, "11.4.8", "11.4.9"],
  [7, "11.4.5.0", "11.4.7.0"],
  [8, "11.4.4", "11.4.6"],
  [9, "11.4.1", "11.4.3"],
  [10, "11.4.0", "11.4.2"],
  [11, "11.1", "11.0"],
  [12, "11.2", "11.3"],
];

/** Ordre de dessin : des plans postérieurs (scapulas, rachis) aux plans antérieurs (sternum, clavicules). */
export const THORAX_BONES: Record<string, BoneSpec> = {
  "scapula-d": { groups: ["8"], clip: [100, 168, MID - 100, 110] },
  "scapula-g": { groups: ["8"], clip: [MID, 168, 110, 110] },
  "rachis-dorsal": { groups: ["12", "10"], top: [3, 4, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 23], clip: [180, 170, 56, 162] },
  // Les deux 1res côtes (et leurs cartilages) sont dans un même groupe : séparées par la ligne médiane.
  "cote1-d": { groups: ["24"], clip: [150, 165, MID - 150, 50] },
  "cote1-g": { groups: ["24"], clip: [MID, 165, 60, 50] },
  ...Object.fromEntries(RIBS.flatMap(([n, r, l]) => [[`cote${n}-d`, { groups: [r] }], [`cote${n}-g`, { groups: [l] }]])),
  "cartilages-costaux": { groups: ["11.5"] },
  manubrium: { groups: ["25"] },
  "sternum-corps": { top: [37] },
  "clavicule-d": { groups: ["26"] },
  "clavicule-g": { groups: ["27"] },
};

type Lung = { apex: Pt; costo: Pt; medialBase: Pt; hilum: Pt; medialTop: Pt; lateral: Pt[] };
/** Hauteurs relatives (apex → cul-de-sac) où l'on apparie le bord latéral du poumon au bord interne des côtes. */
const LATERAL_LEVELS = [0.15, 0.3, 0.45, 0.6, 0.75, 0.9];

/**
 * Repères d'un poumon calculés sur son contour : apex (plus haut), cul-de-sac costo-diaphragmatique (plus bas en dehors),
 * angle cardio-phrénique (plus bas en dedans), bord médial en haut et au niveau du hile, bord latéral à plusieurs hauteurs.
 * `lateralSign` : −1 si le dehors est à gauche de l'écran (poumon droit), +1 sinon.
 */
function lungLandmarks(m: Mask, lateralSign: 1 | -1): Lung {
  const pts = m.outline();
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const apex = pts.reduce((a, p) => (p[1] < a[1] ? p : a));
  const isLat = (p: Pt) => (p[0] - cx) * lateralSign > 0;
  const lowest = (list: Pt[]) => list.reduce((a, p) => (p[1] > a[1] ? p : a));
  const costo = lowest(pts.filter(isLat));
  const medialBase = lowest(pts.filter((p) => !isLat(p)));
  const atHeight = (y: number, lateral: boolean) => {
    const band = pts.filter((p) => Math.abs(p[1] - y) < 1.5 && isLat(p) === lateral);
    return band.reduce((a, p) => ((p[0] - a[0]) * lateralSign * (lateral ? 1 : -1) > 0 ? p : a));
  };
  return {
    apex, costo, medialBase,
    hilum: atHeight(apex[1] + 0.45 * (medialBase[1] - apex[1]), false),
    medialTop: atHeight(apex[1] + 0.2 * (medialBase[1] - apex[1]), false),
    lateral: LATERAL_LEVELS.map((f) => atHeight(apex[1] + f * (costo[1] - apex[1]), true)),
  };
}

/** Bord interne des côtes du côté droit (relevé sur la planche quadrillée) ; le gauche est symétrique. */
const RIB_INNER: [y: number, x: number][] = [[190, 170], [200, 163], [220, 154], [240, 149], [260, 146], [280, 143.5], [300, 141.5], [320, 141]];
function ribInner(y: number, side: "D" | "G"): number {
  let x = RIB_INNER[RIB_INNER.length - 1][1];
  for (let i = 0; i + 1 < RIB_INNER.length; i++) {
    const [y0, x0] = RIB_INNER[i], [y1, x1] = RIB_INNER[i + 1];
    if (y >= y0 && y <= y1) { x = x0 + ((x1 - x0) * (y - y0)) / (y1 - y0); break; }
    if (y < y0) { x = x0; break; }
  }
  return side === "D" ? x + 1.2 : 2 * MID - x - 1.2;
}

/** Où doivent tomber les repères dans la cage thoracique de la planche (relevés sur la planche quadrillée). */
const TARGET = {
  D: { apex: [179, 187] as Pt, costo: [142.5, 322] as Pt, medialBase: [199, 306] as Pt, hilum: [197, 238] as Pt, medialTop: [199.5, 210] as Pt },
  G: { apex: [237.5, 187] as Pt, costo: [274, 324] as Pt, medialBase: [231, 313] as Pt, hilum: [221.5, 238] as Pt, medialTop: [218, 210] as Pt },
};
function lungPairs(src: Record<"D" | "G", Lung>): [Pt, Pt][] {
  return (["D", "G"] as const).flatMap((side) => {
    const s = src[side], t = TARGET[side];
    const fixed: [Pt, Pt][] = [[s.apex, t.apex], [s.costo, t.costo], [s.medialBase, t.medialBase], [s.hilum, t.hilum], [s.medialTop, t.medialTop]];
    const lateral = LATERAL_LEVELS.map((f, i): [Pt, Pt] => {
      const y = t.apex[1] + f * (t.costo[1] - t.apex[1]);
      return [s.lateral[i], [ribInner(y, side), y]];
    });
    return [...fixed, ...lateral];
  });
}

/** Repères du cœur (planche 12) : bord droit, bord gauche, pointe ; et où ils tombent sur la planche. */
function heartPairs(m: Mask): [Pt, Pt][] {
  const pts = m.outline();
  const right = pts.reduce((a, p) => (p[0] < a[0] ? p : a));
  const left = pts.reduce((a, p) => (p[0] > a[0] ? p : a));
  const apex = pts.reduce((a, p) => (p[1] + p[0] * 0.4 > a[1] + a[0] * 0.4 ? p : a));
  return [[right, [190.5, 268]], [left, [251, 283]], [apex, [241, 303]]];
}
/** Trajets des vaisseaux (planche) : chaque pixel des vaisseaux rouges / bleus revient au trajet le plus proche. */
const RED_ROUTES: Record<string, Pt[][]> = {
  aorte: [[[206, 232], [206, 220], [206.5, 208], [209, 200], [216, 196.5], [225, 198], [231, 204], [233.5, 214], [234, 226]]],
  "troncs-supra-aortiques": [[[205, 202], [196, 192], [182, 183], [168, 176], [155, 170]], [[219, 198], [219, 188], [219, 180]]],
  "veines-pulmonaires": [
    [[195, 245], [185, 248], [175, 262], [168, 285], [160, 305], [150, 318]], [[190, 240], [178, 228], [168, 215], [165, 200]],
    [[238, 245], [248, 255], [256, 280], [258, 305], [250, 320]], [[236, 238], [246, 222], [252, 210]],
  ],
};
const BLUE_ROUTES: Record<string, Pt[][]> = {
  vcs: [[[199, 200], [197.5, 212], [196.5, 225], [196, 236]]],
  "troncs-veineux": [[[199, 200], [188, 190], [175, 182], [160, 177]], [[201, 199], [215, 193], [232, 188], [248, 184], [256, 182]]],
  "arteres-pulmonaires": [
    [[222, 236], [222.5, 225], [220, 216], [212, 212], [200, 213], [190, 222], [180, 240], [170, 265], [162, 295], [155, 315]],
    [[222.5, 225], [232, 216], [244, 216], [252, 228], [260, 255], [262, 285], [258, 310]],
    [[190, 222], [176, 210], [168, 198]], [[244, 216], [250, 205], [255, 196]],
  ],
  vci: [[[218, 286], [219, 293], [220, 300]]],
};
export async function buildThorax({ plate, servierDir, atlasDir, debug }: BuildContext) {
  // ─── Peau : tronc entre les bras (le contour sert de barrière), coupé au cou et sous le rebord costal ───
  const BOX: Box = [108, 162, 200, 196];
  const S = 8;
  const outlineStroke = await Mask.render(`<path d="${plate.silhouette}" fill="none" stroke="#000" stroke-width="0.7"/>`, BOX, S);
  // Coupé aux épaules (x = 127) : les bras, reliés au tronc par l'épaule, resteraient sinon dans la zone.
  const frame = await Mask.render(`<rect x="127" y="168" width="${2 * MID - 254}" height="182" fill="#000"/>`, BOX, S);
  const skinMask = frame.minus(outlineStroke).component([MID, 260]);
  const skin = simplify(skinMask.outline(), 0.25);

  // ─── Poumons par lobe (planche « lobes ») ───
  const LOBES = { lsd: 9, lmd: 7, lid: 8, lsg: 11, lig: 10 } as const;
  const lobeFig = figure(servierDir, "Respiratory-system", 8, [6, 7, 8, 9, 10, 11]);
  const lungMask = async (list: Shape[], box: Box, scale: number) => Mask.render(shapesBody(list), box, scale);
  const SRC8: Box = [150, 95, 180, 200];
  const lobes8 = {
    D: await lungMask(lobeFig.filter((x) => [9, 7, 8].includes(x.s.path[0])), SRC8, 10),
    G: await lungMask(lobeFig.filter((x) => [11, 10].includes(x.s.path[0])), SRC8, 10),
  };
  const warp8 = thinPlate(...unzip(lungPairs({ D: lungLandmarks(lobes8.D, -1), G: lungLandmarks(lobes8.G, 1) })), 0.0005);
  const lobeShapes = warpShapes(lobeFig, warp8);

  // ─── Cœur, gros vaisseaux (planche « cœur et poumons »), recalés sur les mêmes repères pulmonaires ───
  const heartFig = figure(servierDir, "Respiratory-system", 12, [0]);
  const SRC12: Box = [300, 100, 360, 430];
  const lungs12 = heartFig.filter((x) => x.s.fill === "#efced9");
  const [r12, l12] = [...lungs12].sort((a, b) => a.center[0] - b.center[0]);
  const heartSrc = await lungMask(heartFig.filter((x) => ["#eeb2bc", "#ab0b35"].includes(x.s.fill)), SRC12, 6);
  const pairs12 = [...lungPairs({ D: lungLandmarks(await lungMask([r12], SRC12, 6), -1), G: lungLandmarks(await lungMask([l12], SRC12, 6), 1) }), ...heartPairs(heartSrc)];
  const warp12 = thinPlate(...unzip(pairs12), 0.001);
  const heart12 = warpShapes(heartFig, warp12);

  // Rôles par couleur (planche 12) : on en garde le cœur et les vaisseaux ; poumons et trachée viennent de la planche 8.
  const HEART = new Set(["#eeb2bc", "#ab0b35", "#8e022d", "#7a0e26", "#630921", "#dd0e4e", "#d18294", "#dd7f93"]);
  const RED = new Set(["#f55c3f", "#e2422d", "#e0422d", "#f77766", "#fc9183"]);
  const BLUE = new Set(["#a4c6da", "#7794bf", "#95bace", "#bdd8e5", "#b4daed"]);
  const PLATE_BOX: Box = [120, 165, 176, 195];
  const heartShapes = heart12.filter((x) => HEART.has(x.s.fill));
  const redShapes = heart12.filter((x) => RED.has(x.s.fill));
  const blueShapes = heart12.filter((x) => BLUE.has(x.s.fill));
  const vesselMask = (await Mask.render(shapesBody([...redShapes, ...blueShapes]), PLATE_BOX, S)).grow(2);
  const heartMask = (await Mask.render(shapesBody(heartShapes), PLATE_BOX, S)).grow(2);
  /** Contours (traits sans remplissage) : rattachés au calque de ce qu'ils entourent. */
  const outlines = heart12.filter((x) => x.s.fill === "none" && x.s.stroke);
  const majority = (m: Mask, x: Shape) => {
    const pts = x.segs.flatMap((s) => s.p);
    return pts.filter((p) => m.inside(p)).length / pts.length > 0.6;
  };
  const vesselOutlines = outlines.filter((x) => majority(vesselMask, x));
  const heartOutlines = outlines.filter((x) => !majority(vesselMask, x) && majority(heartMask, x));
  const highlights = heart12.filter((x) => x.s.fill === "#ffffff" && (majority(vesselMask, x) || majority(heartMask, x)));

  const SCALE = 0.55; // pt (planches 8 et 12) → unités de la planche, environ
  const art = (list: Shape[], scale = SCALE) => list.map((x) => toArt(x, scale));
  const lobeArt = art(lobeShapes, 0.75);
  await debug.art("thorax-art", PLATE_BOX, [...lobeArt, ...art([...heartShapes, ...heartOutlines]), ...art([...redShapes, ...blueShapes, ...vesselOutlines])], 8,
    plate.group("11").replace(/fill="#FFFFFF"/g, 'fill="none"').replace(/<g\b[^>]*>/, '<g opacity="0.5">'));

  // ─── Structures ───
  const lobeShapesOut: Record<string, string> = {};
  for (const [id, g] of Object.entries(LOBES)) {
    lobeShapesOut[id] = maskPath(await Mask.render(shapesBody(lobeShapes.filter((x) => x.s.path[0] === g)), PLATE_BOX, S), 0.25, 50);
  }
  const trachea = maskPath(await Mask.render(shapesBody(lobeShapes.filter((x) => x.s.path[0] === 6 && x.s.fill !== "none")), PLATE_BOX, S), 0.2, 30);
  const heartOutline = (await Mask.render(shapesBody(heartShapes), PLATE_BOX, S)).outline();
  const redSplit = splitTree(await Mask.render(shapesBody(redShapes), PLATE_BOX, S), RED_ROUTES, 30);
  const blueSplit = splitTree(await Mask.render(shapesBody(blueShapes), PLATE_BOX, S), BLUE_ROUTES, 30);
  await debug.split("thorax-red", redSplit);
  await debug.split("thorax-blue", blueSplit);

  /** Contour latéral d'un poumon (plèvre) et base (diaphragme), en lignes brisées, d'après le poumon recalé. */
  const lungRim = async (side: "D" | "G") => {
    const ids = side === "D" ? ["lsd", "lmd", "lid"] : ["lsg", "lig"];
    const m = await Mask.render(shapesBody(lobeShapes.filter((x) => ids.some((id) => LOBES[id as keyof typeof LOBES] === x.s.path[0]))), PLATE_BOX, S);
    const pts = simplify(m.outline(), 0.4);
    const t = { ...TARGET[side], lateral: [ribInner(255, side), 255] as Pt };
    const near = (p: Pt) => pts.reduce((best, q, i) => (Math.hypot(q[0] - p[0], q[1] - p[1]) < Math.hypot(pts[best][0] - p[0], pts[best][1] - p[1]) ? i : best), 0);
    const arc = (from: number, to: number) => {
      const out: Pt[] = [];
      for (let i = from; ; i = (i + 1) % pts.length) {
        out.push(pts[i]);
        if (i === to) break;
      }
      return out;
    };
    // Sens du contour : on prend l'arc apex → cul-de-sac qui passe par le bord latéral.
    const a = near(t.apex), c = near(t.costo), m2 = near(t.medialBase), l = near(t.lateral);
    const arc1 = arc(a, c), arc2 = arc(c, a);
    const pleura = arc1.some((p) => p === pts[l]) ? arc1 : arc2.reverse();
    const base1 = arc(c, m2), base2 = arc(m2, c);
    const base = base1.length < base2.length ? base1 : base2.reverse();
    return { pleura, base };
  };
  const rimD = await lungRim("D"), rimG = await lungRim("G");
  const line = (pts: Pt[]) => `M${pts.map((p) => `${Math.round(p[0] * 10) / 10},${Math.round(p[1] * 10) / 10}`).join("L")}`;

  // ─── Écriture ───
  const round = (p: Pt): Pt => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];
  writeTs(
    join(atlasDir, "thorax-shapes.ts"),
    `// Généré par scripts/build-body.mts (planche LadyofHats + Servier Medical Art CC BY 4.0, recalé). Ne pas modifier.
// Thorax, en coordonnées de la planche du squelette entier.`,
    `/** Contour de la peau du tronc (base du cou → rebord costal). */
export const THORAX_SKIN = ${JSON.stringify(polyPath(skin.map(round)))};

/** Lobes pulmonaires (lsd, lmd, lid, lsg, lig). */
export const THORAX_LOBES: Record<string, string> = ${JSON.stringify(lobeShapesOut)};

/** Trachée et bronches souches. */
export const THORAX_TRACHEA = ${JSON.stringify(trachea)};

/** Cœur (contour). */
export const THORAX_HEART = ${JSON.stringify(polyPath(simplify(heartOutline, 0.25).map(round)))};

/** Vaisseaux, par structure. */
export const THORAX_VESSELS: Record<string, string> = ${JSON.stringify({ ...redSplit.paths, ...blueSplit.paths })};

/** Lignes : plèvres (bord latéral de chaque poumon) et coupoles diaphragmatiques (base des poumons). */
export const THORAX_LINES = ${JSON.stringify({ "plevre-d": line(rimD.pleura), "plevre-g": line(rimG.pleura), "diaphragme-d": line(rimD.base), "diaphragme-g": line(rimG.base) })};`,
  );
  const layers = {
    organes: [...lobeArt, ...art([...heartShapes, ...heartOutlines, ...highlights.filter((x) => majority(heartMask, x))])],
    vaisseaux: art([...redShapes, ...blueShapes, ...vesselOutlines, ...highlights.filter((x) => majority(vesselMask, x))]),
  };
  writeTs(
    join(atlasDir, "thorax-art.ts"),
    `// Généré par scripts/build-body.mts à partir de Servier Medical Art (smart.servier.com, CC BY 4.0), recalé sur la planche
// du squelette. Modifications : poumons (lobes), cœur et gros vaisseaux replacés dans la cage thoracique. Ne pas modifier.

import type { RegionArt } from "../anatomy";`,
    `export const THORAX_ART: RegionArt = { layers: ${JSON.stringify(layers)} };`,
  );
  console.log(`Thorax : ${lobeShapes.length} formes pulmonaires, ${heartShapes.length + redShapes.length + blueShapes.length} formes cœur et vaisseaux.`);
}

function unzip(pairs: [Pt, Pt][]): [Pt[], Pt[]] {
  return [pairs.map((p) => p[0]), pairs.map((p) => p[1])];
}
