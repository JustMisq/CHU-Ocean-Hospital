import { ellipse, longBone, smooth } from "../geometry";
import { boneShape, dot, inset, skinShape, type Slice, type SliceItem } from "../slices";

/**
 * Coupes axiales du thorax (scanner / IRM), convention radiologique : vues d'en bas, avant en haut,
 * droite du patient à gauche de l'écran. Niveaux (y) dans le repère de la planche du squelette.
 */

type P = [number, number];
const mirror = (pts: P[]): P[] => pts.map(([x, y]) => [-x, y] as P).reverse();
const VIEW: [number, number, number, number] = [-100, -72, 200, 144];

/** Tronc : peau, graisse, muscles de la paroi (pectoraux en avant, muscles du dos en arrière). */
function trunk(rx = 92): SliceItem[] {
  const k = rx / 92;
  const body: P[] = [[-95, -5], [-88, -35], [-60, -55], [-20, -62], [20, -62], [60, -55], [88, -35], [95, -5], [90, 25], [70, 48], [35, 58], [0, 60], [-35, 58], [-70, 48], [-90, 25]].map(([x, y]) => [x * k, y] as P);
  const pec: P[] = [[-76 * k, -38], [-52 * k, -54], [-14, -58], [-12, -52], [-46 * k, -47], [-72 * k, -32]];
  return [
    ...skinShape(body),
    { tissue: "muscle", id: "thorax-pm", d: smooth(pec) },
    { tissue: "muscle", id: "thorax-pm", d: smooth(mirror(pec)) },
    { tissue: "muscle", d: ellipse(-19, 46, 13, 9) },
    { tissue: "muscle", d: ellipse(19, 46, 13, 9) },
  ];
}

/** Vertèbre thoracique : corps, canal et moelle, arc postérieur. */
function vertebra(cy = 24): SliceItem[] {
  return [
    ...boneShape("rachis-dorsal", [[-11, cy - 9], [0, cy - 12], [11, cy - 9], [12, cy + 4], [0, cy + 9], [-12, cy + 4]], 0.7),
    { tissue: "bone", id: "rachis-dorsal", d: longBone([[-9, cy + 12], [-5, cy + 22], [0, cy + 30], [5, cy + 22], [9, cy + 12]], [4, 4, 4, 4, 4]) },
    { tissue: "fluid", d: ellipse(0, cy + 15.5, 5.5, 5) },
    { tissue: "cord", d: ellipse(0, cy + 15.5, 3.4, 3) },
  ];
}

/** Côtes coupées le long de la paroi : arcs antérieurs, latéraux, postérieurs (identifiants selon le niveau). */
function ribs(ids: { ant: number; lat: number; post: number }): SliceItem[] {
  const rib = (n: number, s: "d" | "g", x: number, y: number, rot: number): SliceItem => ({ tissue: "bone", id: `cote${n}-${s}`, d: ellipse(x, y, 5, 2.4, rot) });
  return (["d", "g"] as const).flatMap((s) => {
    const k = s === "d" ? -1 : 1;
    return [
      rib(ids.ant, s, 52 * k, -48, -28 * k), rib(ids.lat, s, 84 * k, -12, 75 * k), rib(ids.lat, s, 85 * k, 12, 95 * k),
      rib(ids.post, s, 68 * k, 36, 140 * k), rib(ids.post, s, 36 * k, 50, 165 * k),
    ];
  });
}

/** Scapulas (hautes coupes). */
const scapulae = (): SliceItem[] => [
  { tissue: "bone", id: "scapula-d", d: longBone([[-84, 24], [-68, 40], [-46, 50]], [5, 4, 3]) },
  { tissue: "bone", id: "scapula-g", d: longBone([[84, 24], [68, 40], [46, 50]], [5, 4, 3]) },
];

/** Trachée (paroi cartilagineuse + air) ou bronche. */
const airway = (id: string, cx: number, cy: number, rx: number, ry: number): SliceItem[] => [
  { tissue: "cartilage", id, d: ellipse(cx, cy, rx, ry) },
  { tissue: "air", id, d: ellipse(cx, cy, rx - 1.6, ry - 1.6) },
];

const RIGHT_LUNG: P[] = [[-84, 8], [-82, -18], [-72, -38], [-48, -50], [-24, -46], [-17, -28], [-20, -10], [-16, 8], [-22, 26], [-46, 38], [-70, 32]];

