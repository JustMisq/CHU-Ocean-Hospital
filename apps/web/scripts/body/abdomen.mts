/**
 * Abdomen et bassin : rachis lombaire, bassin, sacrum de la planche ; foie, rate, pancréas, tube digestif, reins, uretères,
 * vessie et gros vaisseaux Servier recalés dans la cavité abdominale. Écrit atlas/abdomen-shapes.ts et abdomen-art.ts.
 */
import { join } from "node:path";
import { figure, maskPath, shapesBody, splitTree, toArt, warpShapes, writeTs, type BoneSpec, type BuildContext, type Shape } from "../lib/body.mts";
import { Mask, polyPath, simplify, type Box } from "../lib/raster.mts";
import type { Pt } from "../lib/svg-path.mts";
import { thinPlate } from "../lib/warp.mts";
import { MIDLINE } from "./lower-limb.mts";

export const ABDOMEN_BONES: Record<string, BoneSpec> = {
  "rachis-lombaire": { groups: ["10"], clip: [180, 324, 56, 84] },
  sacrum: { groups: ["9.1"] },
  coccyx: { groups: ["9.0"] },
  "os-coxal-g": { groups: ["7", "4"], clip: [MIDLINE, 360, 110, 120] },
  "femur-prox-d": { groups: ["5"], clip: [100, 420, MIDLINE - 100, 62] },
  "femur-prox-g": { groups: ["6"], clip: [MIDLINE, 420, 110, 62] },
};

/** Organes digestifs (diapositive 5 du kit digestif, figure assemblée de gauche) : groupe → structure. */
const DIGESTIVE: Record<number, string> = {
  30: "foie", 24: "vesicule", 27: "vesicule", 26: "estomac", 2: "rate", 4: "pancreas", 25: "duodenum", 28: "grele", 29: "colon",
  0: "aorte-abdominale", 3: "veine-porte",
};

/** Repères (Servier → planche) relevés sur les deux dessins quadrillés. */
const DIGESTIVE_PAIRS: [Pt, Pt][] = [
  [[228, 286], [172, 299]], // dôme hépatique
  [[203, 320], [138, 323]], // bord droit du foie
  [[208, 356], [146, 352]], // pointe inférieure du foie
  [[296, 298], [242, 314]], // pointe du lobe gauche
  [[299, 333], [263, 323]], // rate
  [[212, 372], [152, 360]], // angle colique droit
  [[205, 420], [146, 396]], // côlon ascendant (bord latéral)
  [[216, 470], [160, 428]], // fond du cæcum
  [[305, 364], [264, 345]], // angle colique gauche
  [[313, 440], [273, 400]], // côlon descendant (bord latéral)
  [[285, 487], [232, 442]], // sigmoïde
  [[258, 513], [208, 474]], // canal anal
  [[256, 290], [207, 302]], // aorte (hiatus)
  [[256, 350], [207, 345]], // aorte (L1-L2)
  [[265, 430], [212, 410]], // centre du grêle
];

/** Appareil urinaire (diapositive 3 du kit urinaire, figure de gauche). */
const URINARY_PAIRS: [Pt, Pt][] = [
  [[230, 96], [182, 326]], [[225, 183], [180, 371]], [[202, 140], [167, 349]], [[243, 145], [194, 350]], // rein droit
  [[352, 96], [234, 318]], [[355, 183], [235, 363]], [[382, 140], [249, 340]], [[330, 135], [222, 340]], // rein gauche
  [[262, 260], [197, 400]], [[318, 260], [219, 400]], // uretères (croisement des vaisseaux iliaques)
  [[257, 322], [200, 437]], [[323, 322], [216, 437]], // abouchement dans la vessie
  [[290, 306], [208, 431]], [[290, 384], [208, 455]], [[250, 345], [194, 444]], [[330, 345], [222, 444]], [[290, 405], [208, 466]], // vessie, urètre
];

/** Segments du côlon : trajets dans le repère de la figure Servier (déformés avec elle). */
const COLON_ROUTES: Record<string, Pt[][]> = {
  caecum: [[[214, 438], [218, 452], [222, 468]], [[236, 462], [245, 465]]],
  "colon-ascendant": [[[211, 434], [210, 410], [211, 385]]],
  "colon-transverse": [[[216, 374], [240, 392], [262, 398], [285, 386], [298, 372]]],
  "colon-descendant": [[[306, 368], [309, 400], [309, 440], [304, 468]]],
  sigmoide: [[[302, 474], [292, 485], [276, 488], [264, 480], [261, 466], [254, 462]]],
  rectum: [[[258, 470], [258, 492], [258, 512]]],
};

