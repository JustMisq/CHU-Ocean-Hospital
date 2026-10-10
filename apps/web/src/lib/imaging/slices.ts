import { ellipse, smooth } from "./geometry";

/**
 * Coupes axiales (scanner / IRM) : chaque région fournit les siennes, dessinées dans un repère centré
 * (environ −80…80 × −62…62), vues d'en bas comme en imagerie. Chaque tissu peut renvoyer à une structure de la carte.
 */

export type Tissue =
  | "skin" | "fat" | "muscle" | "tendon" | "ligament" | "nerve" | "artery" | "vein" | "bone" | "marrow" | "cartilage" | "joint"
  /** Air (digestif, voies aériennes), parenchyme pulmonaire, liquide (bile, urine, LCS…). */
  | "air" | "lung" | "fluid"
  | "liver" | "spleen" | "kidney" | "pancreas" | "bowel" | "heart" | "blood"
  /** Substance grise / blanche, moelle épinière, disque intervertébral. */
  | "gm" | "wm" | "cord" | "disc";

export type SliceItem = { tissue: Tissue; d: string; id?: string };
export type Slice = {
  id: string;
  label: string;
  /** Niveau sur la carte (axe y du repère de la région). */
  y: number;
  items: SliceItem[];
  /** Cadre de la coupe (par défaut −80 −62 160 124). */
  view?: [number, number, number, number];
};

/** Os en coupe : corticale (anneau) + moelle. */
export const boneSection = (id: string, cx: number, cy: number, rx: number, ry: number, rot = 0, cortex = 3): SliceItem[] => [
  { tissue: "bone", d: ellipse(cx, cy, rx, ry, rot), id },
  { tissue: "marrow", d: ellipse(cx, cy, Math.max(1, rx - cortex), Math.max(1, ry - cortex), rot), id },
];
export const dot = (tissue: Tissue, id: string | undefined, cx: number, cy: number, r = 3.5): SliceItem => ({ tissue, d: ellipse(cx, cy, r, r), id });
/** Peau et graisse sous-cutanée d'un membre (ellipse). */
export const limbSection = (rx: number, ry: number, cx = 0): SliceItem[] => [
  { tissue: "skin", d: ellipse(cx, 0, rx, ry) },
  { tissue: "fat", d: ellipse(cx, 0, rx - 1.6, ry - 1.6) },
];

type P = [number, number];
/** Points rapprochés de leur centre (facteur k) : contour intérieur d'une corticale, graisse sous la peau… */
export function inset(pts: P[], k: number): P[] {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return pts.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
}
/** Os de forme libre en coupe : corticale + moelle (contour rapproché du centre). */
export const boneShape = (id: string | undefined, pts: P[], k = 0.72): SliceItem[] => [
  { tissue: "bone", d: smooth(pts), id },
  { tissue: "marrow", d: smooth(inset(pts, k)), id },
];
/** Peau et graisse sous-cutanée d'un contour libre. */
export const skinShape = (pts: P[], k = 0.965): SliceItem[] => [
  { tissue: "skin", d: smooth(pts) },
  { tissue: "fat", d: smooth(inset(pts, k)) },
];

/** Coupes comprises dans une zone [y0, y1] de la carte (à défaut : la plus proche). */
export function slicesIn(slices: Slice[], y0: number, y1: number, margin = 10): Slice[] {
  if (!slices.length) return [];
  const inside = slices.filter((s) => s.y >= y0 - margin && s.y <= y1 + margin);
  if (inside.length) return inside;
  const mid = (y0 + y1) / 2;
  return [slices.reduce((best, s) => (Math.abs(s.y - mid) < Math.abs(best.y - mid) ? s : best))];
}
