import { clipBand, ellipse, longBone, polygon, smooth, type Pt } from "../geometry";
import { type Slice, type SliceItem } from "../slices";

/**
 * Coupes axiales de la tête (scanner / IRM cérébral), convention radiologique : vues d'en bas, avant en haut,
 * droite du patient à gauche de l'écran. Niveaux (y) dans le repère du profil de la tête ; rangées de la base au vertex.
 * Chaque hémisphère est découpé en lobes (substance grise en surface, substance blanche dessous) : les lésions
 * se placent du bon côté et dans le bon lobe.
 */

const VIEW: [number, number, number, number] = [-70, -82, 140, 164];

/** Points d'une ellipse (angle 0 = côté gauche du patient, à droite de l'écran ; −90° = avant). */
function arc(rx: number, ry: number, a0: number, a1: number, n = 18): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    pts.push([rx * Math.cos(t), ry * Math.sin(t)]);
  }
  return pts;
}

/** Segment d'anneau osseux (voûte) entre deux angles. */
const ring = (id: string, rxo: number, ryo: number, a0: number, a1: number, thick = 4.5): SliceItem => ({
  tissue: "bone", id, d: polygon([...arc(rxo, ryo, a0, a1), ...arc(rxo - thick, ryo - thick, a0, a1).reverse()]),
});

/** Demi-ellipse d'un hémisphère (côté d = droite du patient, à gauche de l'écran). */
function half(rx: number, ry: number, side: "d" | "g", cx = 1.5): Pt[] {
  return side === "d" ? arc(rx, ry, 90, 270, 36).map(([x, y]) => [x - cx, y] as Pt) : arc(rx, ry, -90, 90, 36).map(([x, y]) => [x + cx, y] as Pt);
}

/** Lobes d'un niveau : bandes d'avant en arrière ; substance grise (cortex) puis substance blanche. */
function hemispheres(rx: number, ry: number, bands: [id: string, y0: number, y1: number][], cortex = 6): SliceItem[] {
  const items: SliceItem[] = [];
  for (const side of ["d", "g"] as const) {
    const outer = half(rx, ry, side), inner = half(rx - cortex, ry - cortex, side);
    for (const [id, y0, y1] of bands) {
      items.push({ tissue: "gm", id, d: polygon(clipBand(outer, y0, y1)) });
      items.push({ tissue: "wm", id, d: polygon(clipBand(inner, y0 + (y0 > -ry + 2 ? 0 : cortex), y1 - (y1 < ry - 2 ? 0 : cortex))) });
    }
  }
  return items;
}

/** Peau, graisse du cuir chevelu, voûte (os découpés par secteurs). */
function scalp(rx: number, ry: number, bones: [id: string, a0: number, a1: number][]): SliceItem[] {
  return [
    { tissue: "skin", id: "tete-pm", d: ellipse(0, 0, rx + 6, ry + 6) },
    { tissue: "fat", id: "tete-pm", d: ellipse(0, 0, rx + 4.5, ry + 4.5) },
    { tissue: "fluid", d: ellipse(0, 0, rx - 3.6, ry - 3.6) },
    ...bones.map(([id, a0, a1]) => ring(id, rx, ry, a0, a1)),
  ];
}

/** Faux du cerveau (ligne médiane) et scissure interhémisphérique. */
const falx = (y0: number, y1: number): SliceItem => ({ tissue: "ligament", d: longBone([[0, y0], [0, y1]], [1, 1]) });

/** Secteurs de la voûte : frontal en avant, pariétaux (ou temporaux) sur les côtés, occipital en arrière. */
const VAULT = (sides: string): [string, number, number][] => [
  ["os-frontal", -135, -45], [sides, 135, 225], [sides, -45, 45], ["os-occipital", 45, 135],
];

