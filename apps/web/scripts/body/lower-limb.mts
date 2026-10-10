/**
 * Membre inférieur DROIT (à gauche de l'écran) : os de la planche, peau, muscles / nerfs / artères Servier recalés.
 * Écrit src/lib/imaging/atlas/lower-limb-shapes.ts (léger) et lower-limb-art.ts (illustration, lourd).
 */
import { join } from "node:path";
import {
  edges, figure, lerp, regionPath, shapesBody, splitTree, strokeOf, toArt, warpShapes, writeTs,
  type BoneSpec, type BuildContext, type Seeds, type Shape,
} from "../lib/body.mts";
import type { SvgShape } from "../lib/pptx-svg.mts";
import { Mask, polyPath, simplify, type Box } from "../lib/raster.mts";
import { writePath, type Pt } from "../lib/svg-path.mts";
import { thinPlate } from "../lib/warp.mts";

/** Ligne médiane de la planche (centre de la symphyse pubienne). */
export const MIDLINE = 207.4;

export const LOWER_LIMB_BONES: Record<string, BoneSpec> = {
  "os-coxal": { groups: ["7", "4"], clip: [100, 360, MIDLINE - 100, 120] },
  femur: { groups: ["5"] },
  patella: { groups: ["34"] },
  tibia: { groups: ["3"] },
  fibula: { groups: ["2"] },
  talus: { groups: ["0.0.0"] },
  cuboide: { groups: ["0.0.1.0"] },
  naviculaire: { groups: ["0.0.1.1"] },
  "cuneiforme-lat": { groups: ["0.0.1.2"] },
  "cuneiforme-int": { groups: ["0.0.1.3"] },
  "cuneiforme-med": { groups: ["0.0.1.4"] },
  mt5: { groups: ["0.0.1.5.0"] },
  mt4: { groups: ["0.0.1.5.1"] },
  mt3: { groups: ["0.0.1.5.2"] },
  mt2: { groups: ["0.0.1.5.3"] },
  mt1: { groups: ["0.0.1.5.4"] },
  "orteil5-p1": { groups: ["0.0.1.5.5.0"] },
  "orteil5-p2": { groups: ["0.0.1.5.5.9"] },
  "orteil4-p1": { groups: ["0.0.1.5.5.1"] },
  "orteil4-p2": { groups: ["0.0.1.5.5.8"] },
  "orteil3-p1": { groups: ["0.0.1.5.5.2"] },
  "orteil3-p2": { groups: ["0.0.1.5.5.3"] },
  "orteil2-p1": { groups: ["0.0.1.5.5.4"] },
  "orteil2-p2": { groups: ["0.0.1.5.5.5"] },
  "orteil1-p1": { groups: ["0.0.1.5.5.6"] },
  "orteil1-p2": { groups: ["0.0.1.5.5.7"] },
};

/** Repères anatomiques appariés (Servier → planche), relevés sur des agrandissements des deux dessins. */
const LANDMARKS: [Pt, Pt][] = [
  [[271.0, 282.3], [138, 412]], // épine iliaque antéro-supérieure
  [[302.2, 310.9], [207, 458]], // symphyse pubienne
  [[284.2, 394.3], [175.5, 660]], // centre de la patella
  [[275.5, 399.4], [158, 683]], // tête de la fibula
  [[285.2, 408.8], [177, 688]], // tubérosité tibiale
  [[288.4, 508.8], [158.8, 903.7]], // pointe de l'hallux
  [[271.4, 503.5], [131.8, 890.8]], // pointe du 5e orteil
  [[296.5, 503], [180, 895.5]], // bord médial du pied (1re métatarso-phalangienne)
  [[277.4, 494.9], [150.2, 865]], // bord latéral du pied (base du 5e métatarsien)
];

/** Rôle d'une forme de la figure des muscles, d'après ses couleurs. */
const MUSCLE_ROLE: Record<string, "mass" | "detail" | "border" | "tendon" | "tendon-line" | "bone" | "skin"> = {
  "#eaaf92|-": "mass",
  "#c68d72|-": "detail", "#dd9879|-": "detail", "#f6dccf|-": "detail", "#ffffff|-": "detail", "none|#eaaf92": "detail",
  "none|#794835": "border",
  "#f1ecec|-": "tendon", "none|#f1ecec": "tendon-line", "#bfbcc1|-": "tendon-line", "none|#7b7c7e": "tendon-line",
  "#ffecc7|-": "bone", "#fbd98d|-": "bone", "#e6ca8b|-": "bone",
};
const roleOf = (s: SvgShape) => MUSCLE_ROLE[`${s.fill}|${s.stroke ?? "-"}`] ?? "skin";

