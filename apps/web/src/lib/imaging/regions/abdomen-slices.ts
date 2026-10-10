import { ellipse, longBone, smooth } from "../geometry";
import { boneShape, dot, skinShape, type Slice, type SliceItem } from "../slices";

/**
 * Coupes axiales de l'abdomen et du bassin (scanner / IRM), convention radiologique : vues d'en bas, avant en haut,
 * droite du patient à gauche de l'écran. Niveaux (y) dans le repère de la planche du squelette.
 */

type P = [number, number];
const mirror = (pts: P[]): P[] => pts.map(([x, y]) => [-x, y] as P).reverse();
const VIEW: [number, number, number, number] = [-100, -72, 200, 144];

/** Tronc : peau, graisse, muscles droits en avant, muscles paravertébraux en arrière, muscles larges sur les flancs. */
function trunk(rx = 90, ry = 58): SliceItem[] {
  const kx = rx / 90, ky = ry / 58;
  const body: P[] = ([[-90, -4], [-84, -32], [-58, -52], [-20, -58], [20, -58], [58, -52], [84, -32], [90, -4], [86, 24], [64, 46], [30, 56], [0, 58], [-30, 56], [-64, 46], [-86, 24]] as P[]).map(([x, y]) => [x * kx, y * ky]);
  const flank: P[] = [[-82 * kx, -28 * ky], [-60 * kx, -46 * ky], [-56 * kx, -42 * ky], [-76 * kx, -24 * ky], [-82 * kx, 10 * ky], [-80 * kx, 22 * ky], [-86 * kx, 4 * ky]];
  return [
    ...skinShape(body),
    { tissue: "muscle", id: "abdomen-pm", d: ellipse(-10, -53 * ky, 9, 3.5, 6) },
    { tissue: "muscle", id: "abdomen-pm", d: ellipse(10, -53 * ky, 9, 3.5, -6) },
    { tissue: "muscle", id: "abdomen-pm", d: smooth(flank) },
    { tissue: "muscle", id: "abdomen-pm", d: smooth(mirror(flank)) },
    { tissue: "muscle", d: ellipse(-18, 44 * ky, 13, 9) },
    { tissue: "muscle", d: ellipse(18, 44 * ky, 13, 9) },
  ];
}

/** Vertèbre lombaire : corps, canal (liquide et queue de cheval), arc postérieur. */
function vertebra(id: string, cy = 26, w = 1): SliceItem[] {
  return [
    ...boneShape(id, [[-13 * w, cy - 9], [0, cy - 12], [13 * w, cy - 9], [14 * w, cy + 4], [0, cy + 8], [-14 * w, cy + 4]], 0.72),
    { tissue: "bone", id, d: longBone([[-10, cy + 12], [-6, cy + 22], [0, cy + 29], [6, cy + 22], [10, cy + 12]], [4, 4, 4, 4, 4]) },
    { tissue: "bone", id, d: longBone([[-14, cy + 8], [-26, cy + 6]], [3.5, 2.5]) },
    { tissue: "bone", id, d: longBone([[14, cy + 8], [26, cy + 6]], [3.5, 2.5]) },
    { tissue: "fluid", d: ellipse(0, cy + 15, 6, 5) },
  ];
}

/** Anse digestive : paroi, contenu liquide, éventuellement de l'air (en haut, la coupe étant faite couché sur le dos). */
function loop(id: string, cx: number, cy: number, rx: number, ry: number, air = 0.35): SliceItem[] {
  const items: SliceItem[] = [{ tissue: "bowel", id, d: ellipse(cx, cy, rx, ry) }, { tissue: "fluid", id, d: ellipse(cx, cy, rx * 0.7, ry * 0.7) }];
  if (air > 0) items.push({ tissue: "air", id, d: ellipse(cx, cy - ry * 0.3, rx * 0.62, ry * air) });
  return items;
}