export const THORAX_SLICES: Slice[] = [
  {
    id: "s-thorax-apex",
    label: "Apex — troncs supra-aortiques (T2)",
    y: 200,
    view: VIEW,
    items: [
      ...trunk(86),
      { tissue: "lung", id: "lsd", d: smooth([[-70, -5], [-62, -26], [-42, -36], [-24, -30], [-19, -12], [-23, 6], [-40, 16], [-60, 12]]) },
      { tissue: "lung", id: "lsg", d: smooth(mirror([[-70, -5], [-62, -26], [-42, -36], [-24, -30], [-19, -12], [-23, 6], [-40, 16], [-60, 12]])) },
      ...airway("trachee", 0, -8, 9, 8),
      { tissue: "bowel", id: "oesophage", d: ellipse(3, 5, 5, 3.6) },
      dot("artery", "troncs-supra-aortiques", -10, -24, 4.2),
      dot("artery", "troncs-supra-aortiques", 8, -25, 3),
      dot("artery", "troncs-supra-aortiques", 16, -15, 3.4),
      dot("vein", "troncs-veineux", -19, -31, 4.2),
      { tissue: "vein", id: "troncs-veineux", d: ellipse(6, -36, 12, 3.4, -8) },
      ...boneShape("manubrium", [[-12, -48], [0, -51], [12, -48], [10, -43], [-10, -43]], 0.55),
      { tissue: "bone", id: "clavicule-d", d: ellipse(-36, -48, 11, 4, 12) },
      { tissue: "bone", id: "clavicule-g", d: ellipse(36, -48, 11, 4, -12) },
      { tissue: "bone", id: "cote1-d", d: longBone([[-24, -32], [-38, -30], [-50, -22]], [3.5, 3.5, 3]) },
      { tissue: "bone", id: "cote1-g", d: longBone([[24, -32], [38, -30], [50, -22]], [3.5, 3.5, 3]) },
      ...ribs({ ant: 2, lat: 2, post: 3 }),
      ...scapulae(),
      ...vertebra(24),
    ],
  },
  {
    id: "s-thorax-crosse",
    label: "Crosse de l'aorte (T4)",
    y: 218,
    view: VIEW,
    items: [
      ...trunk(),
      { tissue: "lung", id: "lsd", d: smooth(RIGHT_LUNG) },
      { tissue: "lung", id: "lsg", d: smooth(mirror(RIGHT_LUNG)) },
      { tissue: "fat", d: smooth([[-14, -38], [14, -38], [20, -10], [14, 14], [-14, 14], [-20, -10]]) },
      { tissue: "artery", id: "aorte", d: longBone([[-9, -27], [3, -25], [13, -15], [17, 0], [15, 13]], [10, 10, 10, 10, 9]) },
      dot("vein", "vcs", -16, -18, 5),
      ...airway("trachee", -1, -5, 8.5, 8),
      { tissue: "bowel", id: "oesophage", d: ellipse(3, 9, 5, 3.6) },
      ...boneShape("manubrium", [[-12, -55], [0, -58], [12, -55], [10, -49], [-10, -49]], 0.55),
      ...ribs({ ant: 2, lat: 4, post: 5 }),
      ...scapulae(),
      ...vertebra(26),
    ],
  },
  {
    id: "s-thorax-carene",
    label: "Carène — artères pulmonaires (T5-T6)",
    y: 240,
    view: VIEW,
    items: [
      ...trunk(),
      // Grande scissure : lobe supérieur en avant, lobe inférieur en arrière.
      { tissue: "lung", id: "lsd", d: smooth([[-84, -6], [-74, -36], [-48, -50], [-24, -46], [-17, -28], [-22, -12], [-46, -16], [-70, -6]]) },
      { tissue: "lung", id: "lid", d: smooth([[-84, -2], [-68, -2], [-44, -10], [-20, -8], [-16, 8], [-22, 26], [-46, 38], [-70, 32], [-84, 12]]) },
      { tissue: "lung", id: "lsg", d: smooth(mirror([[-84, -6], [-74, -36], [-48, -50], [-24, -46], [-17, -28], [-22, -12], [-46, -16], [-70, -6]])) },
      { tissue: "lung", id: "lig", d: smooth(mirror([[-84, -2], [-68, -2], [-44, -10], [-20, -8], [-16, 8], [-22, 26], [-46, 38], [-70, 32], [-84, 12]])) },
      { tissue: "fat", d: smooth([[-16, -40], [16, -40], [24, -14], [20, 18], [-16, 18], [-22, -14]]) },
      dot("artery", "aorte", -6, -24, 8),
      dot("artery", "aorte", 16, 15, 7),
      dot("artery", "arteres-pulmonaires", 9, -27, 7.5),
      { tissue: "artery", id: "arteres-pulmonaires", d: longBone([[2, -16], [-10, -13], [-24, -10]], [6, 6, 5]) },
      { tissue: "artery", id: "arteres-pulmonaires", d: longBone([[14, -22], [22, -16], [28, -10]], [6, 5.5, 5]) },
      dot("vein", "vcs", -19, -22, 5),
      ...airway("trachee", -13, -1, 5.5, 4.6),
      ...airway("trachee", 10, 1, 5.5, 4.6),
      { tissue: "bowel", id: "oesophage", d: ellipse(4, 9, 5, 3.6) },
      ...boneShape("sternum-corps-part", [[-11, -56], [0, -59], [11, -56], [9, -51], [-9, -51]], 0.55),
      ...ribs({ ant: 3, lat: 5, post: 6 }),
      ...scapulae(),
      ...vertebra(26),
    ],
  },
  {
    id: "s-thorax-coeur",
    label: "Cœur — quatre cavités (T8)",
    y: 272,
    view: VIEW,
    items: [
      ...trunk(),
      { tissue: "lung", id: "lmd", d: smooth([[-84, -8], [-76, -34], [-52, -48], [-28, -46], [-24, -30], [-36, -16], [-58, -10], [-78, -2]]) },
      { tissue: "lung", id: "lid", d: smooth([[-86, 0], [-70, -6], [-46, -12], [-28, -12], [-22, 6], [-26, 26], [-48, 38], [-72, 32], [-86, 14]]) },
      { tissue: "lung", id: "lsg", d: smooth([[62, -46], [78, -32], [86, -12], [74, -6], [60, -22], [50, -40]]) },
      { tissue: "lung", id: "lig", d: smooth([[86, -4], [86, 14], [72, 32], [48, 38], [30, 30], [40, 18], [58, 10], [72, -2]]) },
      { tissue: "fat", id: "pericarde", d: smooth(inset([[-22, -30], [10, -44], [42, -38], [58, -16], [52, 10], [32, 22], [6, 22], [-20, 10], [-28, -10]], 1.05)) },
      { tissue: "heart", id: "coeur", d: smooth([[-22, -30], [10, -44], [42, -38], [58, -16], [52, 10], [32, 22], [6, 22], [-20, 10], [-28, -10]]) },
      { tissue: "blood", id: "coeur", d: ellipse(4, -30, 18, 8, -8) },
      { tissue: "blood", id: "coeur", d: ellipse(34, -10, 13, 13) },
      { tissue: "blood", id: "coeur", d: ellipse(-14, -4, 8.5, 10) },
      { tissue: "blood", id: "coeur", d: ellipse(15, 12, 12, 6.5) },
      dot("artery", "aorte", 16, 27, 7),
      { tissue: "bowel", id: "oesophage", d: ellipse(4, 23, 4.5, 3.4) },
      ...boneShape("sternum-corps-part", [[-11, -56], [0, -59], [11, -56], [9, -51], [-9, -51]], 0.55),
      { tissue: "cartilage", id: "cartilages-costaux", d: ellipse(-26, -53, 7, 2.6, -15) },
      { tissue: "cartilage", id: "cartilages-costaux", d: ellipse(26, -53, 7, 2.6, 15) },
      ...ribs({ ant: 5, lat: 7, post: 8 }),
      ...vertebra(30),
    ],
  },
  {
    id: "s-thorax-bases",
    label: "Bases pulmonaires — coupoles (T10)",
    y: 308,
    view: VIEW,
    items: [
      ...trunk(),
      { tissue: "liver", d: smooth([[-82, -12], [-72, -40], [-36, -52], [-4, -48], [6, -30], [0, -6], [-20, 14], [-50, 24], [-76, 14]]) },
      { tissue: "bowel", d: smooth([[18, -40], [48, -46], [70, -26], [66, -2], [42, 4], [20, -14]]) },
      { tissue: "air", d: ellipse(46, -36, 10, 5) },
      { tissue: "lung", id: "lid", d: smooth([[-86, 2], [-80, 22], [-60, 38], [-34, 42], [-28, 32], [-50, 28], [-74, 16]]) },
      { tissue: "lung", id: "lig", d: smooth([[86, 2], [80, 22], [60, 38], [34, 42], [28, 32], [50, 28], [74, 16]]) },
      { tissue: "muscle", id: "diaphragme", d: longBone([[-84, 6], [-64, 24], [-38, 32], [-22, 26]], [2.6, 2.6, 2.6, 2.6]) },
      { tissue: "muscle", id: "diaphragme", d: longBone([[84, 6], [64, 24], [38, 32], [22, 24]], [2.6, 2.6, 2.6, 2.6]) },
      dot("artery", "aorte", 11, 24, 7),
      dot("vein", "vci", -18, 4, 6),
      { tissue: "bowel", id: "oesophage", d: ellipse(6, 10, 4.5, 3.4) },
      ...ribs({ ant: 7, lat: 9, post: 10 }),
      ...vertebra(30),
    ],
  },
];