/** Muscles et tendons : points de départ (coordonnées de la planche, relevés sur les images de contrôle) → structure. */
const MUSCLE_SEEDS: Record<string, Seeds> = {
  "moyen-fessier": { seeds: [[133.2, 418.2]] },
  tfl: { seeds: [[132.8, 453.9]] },
  "ilio-psoas": { seeds: [[167.1, 459.6]] },
  pectine: { seeds: [[181.4, 473.6]] },
  "long-adducteur": { seeds: [[186.8, 507.7]] },
  gracile: { seeds: [[198.4, 537.0]] },
  sartorius: { seeds: [[172.3, 523.9]] },
  "droit-femoral": { seeds: [[158.8, 549.5]] },
  "vaste-lateral": { seeds: [[147.2, 569.7], [144.1, 589.6]] },
  "vaste-medial": { seeds: [[185.0, 613.3]] },
  "loge-anterieure": { seeds: [[172.9, 727.1], [168.2, 771.9], [174.0, 785.2]] },
  fibulaires: { seeds: [[157.4, 717.3]] },
  gastrocnemien: { seeds: [[195.6, 709.6]] },
  soleaire: { seeds: [[193.6, 754.5]] },
  pedieux: { seeds: [[186.5, 841.6], [177.2, 844.3], [183.1, 864.1]] },
};
/** La zone tendineuse du genou réunit tendon quadricipital, rétinaculums et ligament patellaire : séparés par des rectangles. */
const TENDON_SEEDS: Record<string, Seeds> = {
  "ligament-inguinal": { seeds: [[170, 443]] },
  "tendon-quadricipital": { seeds: [[174.4, 661.0]], clip: [163, 615, 28, 37] },
  "ligament-patellaire": { seeds: [[174.4, 661.0]], clip: [167, 673, 17, 22] },
  "retinaculum-extenseurs": { seeds: [[185.5, 830.0]] },
};