export const ABDOMEN_SLICES: Slice[] = [
  {
    id: "s-abdo-foie",
    label: "Foie, estomac, rate (T12-L1)",
    y: 322,
    view: VIEW,
    items: [
      ...trunk(),
      { tissue: "liver", id: "foie", d: smooth([[-84, -8], [-76, -36], [-48, -50], [-14, -48], [6, -38], [2, -20], [-12, -6], [-14, 14], [-30, 30], [-56, 38], [-76, 26]]) },
      { tissue: "bowel", id: "estomac", d: smooth([[6, -42], [32, -50], [56, -40], [62, -20], [48, -4], [24, -6], [10, -18]]) },
      { tissue: "fluid", id: "estomac", d: smooth([[14, -34], [34, -42], [52, -32], [54, -18], [42, -10], [22, -14]]) },
      { tissue: "air", id: "estomac", d: ellipse(34, -40, 15, 5, -8) },
      { tissue: "spleen", id: "rate", d: smooth([[58, -6], [74, -22], [84, -6], [80, 22], [64, 32], [54, 20], [62, 8]]) },
      { tissue: "kidney", id: "rein-g", d: ellipse(40, 26, 9, 7, 30) },
      { tissue: "muscle", id: "abdomen-pm", d: ellipse(-14, 18, 6, 9, 20) },
      { tissue: "muscle", id: "abdomen-pm", d: ellipse(16, 16, 6, 9, -20) },
      dot("artery", "aorte-abdominale", 4, 10, 6.5),
      dot("vein", "veine-cave-inf", -16, 2, 6),
      ...vertebra("L1"),
    ],
  },
  {
    id: "s-abdo-pancreas",
    label: "Pancréas et hiles rénaux (L1-L2)",
    y: 342,
    view: VIEW,
    items: [
      ...trunk(),
      { tissue: "liver", id: "foie", d: smooth([[-84, -6], [-74, -30], [-50, -42], [-30, -38], [-38, -18], [-56, 0], [-70, 14], [-82, 10]]) },
      { tissue: "fluid", id: "vesicule", d: ellipse(-38, -30, 8, 6, 20) },
      ...loop("duodenum", -26, -8, 7, 6, 0.3),
      { tissue: "pancreas", id: "pancreas", d: smooth([[-20, -4], [-10, -16], [10, -12], [32, -4], [52, 2], [56, 10], [36, 8], [12, 2], [-6, 6], [-16, 6]]) },
      { tissue: "bowel", id: "estomac", d: smooth([[-20, -42], [10, -48], [40, -44], [52, -30], [36, -22], [6, -26], [-16, -30]]) },
      { tissue: "air", id: "estomac", d: ellipse(14, -42, 22, 4.5) },
      ...loop("colon-transverse", -58, -32, 10, 8, 0.45),
      ...loop("colon-descendant", 64, -22, 9, 8, 0.45),
      { tissue: "kidney", id: "rein-d", d: smooth([[-52, 14], [-42, 2], [-30, 10], [-30, 24], [-40, 36], [-54, 32]]) },
      { tissue: "kidney", id: "rein-g", d: smooth(mirror([[-52, 12], [-42, 0], [-30, 8], [-30, 22], [-40, 34], [-54, 30]])) },
      { tissue: "fat", d: ellipse(-33, 18, 3, 4) },
      { tissue: "fat", d: ellipse(33, 16, 3, 4) },
      { tissue: "muscle", id: "psoas-d", d: ellipse(-20, 22, 5, 6) },
      { tissue: "muscle", id: "psoas-g", d: ellipse(20, 22, 5, 6) },
      dot("artery", "aorte-abdominale", 4, 10, 6.2),
      dot("artery", "aorte-abdominale", 4, -2, 2.6),
      dot("vein", "veine-porte", -6, -8, 4),
      dot("vein", "veine-cave-inf", -14, 6, 6),
      ...vertebra("L2"),
    ],
  },
  {
    id: "s-abdo-reins",
    label: "Pôles inférieurs des reins (L3)",
    y: 362,
    view: VIEW,
    items: [
      ...trunk(),
      ...loop("colon-transverse", -14, -42, 18, 9, 0.45),
      ...loop("colon-transverse", 22, -42, 14, 8, 0.45),
      ...loop("colon-ascendant", -64, -10, 11, 11, 0.45),
      ...loop("colon-descendant", 66, -4, 9, 9, 0.45),
      ...[[-30, -18], [-10, -20], [12, -22], [34, -18], [-22, -2], [0, -4], [24, -4], [44, -2]].flatMap(([x, y]) => loop("grele", x, y, 8, 6, 0)),
      { tissue: "kidney", id: "rein-d", d: ellipse(-44, 26, 9, 10, -20) },
      { tissue: "kidney", id: "rein-g", d: ellipse(44, 26, 9, 10, 20) },
      { tissue: "muscle", id: "psoas-d", d: ellipse(-22, 22, 7, 8) },
      { tissue: "muscle", id: "psoas-g", d: ellipse(22, 22, 7, 8) },
      dot("fluid", "ureteres", -30, 18, 1.4),
      dot("fluid", "ureteres", 30, 18, 1.4),
      dot("artery", "aorte-abdominale", 4, 10, 5.8),
      dot("vein", "veine-cave-inf", -12, 9, 5.5),
      ...vertebra("L3"),
    ],
  },
  {
    id: "s-bassin-ailes",
    label: "Ailes iliaques (S1)",
    y: 404,
    view: VIEW,
    items: [
      ...trunk(92, 54),
      { tissue: "muscle", d: smooth([[-80, -8], [-66, -26], [-50, -24], [-44, 0], [-50, 18], [-68, 18]]) },
      { tissue: "muscle", d: smooth(mirror([[-80, -8], [-66, -26], [-50, -24], [-44, 0], [-50, 18], [-68, 18]])) },
      ...boneShape("aile-iliaque-d", [[-84, -14], [-72, -18], [-60, -2], [-48, 18], [-30, 30], [-36, 36], [-56, 30], [-76, 14]], 0.72),
      ...boneShape("aile-iliaque-g", mirror([[-84, -14], [-72, -18], [-60, -2], [-48, 18], [-30, 30], [-36, 36], [-56, 30], [-76, 14]]), 0.72),
      ...boneShape("sacrum", [[-26, 22], [0, 16], [26, 22], [24, 36], [0, 42], [-24, 36]], 0.7),
      { tissue: "joint", id: "sacro-iliaque-d", d: longBone([[-28, 24], [-32, 34]], [2.4, 2.4]) },
      { tissue: "joint", id: "sacro-iliaque-g", d: longBone([[28, 24], [32, 34]], [2.4, 2.4]) },
      { tissue: "muscle", id: "psoas-d", d: ellipse(-36, 4, 8, 9) },
      { tissue: "muscle", id: "psoas-g", d: ellipse(36, 4, 8, 9) },
      ...loop("caecum", -52, -30, 13, 11, 0.45),
      ...loop("sigmoide", 48, -26, 11, 9, 0.45),
      ...[[-20, -36], [0, -38], [20, -34], [-14, -18], [8, -18], [26, -12]].flatMap(([x, y]) => loop("grele", x, y, 8, 6, 0)),
      dot("artery", "vaisseaux-iliaques", -20, 6, 3.6),
      dot("artery", "vaisseaux-iliaques", 20, 6, 3.6),
      dot("vein", "vaisseaux-iliaques", -16, 14, 4),
      dot("vein", "vaisseaux-iliaques", 16, 14, 4),
      dot("fluid", "ureteres", -26, 0, 1.4),
      dot("fluid", "ureteres", 26, 0, 1.4),
    ],
  },
  {
    id: "s-bassin-cotyles",
    label: "Cotyles et vessie",
    y: 444,
    view: VIEW,
    items: [
      ...trunk(92, 50),
      { tissue: "muscle", d: smooth([[-86, 0], [-76, -22], [-66, -16], [-64, 10], [-74, 30], [-86, 20]]) },
      { tissue: "muscle", d: smooth(mirror([[-86, 0], [-76, -22], [-66, -16], [-64, 10], [-74, 30], [-86, 20]])) },
      { tissue: "muscle", d: ellipse(-40, 34, 16, 9, 20) },
      { tissue: "muscle", d: ellipse(40, 34, 16, 9, -20) },
      ...boneShape(undefined, [[-62, -12], [-50, -14], [-46, 0], [-50, 12], [-62, 10], [-66, 0]], 0.75),
      ...boneShape(undefined, mirror([[-62, -12], [-50, -14], [-46, 0], [-50, 12], [-62, 10], [-66, 0]]), 0.75),
      { tissue: "joint", id: "cotyle-d", d: smooth([[-46, -12], [-42, 0], [-46, 12], [-44, 0]]) },
      { tissue: "joint", id: "cotyle-g", d: smooth(mirror([[-46, -12], [-42, 0], [-46, 12], [-44, 0]])) },
      ...boneShape("cotyle-d", [[-44, -16], [-34, -10], [-30, 4], [-34, 18], [-42, 16], [-40, 0]], 0.6),
      ...boneShape("cotyle-g", mirror([[-44, -16], [-34, -10], [-30, 4], [-34, 18], [-42, 16], [-40, 0]]), 0.6),
      { tissue: "muscle", d: ellipse(-24, 2, 5, 13) },
      { tissue: "muscle", d: ellipse(24, 2, 5, 13) },
      { tissue: "bowel", id: "vessie", d: smooth([[-18, -30], [0, -36], [18, -30], [20, -12], [0, -4], [-20, -12]]) },
      { tissue: "fluid", id: "vessie", d: smooth([[-16, -28], [0, -33], [16, -28], [17, -13], [0, -7], [-17, -13]]) },
      ...loop("rectum", 0, 14, 9, 7, 0.4),
      ...boneShape("coccyx", [[-5, 30], [0, 28], [5, 30], [3, 36], [-3, 36]], 0.5),
      dot("artery", "vaisseaux-iliaques", -34, -26, 3),
      dot("vein", "vaisseaux-iliaques", -27, -24, 3.6),
      dot("artery", "vaisseaux-iliaques", 34, -26, 3),
      dot("vein", "vaisseaux-iliaques", 27, -24, 3.6),
    ],
  },
];
