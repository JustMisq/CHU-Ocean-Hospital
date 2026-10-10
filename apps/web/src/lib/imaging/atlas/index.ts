import type { Box, Pt } from "../geometry";
import { ART_BONES } from "./skeleton-arm";

/**
 * Recalage des os dessinés (planche LadyofHats, bras GAUCHE) dans le repère du modèle (membre DROIT, voir upper-limb.ts).
 * Une transformation par segment, ancrée sur deux repères anatomiques ; elle inclut une symétrie car, sur la planche,
 * le côté médial du bras gauche est vers la gauche (x décroissant) alors que dans le modèle il est vers la droite.
 */

/** Repères anatomiques : centre de la tête humérale, du coude, du poignet, bout du majeur. */
const ART = { head: [297.5, 212] as Pt, elbow: [328.5, 352] as Pt, wrist: [367, 460] as Pt, tip: [396, 543.5] as Pt };
const MODEL = { head: [54, 94] as Pt, elbow: [43, 452] as Pt, wrist: [44, 718] as Pt, tip: [43, 999] as Pt };

export type Matrix = [a: number, b: number, c: number, d: number, e: number, f: number];

/**
 * Similitude « avec symétrie » envoyant a1 → m1 et a2 → m2 :
 * z' = k · conj(z) + t, avec k = (m2 − m1) / conj(a2 − a1).
 */
function reflectedSimilarity(a1: Pt, a2: Pt, m1: Pt, m2: Pt): Matrix {
  const [ux, uy] = [a2[0] - a1[0], -(a2[1] - a1[1])]; // conj(a2 − a1)
  const [vx, vy] = [m2[0] - m1[0], m2[1] - m1[1]];
  const den = ux * ux + uy * uy;
  const kr = (vx * ux + vy * uy) / den;
  const ki = (vy * ux - vx * uy) / den;
  // t = m1 − k · conj(a1)
  const tx = m1[0] - (kr * a1[0] + ki * a1[1]);
  const ty = m1[1] - (ki * a1[0] - kr * a1[1]);
  return [kr, ki, ki, -kr, tx, ty];
}

const SEGMENTS = {
  arm: reflectedSimilarity(ART.head, ART.elbow, MODEL.head, MODEL.elbow),
  fore: reflectedSimilarity(ART.elbow, ART.wrist, MODEL.elbow, MODEL.wrist),
  hand: reflectedSimilarity(ART.wrist, ART.tip, MODEL.wrist, MODEL.tip),
};

const SEGMENT_OF: Record<string, keyof typeof SEGMENTS> = { clavicule: "arm", scapula: "arm", humerus: "arm", radius: "fore", ulna: "fore" };

export const artMatrix = (id: string): Matrix => SEGMENTS[SEGMENT_OF[id] ?? "hand"];
export const artTransform = (id: string) => `matrix(${artMatrix(id).map((v) => Math.round(v * 1e5) / 1e5).join(" ")})`;

const apply = ([a, b, c, d, e, f]: Matrix, [x, y]: Pt): Pt => [a * x + c * y + e, b * x + d * y + f];

/** Contour réel de l'os (enveloppe convexe), dans le repère du modèle : boîtes serrées même après rotation. */
export function artCorners(id: string): Pt[] {
  const bone = ART_BONES[id];
  if (!bone) return [];
  const m = artMatrix(id);
  return bone.hull.map((p) => apply(m, p as Pt));
}

/** Boîte de l'os dans le repère du modèle. */
export function artBox(id: string): Box {
  const pts = artCorners(id);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
}

/** Longueur d'un os : plus grande distance entre deux points de son contour (repère du modèle). */
export function artLength(id: string): number {
  const pts = artCorners(id);
  let max = 0;
  for (const a of pts) for (const b of pts) max = Math.max(max, Math.hypot(a[0] - b[0], a[1] - b[1]));
  return max;
}

export const artCenter = (id: string): Pt => {
  const [x, y, w, h] = artBox(id);
  return [x + w / 2, y + h / 2];
};

/** Rôle de chaque tracé, pour le restyler (rendu radio) : contour de l'os, ombrage, trait de détail. */
export function pathRole(p: { fill: string; stroke?: string; role?: "base" | "shade" | "line" | "skip" }): "base" | "shade" | "line" | "skip" {
  if (p.role) return p.role;
  if (p.fill === "#FFFFFF") return "base";
  if (p.fill === "none") return "line";
  return "shade";
}

export { ART_BONES };