/** Trajets approximatifs (planche) : chaque pixel de l'arbre nerveux / artériel revient au trajet le plus proche. */
const NERVE_ROUTES: Record<string, Pt[][]> = {
  "n-cutane-lat": [
    [[148, 360], [140.5, 385], [139.5, 400], [137.5, 420], [135, 440], [135, 460], [134, 476], [131, 486]],
    [[137.5, 425], [142, 441], [143.5, 451]],
    [[147, 500], [141, 509], [133, 524], [128.5, 527]],
    [[141, 512], [137.5, 525], [137.8, 532], [135.5, 546], [135, 550]],
  ],
  "n-femoral": [
    [[186, 362], [178, 385], [168, 410], [161, 432]],
    [[205, 380], [190, 390], [178, 405], [165, 425]],
    [[176, 368], [170, 395], [163, 420]],
    [[198, 362], [185, 378], [176, 395]],
    [[160, 432], [161, 450], [162, 470], [164, 488]],
  ],
  "n-obturateur": [
    [[181, 360], [180.5, 380], [180, 400], [180, 425], [181, 440], [186, 450], [192, 454]],
    [[183, 465], [184, 480], [184, 505]],
    [[181, 440], [185, 460], [190, 483], [193, 495], [195, 515], [196, 538]],
  ],
  "n-sciatique": [[[168, 360], [165, 390], [162, 410], [159, 430], [157, 450], [156, 470], [156, 490], [157, 510], [160, 530], [163, 545], [166, 560], [172, 578], [178.5, 625], [180.5, 645]]],
  "n-tibial": [[[180.5, 645], [181.3, 663], [182.3, 701.5], [183.2, 720], [185.6, 748.5], [188.4, 767.5], [192.2, 791.3], [196, 805.5], [198.9, 824.6], [198.9, 838.8], [195.1, 851.2], [186.5, 865.4], [173.2, 881.6], [160.9, 893]]],
  "n-fibulaire-commun": [[[157, 455], [153, 465], [150, 475], [147, 495], [147, 520], [148, 540], [151.9, 578], [155.6, 585], [158.5, 606.5], [161.4, 625.5], [162.8, 644.5], [162.8, 663.5], [161.4, 680.6], [158, 689]], [[154.7, 589], [152.3, 601.8]]],
  "n-fibulaire-superficiel": [
    [[158, 690], [157.6, 701], [159.9, 720], [164.7, 748.5], [169, 769.4], [171.8, 790.3], [174.7, 807.5], [176.1, 824.6], [172.3, 843.6], [169, 853], [156.1, 860.7], [137.6, 875]],
    [[169, 853], [164, 860], [154.2, 871], [141.4, 881.6]],
  ],
  "n-fibulaire-profond": [[[158.5, 689], [163, 705], [167, 720.5], [173.2, 739], [178, 763.7], [182.7, 796], [188.4, 815], [185.6, 838.8], [179.9, 853], [178, 860.7], [169.4, 870.2], [159.9, 879.7], [152.3, 889.2]]],
  "n-saphene": [
    [[164, 488], [171, 500], [176, 515], [179, 535], [182, 555], [187, 571], [190, 583], [195.6, 597], [198, 625], [196.5, 645], [194.6, 668], [196.5, 690], [200.3, 711], [199.8, 730], [197, 763], [194, 786], [195, 800]],
    [[188, 578], [191.8, 597], [188.9, 618], [189.4, 626.5]],
    [[196.5, 690], [197.5, 701.5], [195.6, 714], [193.2, 720.5], [189.9, 730], [188.9, 744.7]],
    [[195, 851], [192.2, 867.3]],
  ],
};
const ARTERY_ROUTES: Record<string, Pt[][]> = {
  "a-iliaque-ext": [[[210, 362], [200, 375], [190, 390], [180, 405], [172, 420], [166, 440], [163, 452]]],
  "a-femorale": [
    [[163, 452], [161, 460], [159.5, 480], [160, 510], [162, 540], [166, 560], [170, 590], [174, 620], [177, 640]],
    [[168.75, 540], [176, 555], [182.5, 571.8], [190.75, 602], [194.9, 624], [199, 644.7]],
    [[179.75, 596.5], [188, 613], [193.5, 624]],
  ],
  "a-femorale-profonde": [
    [[158, 462], [150, 463], [145, 470], [141, 485], [139.5, 505], [141, 530], [145, 560], [149.5, 566], [157.75, 593.8], [163.25, 621.3], [164.6, 648.8], [161.9, 676.3], [159, 690]],
    [[148, 442], [145, 456], [150, 463]],
    [[140, 480], [130, 478]],
    [[138, 505], [131, 500], [131, 515], [133, 530], [135, 545]],
  ],
  "a-poplitee": [[[177, 640], [179.5, 655], [181, 670], [181.5, 690]]],
  "a-tibiale-ant": [
    [[179, 668], [174.7, 692], [170.9, 711], [169, 730], [170, 748.5], [172.5, 780], [174.7, 815], [175.6, 834], [177, 843.6], [173, 855], [169.4, 862.6], [159.5, 865.4], [151.4, 876], [145, 882]],
    [[151, 876], [140, 890]], [[155, 872], [146, 895]], [[160, 870], [152, 898]], [[165, 890], [163, 903]],
  ],
  "a-fibulaire": [[[181, 697], [181.5, 720], [182, 760], [182, 786.5], [184, 805], [186.5, 824.6], [189, 830], [185.6, 853], [180.8, 872], [179.9, 881.6]]],
  "a-tibiale-post": [[[183, 697], [188.4, 720], [190, 760], [192.2, 815], [196, 829.3], [200.8, 843.6], [198, 853], [186.5, 876.8], [176.1, 891], [162.8, 894]]],
};