export async function buildAbdomen({ plate, servierDir, atlasDir, debug }: BuildContext) {
  // ─── Peau : tronc du rebord costal au périnée (le contour sert de barrière, les bras restent dehors) ───
  const BOX: Box = [110, 290, 196, 196];
  const S = 8;
  const outlineStroke = await Mask.render(`<path d="${plate.silhouette}" fill="none" stroke="#000" stroke-width="0.7"/>`, BOX, S);
  const frame = await Mask.render(`<rect x="117" y="296" width="${2 * MIDLINE - 234}" height="182" fill="#000"/>`, BOX, S);
  const skinMask = frame.minus(outlineStroke).component([MIDLINE, 380]);
  const skin = simplify(skinMask.outline(), 0.25);

  // ─── Organes recalés ───
  const digestive = figure(servierDir, "Digestive-system", 5, Object.keys(DIGESTIVE).map(Number));
  const warpD = thinPlate(DIGESTIVE_PAIRS.map((p) => p[0]), DIGESTIVE_PAIRS.map((p) => p[1]), 0.002);
  const dig = warpShapes(digestive, warpD);
  const urinary = figure(servierDir, "Urinary-system", 3, [0]);
  const warpU = thinPlate(URINARY_PAIRS.map((p) => p[0]), URINARY_PAIRS.map((p) => p[1]), 0.002);
  const uri = warpShapes(urinary, warpU);

  const PLATE_BOX: Box = [118, 290, 180, 192];
  const mask = (list: Shape[]) => Mask.render(shapesBody(list), PLATE_BOX, S);
  const organ = (id: string) => dig.filter((x) => DIGESTIVE[x.s.path[0]] === id);
  const shapes: Record<string, string> = {};
  for (const id of ["foie", "vesicule", "estomac", "rate", "pancreas", "duodenum", "grele"]) shapes[id] = maskPath(await mask(organ(id)), 0.25, 40);

  // Côlon : découpé par segments le long de trajets (déformés comme la figure).
  const routes = Object.fromEntries(Object.entries(COLON_ROUTES).map(([id, rs]) => [id, rs.map((r) => r.map(warpD))]));
  const colonSplit = splitTree(await mask(organ("colon")), routes, 12, 0.25);
  await debug.split("abdomen-colon", colonSplit);
  Object.assign(shapes, colonSplit.paths);

  // Vaisseaux (aorte et branches ; système porte).
  const vessels = { "aorte-abdominale": maskPath(await mask(organ("aorte-abdominale")), 0.2, 20), "veine-porte": maskPath(await mask(organ("veine-porte")), 0.2, 20) };

  // Appareil urinaire : reins (séparés par la ligne médiane), uretères (couleur), vessie.
  const URETER = new Set(["#fcd59c", "#fac170", "#f7ad4e", "#b87627"]);
  const urinaryMask = await mask(uri.filter((x) => x.s.fill !== "none"));
  const half = async (left: boolean) => Mask.render(`<rect x="${left ? 100 : MIDLINE}" y="300" width="${left ? MIDLINE - 100 : 120}" height="80" fill="#000"/>`, PLATE_BOX, S);
  const kidneyZone = urinaryMask.and(await Mask.render(`<rect x="100" y="300" width="220" height="74" fill="#000"/>`, PLATE_BOX, S));
  const ureterMask = await mask(uri.filter((x) => URETER.has(x.s.fill)));
  shapes["rein-d"] = maskPath(kidneyZone.and(await half(true)).minus(ureterMask), 0.25, 60);
  shapes["rein-g"] = maskPath(kidneyZone.and(await half(false)).minus(ureterMask), 0.25, 60);
  shapes.ureteres = maskPath(ureterMask.minus(kidneyZone.minus(ureterMask)), 0.2, 10);
  shapes.vessie = maskPath(urinaryMask.and(await Mask.render(`<rect x="180" y="428" width="56" height="45" fill="#000"/>`, PLATE_BOX, S)).minus(ureterMask), 0.25, 40);

  const SCALE = 0.62;
  const ordered = [
    ...uri.map((x) => ({ ...toArt(x, SCALE * 0.55), layer: "organes" as const })),
    ...dig.map((x) => ({ ...toArt(x, SCALE), layer: (DIGESTIVE[x.s.path[0]] === "aorte-abdominale" || DIGESTIVE[x.s.path[0]] === "veine-porte" ? "vaisseaux" : "organes") as "organes" | "vaisseaux" })),
  ];
  await debug.art("abdomen-art", PLATE_BOX, ordered, 8, plate.group("10").replace(/<g\b[^>]*>/, '<g opacity="0.4">') + plate.group("7").replace(/<g\b[^>]*>/, '<g opacity="0.4">'));

  const round = (p: Pt): Pt => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];
  writeTs(
    join(atlasDir, "abdomen-shapes.ts"),
    `// Généré par scripts/build-body.mts (planche LadyofHats + Servier Medical Art CC BY 4.0, recalé). Ne pas modifier.
// Abdomen et bassin, en coordonnées de la planche du squelette entier.`,
    `/** Contour de la peau du tronc (rebord costal → périnée). */
export const ABDOMEN_SKIN = ${JSON.stringify(polyPath(skin.map(round)))};

/** Organes et segments digestifs, par structure. */
export const ABDOMEN_ORGANS: Record<string, string> = ${JSON.stringify(shapes)};

/** Vaisseaux, par structure. */
export const ABDOMEN_VESSELS: Record<string, string> = ${JSON.stringify(vessels)};`,
  );
  writeTs(
    join(atlasDir, "abdomen-art.ts"),
    `// Généré par scripts/build-body.mts à partir de Servier Medical Art (smart.servier.com, CC BY 4.0), recalé sur la planche
// du squelette. Modifications : appareils digestif et urinaire replacés dans l'abdomen. Ne pas modifier.

import type { RegionArt } from "../anatomy";`,
    `export const ABDOMEN_ART: RegionArt = { layers: {}, ordered: ${JSON.stringify(ordered)} };`,
  );
  console.log(`Abdomen : ${dig.length} formes digestives, ${uri.length} urinaires.`);
}
