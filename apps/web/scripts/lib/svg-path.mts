/**
 * Tracés SVG en coordonnées absolues : lecture (M L H V C Q A Z), arcs convertis en courbes de Bézier,
 * transformation point par point (matrice ou déformation libre) et réécriture compacte.
 */

export type Pt = [number, number];
export type Seg = { c: "M" | "L" | "C" | "Q" | "Z"; p: Pt[] };

/** Arc elliptique (paramètres SVG) → courbes de Bézier cubiques (SVG 1.1, annexe F.6). */
function arcToCubics(from: Pt, rx: number, ry: number, phiDeg: number, large: boolean, sweep: boolean, to: Pt): Pt[][] {
  if (rx === 0 || ry === 0) return [[from, to, to]];
  const phi = (phiDeg * Math.PI) / 180;
  const cos = Math.cos(phi), sin = Math.sin(phi);
  const dx = (from[0] - to[0]) / 2, dy = (from[1] - to[1]) / 2;
  const x1 = cos * dx + sin * dy, y1 = -sin * dx + cos * dy;
  rx = Math.abs(rx); ry = Math.abs(ry);
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lambda > 1) { rx *= Math.sqrt(lambda); ry *= Math.sqrt(lambda); }
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const coef = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cx1 = (coef * rx * y1) / ry, cy1 = (-coef * ry * x1) / rx;
  const cx = cos * cx1 - sin * cy1 + (from[0] + to[0]) / 2, cy = sin * cx1 + cos * cy1 + (from[1] + to[1]) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const t1 = ang(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
  let dt = ang((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  const n = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2)));
  const step = dt / n;
  const k = (4 / 3) * Math.tan(step / 4);
  const at = (t: number): Pt => [cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos];
  const deriv = (t: number): Pt => [-rx * Math.sin(t) * cos - ry * Math.cos(t) * sin, -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos];
  const out: Pt[][] = [];
  for (let i = 0; i < n; i++) {
    const a = t1 + i * step, b = a + step;
    const p0 = at(a), p3 = at(b), d0 = deriv(a), d3 = deriv(b);
    out.push([[p0[0] + k * d0[0], p0[1] + k * d0[1]], [p3[0] - k * d3[0], p3[1] - k * d3[1]], i === n - 1 ? to : p3]);
  }
  return out;
}

/** Lecture d'un tracé (commandes absolues ou relatives) en segments absolus M / L / C / Q / Z. */
export function parsePath(d: string): Seg[] {
  const tokens = d.match(/[MLHVCSQTAZmlhvcsqtaz]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) ?? [];
  const segs: Seg[] = [];
  let i = 0, cmd = "", cur: Pt = [0, 0], start: Pt = [0, 0];
  const n = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase();
    const P = (x: number, y: number): Pt => (rel ? [cur[0] + x, cur[1] + y] : [x, y]);
    switch (cmd.toUpperCase()) {
      case "M": cur = P(n(), n()); start = cur; segs.push({ c: "M", p: [cur] }); cmd = rel ? "l" : "L"; break;
      case "L": cur = P(n(), n()); segs.push({ c: "L", p: [cur] }); break;
      case "H": { const x = n(); cur = [rel ? cur[0] + x : x, cur[1]]; segs.push({ c: "L", p: [cur] }); break; }
      case "V": { const y = n(); cur = [cur[0], rel ? cur[1] + y : y]; segs.push({ c: "L", p: [cur] }); break; }
      case "C": { const a = P(n(), n()), b = P(n(), n()), e = P(n(), n()); segs.push({ c: "C", p: [a, b, e] }); cur = e; break; }
      case "Q": { const a = P(n(), n()), e = P(n(), n()); segs.push({ c: "Q", p: [a, e] }); cur = e; break; }
      case "A": {
        const rx = n(), ry = n(), rot = n(), large = n() === 1, sweep = n() === 1, e = P(n(), n());
        for (const c of arcToCubics(cur, rx, ry, rot, large, sweep, e)) segs.push({ c: "C", p: c });
        cur = e;
        break;
      }
      case "Z": segs.push({ c: "Z", p: [] }); cur = start; break;
      default: i++; // commande non gérée (S, T) : absente des sources utilisées
    }
  }
  return segs;
}

/** Applique une transformation à tous les points. */
export const mapSegs = (segs: Seg[], f: (p: Pt) => Pt): Seg[] => segs.map((s) => ({ c: s.c, p: s.p.map(f) }));

/** Matrice affine [a, b, c, d, e, f] → fonction. */
export const affine = ([a, b, c, d, e, f]: number[]) => ([x, y]: Pt): Pt => [a * x + c * y + e, b * x + d * y + f];

/** Réécriture compacte (précision : nombre de décimales). */
export function writePath(segs: Seg[], digits = 2): string {
  const k = 10 ** digits;
  const r = (v: number) => String(Math.round(v * k) / k);
  return segs.map((s) => s.c + s.p.map((p) => `${r(p[0])},${r(p[1])}`).join(" ")).join("");
}

/** Tous les points (extrémités et points de contrôle). */
export const segPoints = (segs: Seg[]): Pt[] => segs.flatMap((s) => s.p);