export async function buildLowerLimb({ plate, servierDir, atlasDir, debug }: BuildContext) {
  // ─── Peau ───
  const LEG_BOX: Box = [96, 356, 116, 556];
  const S = 8; // pixels par unité de la planche
  // Le contour sert de barrière (les faces internes des cuisses se touchent presque : un simple remplissage les fondrait).
  const outlineStroke = await Mask.render(`<path d="${plate.silhouette}" fill="none" stroke="#000" stroke-width="0.7"/>`, LEG_BOX, S);
  // Fenêtre : jusqu'à la ligne médiane au-dessus de l'entrejambe, puis en deçà de la face interne de la cuisse (sinon la fente
  // entre les deux cuisses, reliée au bassin, ferait partie de la jambe).
  const legWindow = await Mask.render(`<path d="M${LEG_BOX[0]},362H${MIDLINE}V520H205.5V${LEG_BOX[1] + LEG_BOX[3]}H${LEG_BOX[0]}Z" fill="#000"/>`, LEG_BOX, S);
  const legSkinMask = legWindow.minus(outlineStroke).component([160, 600]);
  const legSkin = simplify(legSkinMask.outline(), 0.25);

  // ─── Figures Servier : muscles, nerfs (même silhouette), artères (décalée sur sa diapositive) ───
  const muscles = figure(servierDir, "Muscles", 3, [0]);
  const nerves = figure(servierDir, "Nervous-system", 29, [0]);
  const arteries = figure(servierDir, "Arteries-physiology", 3, [0], [6, -3]);

  const SERV_BOX: Box = [236, 262, 72, 256];
  const servMask = await Mask.render(muscles.map(({ segs }) => `<path d="${writePath(segs, 3)}" fill="#000" stroke="#000" stroke-width="0.3"/>`).join(""), SERV_BOX, 16);

  // Bords de la peau, appariés à hauteur relative : cuisse (entrejambe → genou) et jambe (genou → cheville).
  const AXES = {
    serv: { crotch: [302.3, 326.5] as Pt, thigh: [278, 318] as Pt, knee: [284.2, 394.3] as Pt, ankle: [290, 482] as Pt },
    plate: { crotch: [MIDLINE, 492] as Pt, thigh: [150, 470] as Pt, knee: [175.5, 660] as Pt, ankle: [184, 845] as Pt },
  };
  const pairs: [Pt, Pt][] = [...LANDMARKS];
  for (const [a, b, from] of [["crotch", "knee", 1], ["knee", "ankle", 1]] as const) {
    for (let i = from; i <= 7; i++) {
      const t = i / 7;
      const sy = lerp(AXES.serv[a], AXES.serv[b], t)[1], py = lerp(AXES.plate[a], AXES.plate[b], t)[1];
      const sx = a === "crotch" ? lerp(AXES.serv.thigh, AXES.serv.knee, t)[0] : lerp(AXES.serv.knee, AXES.serv.ankle, t)[0];
      const px = a === "crotch" ? lerp(AXES.plate.thigh, AXES.plate.knee, t)[0] : lerp(AXES.plate.knee, AXES.plate.ankle, t)[0];
      const se = edges(servMask, sy, sx), pe = edges(legSkinMask, py, px);
      pairs.push([[se[0], sy], [pe[0], py]], [[se[1], sy], [pe[1], py]]);
    }
  }
  // Hanche : bord latéral à hauteur de l'épine iliaque et un peu au-dessus.
  for (const [sy, py] of [[282.3, 412], [272, 390]] as const) {
    pairs.push([[edges(servMask, sy, 268)[0], sy], [edges(legSkinMask, py, 140)[0], py]]);
  }
  const warp = thinPlate(pairs.map((p) => p[0]), pairs.map((p) => p[1]), 0.0005);

  /** Formes de la jambe droite sur la figure : sous le pli de l'aine, hors de la main qui pend le long de la cuisse. */
  const inLeg = ([x, y]: Pt) => {
    if (x >= 302.3) return false;
    const groin = 279 + ((x - 268) * (309 - 279)) / (302 - 268); // ligne épine iliaque → pubis
    if (y < groin) return false;
    return y > 350 || x >= 263;
  };
  const pick = (list: Shape[], keep: (s: SvgShape) => boolean) => warpShapes(list.filter((x) => inLeg(x.center) && keep(x.s)), warp);
  const legMuscles = pick(muscles, (s) => roleOf(s) !== "skin");
  const legNerves = pick(nerves, (s) => s.fill === "#fcc30e" || s.fill === "#fbbd12");
  const legArteries = pick(arteries, (s) => s.fill === "#e2001a");
  const SCALE = 2.15; // pt → unités de la planche, environ
  const sw = (s: SvgShape) => strokeOf(s, SCALE);

  // ─── Découpage des muscles et des tendons ───
  const byRole = (role: string) => legMuscles.filter((x) => roleOf(x.s) === role);
  const mass = await Mask.render(shapesBody(byRole("mass")), LEG_BOX, S);
  const borders = await Mask.render(byRole("border").map((x) => `<path d="${writePath(x.segs, 3)}" fill="none" stroke="#000" stroke-width="${Math.max(0.55, sw(x.s) * 1.4)}" stroke-linecap="round"/>`).join(""), LEG_BOX, S);
  const tendonMask = await Mask.render(shapesBody(byRole("tendon")), LEG_BOX, S);
  const boneBits = await Mask.render(shapesBody(byRole("bone")), LEG_BOX, S);
  const muscleRegions = mass.and(legSkinMask).minus(borders).minus(tendonMask).minus(boneBits);
  const tendonRegions = tendonMask.and(legSkinMask).minus(borders);

  const art = (list: typeof legMuscles) => list.map((x) => toArt(x, SCALE));
  await debug.art("art-thigh", [110, 400, 100, 160], art(legMuscles));
  await debug.art("art-knee-leg", [135, 600, 75, 160], art(legMuscles));
  await debug.art("art-foot", [125, 790, 85, 120], art(legMuscles));
  await debug.art("art-nerves-thigh", [120, 360, 90, 200], [...art(legArteries).map((a) => ({ ...a, fill: "#f3b6b6" })), ...art(legNerves)], 12);
  await debug.components("leg-muscles", muscleRegions, 150);
  await debug.components("leg-tendons", tendonRegions, 80);

  const muscleShapes: Record<string, string> = {};
  for (const [id, s] of Object.entries(MUSCLE_SEEDS)) muscleShapes[id] = await regionPath(muscleRegions, s);
  const tendonShapes: Record<string, string> = {};
  for (const [id, s] of Object.entries(TENDON_SEEDS)) tendonShapes[id] = await regionPath(tendonRegions, s);

  // ─── Nerfs et artères ───
  const nerveSplit = splitTree(await Mask.render(shapesBody(legNerves), LEG_BOX, S), NERVE_ROUTES);
  const arterySplit = splitTree(await Mask.render(shapesBody(legArteries), LEG_BOX, S), ARTERY_ROUTES);
  await debug.split("split-nerves", nerveSplit);
  await debug.split("split-arteries", arterySplit);

  // ─── Écriture ───
  const round = (p: Pt): Pt => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];
  writeTs(
    join(atlasDir, "lower-limb-shapes.ts"),
    `// Généré par scripts/build-body.mts (planche LadyofHats + Servier Medical Art CC BY 4.0, recalé). Ne pas modifier.
// Membre inférieur DROIT, en coordonnées de la planche du squelette entier.`,
    `/** Contour de la peau (de la crête iliaque aux orteils). */
export const LOWER_LIMB_SKIN = ${JSON.stringify(polyPath(legSkin.map(round)))};

/** Muscles découpés dans l'illustration, par structure. */
export const LOWER_LIMB_MUSCLES: Record<string, string> = ${JSON.stringify(muscleShapes)};

/** Tendons, aponévroses et rétinaculums, par structure. */
export const LOWER_LIMB_TENDONS: Record<string, string> = ${JSON.stringify(tendonShapes)};

/** Nerfs, par structure. */
export const LOWER_LIMB_NERVES: Record<string, string> = ${JSON.stringify(nerveSplit.paths)};

/** Artères, par structure. */
export const LOWER_LIMB_ARTERIES: Record<string, string> = ${JSON.stringify(arterySplit.paths)};`,
  );
  const layers = {
    muscles: art(legMuscles),
    vaisseaux: legArteries.map((x) => toArt(x, SCALE, { stroke: "#7a0010", sw: 0.15 })),
    nerfs: legNerves.map((x) => toArt(x, SCALE, { stroke: "#8a6500", sw: 0.12 })),
  };
  writeTs(
    join(atlasDir, "lower-limb-art.ts"),
    `// Généré par scripts/build-body.mts à partir de Servier Medical Art (smart.servier.com, CC BY 4.0), recalé sur la planche
// du squelette. Modifications : sélection du membre inférieur droit, déformation pour suivre les os. Ne pas modifier.

import type { RegionArt } from "../anatomy";`,
    `export const LOWER_LIMB_ART: RegionArt = { layers: ${JSON.stringify(layers)} };`,
  );
  console.log(`Membre inférieur : ${legMuscles.length} formes musculaires, ${Object.keys(muscleShapes).length} muscles découpés.`);
}
