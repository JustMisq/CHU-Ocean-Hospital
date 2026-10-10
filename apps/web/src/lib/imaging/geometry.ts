/**
 * Outils de dessin pour l'anatomie : tout est généré en chaînes `d` SVG,
 * utilisables telles quelles dans le navigateur et dans le PDF (react-pdf).
 */

export type Pt = [number, number];

const f = (n: number) => Math.round(n * 10) / 10;

/** Courbe lisse (Catmull-Rom → Bézier) passant par tous les points. */
export function smooth(points: Pt[], closed = true, tension = 0.5): string {
  const n = points.length;
  if (n < 2) return "";
  const at = (i: number) => (closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${f(points[0][0])},${f(points[0][1])}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const c1: Pt = [p1[0] + ((p2[0] - p0[0]) * tension) / 3, p1[1] + ((p2[1] - p0[1]) * tension) / 3];
    const c2: Pt = [p2[0] - ((p3[0] - p1[0]) * tension) / 3, p2[1] - ((p3[1] - p1[1]) * tension) / 3];
    d += `C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p2[0])},${f(p2[1])}`;
  }
  return closed ? `${d}Z` : d;
}

/** Os long le long d'un axe : largeur donnée à chaque point de l'axe (épiphyses plus larges). */
export function longBone(axis: Pt[], widths: number[]): string {
  const left: Pt[] = [];
  const right: Pt[] = [];
  axis.forEach((p, i) => {
    const a = axis[Math.max(0, i - 1)];
    const b = axis[Math.min(axis.length - 1, i + 1)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -(b[1] - a[1]) / len;
    const ny = (b[0] - a[0]) / len;
    const w = widths[i] / 2;
    left.push([p[0] + nx * w, p[1] + ny * w]);
    right.push([p[0] - nx * w, p[1] - ny * w]);
  });
  // Bouts arrondis : un point au-delà de chaque extrémité.
  const cap = (p: Pt, q: Pt, w: number): Pt => {
    const len = Math.hypot(p[0] - q[0], p[1] - q[1]) || 1;
    return [p[0] + ((p[0] - q[0]) / len) * w * 0.35, p[1] + ((p[1] - q[1]) / len) * w * 0.35];
  };
  const start = cap(axis[0], axis[1], widths[0]);
  const end = cap(axis[axis.length - 1], axis[axis.length - 2], widths[widths.length - 1]);
  return smooth([start, ...right, end, ...left.reverse()]);
}

/** Ellipse (éventuellement inclinée), en chemin. */
export function ellipse(cx: number, cy: number, rx: number, ry: number, rotDeg = 0): string {
  const pts: Pt[] = [];
  const r = (rotDeg * Math.PI) / 180;
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * Math.PI * 2;
    const x = Math.cos(t) * rx;
    const y = Math.sin(t) * ry;
    pts.push([cx + x * Math.cos(r) - y * Math.sin(r), cy + x * Math.sin(r) + y * Math.cos(r)]);
  }
  return smooth(pts);
}

/** Points d'une courbe lisse fermée (Catmull-Rom), assez denses pour être découpés en bandes sans perdre la forme. */
export function sampleSmooth(points: Pt[], perSegment = 10): Pt[] {
  const n = points.length;
  const at = (i: number) => points[(i + n) % n];
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let s = 0; s < perSegment; s++) {
      const t = s / perSegment, t2 = t * t, t3 = t2 * t;
      const c = (a: number, b: number, c_: number, d: number) =>
        0.5 * (2 * b + (-a + c_) * t + (2 * a - 5 * b + 4 * c_ - d) * t2 + (-a + 3 * b - 3 * c_ + d) * t3);
      out.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  return out;
}

/** Polyligne lisse ouverte (nerfs, vaisseaux, tendons). */
export const line = (points: Pt[]) => smooth(points, false);

/** Centre approximatif d'une liste de points (pour placer les repères de lésion). */
export function centroid(points: Pt[]): Pt {
  const s = points.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]] as Pt, [0, 0] as Pt);
  return [s[0] / points.length, s[1] / points.length];
}

/** Rectangle englobant [x, y, largeur, hauteur]. */
export type Box = [number, number, number, number];

export function boxOf(points: Pt[], margin = 0): Box {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x0 = Math.min(...xs) - margin, y0 = Math.min(...ys) - margin;
  return [x0, y0, Math.max(...xs) + margin - x0, Math.max(...ys) + margin - y0];
}

/** Points d'ancrage d'un chemin `d` (sommets M/L/C), suffisant pour les boîtes et centres. */
export function pathPoints(d: string): Pt[] {
  const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  const pts: Pt[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  return pts;
}

/** Découpe d'un polygone par une bande horizontale y0 ≤ y ≤ y1 (Sutherland–Hodgman). */
export function clipBand(poly: Pt[], y0: number, y1: number): Pt[] {
  const clip = (pts: Pt[], inside: (p: Pt) => boolean, cut: (a: Pt, b: Pt) => Pt) => {
    const out: Pt[] = [];
    pts.forEach((cur, i) => {
      const prev = pts[(i + pts.length - 1) % pts.length];
      if (inside(cur)) {
        if (!inside(prev)) out.push(cut(prev, cur));
        out.push(cur);
      } else if (inside(prev)) out.push(cut(prev, cur));
    });
    return out;
  };
  const atY = (y: number) => (a: Pt, b: Pt): Pt => [a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]), y];
  return clip(clip(poly, (p) => p[1] >= y0, atY(y0)), (p) => p[1] <= y1, atY(y1));
}

/** Découpe d'un polygone par un rectangle (Sutherland–Hodgman sur les quatre bords). */
export function clipRect(poly: Pt[], [x, y, w, h]: Box): Pt[] {
  const clip = (pts: Pt[], inside: (p: Pt) => boolean, cut: (a: Pt, b: Pt) => Pt) => {
    const out: Pt[] = [];
    pts.forEach((cur, i) => {
      const prev = pts[(i + pts.length - 1) % pts.length];
      if (inside(cur)) {
        if (!inside(prev)) out.push(cut(prev, cur));
        out.push(cur);
      } else if (inside(prev)) out.push(cut(prev, cur));
    });
    return out;
  };
  const atX = (v: number) => (a: Pt, b: Pt): Pt => [v, a[1] + ((b[1] - a[1]) * (v - a[0])) / (b[0] - a[0])];
  const atY = (v: number) => (a: Pt, b: Pt): Pt => [a[0] + ((b[0] - a[0]) * (v - a[1])) / (b[1] - a[1]), v];
  let pts = clip(poly, (p) => p[0] >= x, atX(x));
  pts = clip(pts, (p) => p[0] <= x + w, atX(x + w));
  pts = clip(pts, (p) => p[1] >= y, atY(y));
  return clip(pts, (p) => p[1] <= y + h, atY(y + h));
}

/** Point dans un polygone (règle pair-impair). */
export function insidePolygon([px, py]: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Polygone droit (pour les bandes découpées : pas de lissage, sinon les bords ne se raccordent pas). */
export const polygon = (pts: Pt[]) => (pts.length ? `M${pts.map((p) => `${f(p[0])},${f(p[1])}`).join("L")}Z` : "");