const SLICES: Slice[] = [
  {
    id: "s-tete-fosse-post",
    label: "Fosse postérieure — cervelet, rochers",
    y: 335,
    view: VIEW,
    items: [
      ...scalp(46, 60, [["os-frontal", -135, -45], ["os-temporal", 135, 225], ["os-temporal", -45, 45], ["os-occipital", 45, 135]]),
      { tissue: "fat", id: "orbite", d: ellipse(-17, -46, 10, 9) },
      { tissue: "fat", id: "orbite", d: ellipse(17, -46, 10, 9) },
      { tissue: "fluid", id: "orbite", d: ellipse(-17, -47, 6, 6) },
      { tissue: "fluid", id: "orbite", d: ellipse(17, -47, 6, 6) },
      { tissue: "air", id: "sphenoide", d: ellipse(0, -30, 7, 6) },
      ...hemispheres(40, 54, [["lobe-temporal", -32, 6]], 5),
      { tissue: "bone", id: "os-temporal", d: longBone([[-34, 8], [-20, 16], [-9, 18]], [8, 7, 4]) },
      { tissue: "bone", id: "os-temporal", d: longBone([[34, 8], [20, 16], [9, 18]], [8, 7, 4]) },
      { tissue: "air", id: "os-temporal", d: ellipse(-32, 12, 3, 2.5) },
      { tissue: "air", id: "os-temporal", d: ellipse(32, 12, 3, 2.5) },
      { tissue: "gm", id: "tronc-cerebral", d: ellipse(0, 10, 9, 8) },
      { tissue: "fluid", id: "ventricules", d: smooth([[-4, 21], [0, 18], [4, 21], [0, 25]]) },
      { tissue: "gm", id: "cervelet", d: smooth([[-2, 26], [-14, 22], [-32, 28], [-36, 42], [-22, 52], [-4, 46]]) },
      { tissue: "gm", id: "cervelet", d: smooth([[2, 26], [14, 22], [32, 28], [36, 42], [22, 52], [4, 46]]) },
      { tissue: "wm", id: "cervelet", d: ellipse(-18, 36, 8, 6, 20) },
      { tissue: "wm", id: "cervelet", d: ellipse(18, 36, 8, 6, -20) },
    ],
  },
  {
    id: "s-tete-mesencephale",
    label: "Mésencéphale — citernes de la base",
    y: 305,
    view: VIEW,
    items: [
      ...scalp(48, 62, VAULT("os-temporal")),
      ...hemispheres(43, 57, [["lobe-frontal", -57, -18], ["lobe-temporal", -18, 18], ["lobe-occipital", 18, 57]]),
      { tissue: "fluid", d: smooth([[-14, -8], [0, -14], [14, -8], [16, 8], [0, 18], [-16, 8]]) },
      { tissue: "gm", id: "tronc-cerebral", d: smooth([[-9, -4], [0, -8], [9, -4], [10, 6], [0, 12], [-10, 6]]) },
      { tissue: "fluid", d: longBone([[-38, -16], [-24, -12], [-14, -10]], [2, 2, 2]) },
      { tissue: "fluid", d: longBone([[38, -16], [24, -12], [14, -10]], [2, 2, 2]) },
      falx(-57, -18),
      falx(24, 57),
    ],
  },
  {
    id: "s-tete-noyaux",
    label: "Noyaux gris centraux — 3e ventricule",
    y: 268,
    view: VIEW,
    items: [
      ...scalp(50, 64, VAULT("os-parietal")),
      ...hemispheres(45, 59, [["lobe-frontal", -59, -14], ["lobe-temporal", -14, 22], ["lobe-occipital", 22, 59]]),
      { tissue: "gm", id: "noyaux-gris", d: smooth([[-6, -16], [-18, -12], [-22, 4], [-16, 16], [-6, 10]]) },
      { tissue: "gm", id: "noyaux-gris", d: smooth([[6, -16], [18, -12], [22, 4], [16, 16], [6, 10]]) },
      { tissue: "fluid", id: "ventricules", d: smooth([[-2, -26], [-9, -22], [-7, -14], [-2, -12]]) },
      { tissue: "fluid", id: "ventricules", d: smooth([[2, -26], [9, -22], [7, -14], [2, -12]]) },
      { tissue: "fluid", id: "ventricules", d: longBone([[0, -8], [0, 8]], [2.4, 2.4]) },
      { tissue: "fluid", id: "ventricules", d: longBone([[-8, 22], [-14, 32]], [4, 3]) },
      { tissue: "fluid", id: "ventricules", d: longBone([[8, 22], [14, 32]], [4, 3]) },
      { tissue: "fluid", d: longBone([[-42, -12], [-28, -8], [-22, -6]], [2, 2, 1.5]) },
      { tissue: "fluid", d: longBone([[42, -12], [28, -8], [22, -6]], [2, 2, 1.5]) },
      falx(-59, -28),
      falx(36, 59),
    ],
  },
  {
    id: "s-tete-ventricules",
    label: "Corps des ventricules latéraux",
    y: 242,
    view: VIEW,
    items: [
      ...scalp(50, 64, VAULT("os-parietal")),
      ...hemispheres(45, 59, [["lobe-frontal", -59, -10], ["lobe-parietal", -10, 30], ["lobe-occipital", 30, 59]]),
      { tissue: "fluid", id: "ventricules", d: smooth([[-3, -24], [-10, -20], [-12, 0], [-14, 18], [-8, 22], [-4, 4]]) },
      { tissue: "fluid", id: "ventricules", d: smooth([[3, -24], [10, -20], [12, 0], [14, 18], [8, 22], [4, 4]]) },
      falx(-59, -26),
      falx(26, 59),
    ],
  },
  {
    id: "s-tete-semi-ovales",
    label: "Centres semi-ovales",
    y: 212,
    view: VIEW,
    items: [
      ...scalp(48, 62, [["os-frontal", -135, -45], ["os-parietal", 135, 225], ["os-parietal", -45, 45], ["os-parietal", 45, 135]]),
      ...hemispheres(43, 57, [["lobe-frontal", -57, -2], ["lobe-parietal", -2, 57]], 7),
      falx(-57, 57),
    ],
  },
  {
    id: "s-tete-vertex",
    label: "Vertex",
    y: 182,
    view: VIEW,
    items: [
      ...scalp(40, 52, [["os-frontal", -135, -45], ["os-parietal", 135, 225], ["os-parietal", -45, 45], ["os-parietal", 45, 135]]),
      ...hemispheres(35, 47, [["lobe-frontal", -47, -6], ["lobe-parietal", -6, 47]], 7),
      falx(-47, 47),
    ],
  },
];

export const HEAD_SLICES = SLICES;
