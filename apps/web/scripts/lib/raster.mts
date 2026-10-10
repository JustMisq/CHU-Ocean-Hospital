/**
 * Outils matriciels pour la génération de l'atlas : rendu d'un dessin SVG en masque binaire, composantes connexes,
 * contour extérieur d'une composante (polygone) et simplification. Sert à découper une masse dessinée d'un seul tenant
 * (les muscles Servier) le long de ses traits, et à mesurer les os.
 */
import sharp from "sharp";
import type { Pt } from "./svg-path.mts";

export type Box = [x: number, y: number, w: number, h: number];

/** Masque binaire d'une zone du repère, à `scale` pixels par unité. */
export class Mask {
  constructor(public w: number, public h: number, public box: Box, public scale: number, public data: Uint8Array) {}

  static empty(box: Box, scale: number) {
    const w = Math.ceil(box[2] * scale), h = Math.ceil(box[3] * scale);
    return new Mask(w, h, box, scale, new Uint8Array(w * h));
  }

  /** Rendu de `body` (éléments SVG dans le repère) : un pixel est « dedans » s'il est plus sombre que `threshold`. */
  static async render(body: string, box: Box, scale: number, threshold = 128): Promise<Mask> {
    const [x, y, bw, bh] = box;
    const w = Math.ceil(bw * scale), h = Math.ceil(bh * scale);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w / scale} ${h / scale}"><rect x="${x}" y="${y}" width="${bw}" height="${bh}" fill="#fff"/>${body}</svg>`;
    const { data, info } = await sharp(Buffer.from(svg), { limitInputPixels: false }).flatten({ background: "#fff" }).raw().toBuffer({ resolveWithObject: true });
    const out = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) out[i] = data[i * info.channels] < threshold ? 1 : 0;
    return new Mask(w, h, box, scale, out);
  }

  at(i: number, j: number) {
    return i >= 0 && j >= 0 && i < this.w && j < this.h ? this.data[j * this.w + i] : 0;
  }
  toPixel([x, y]: Pt): [number, number] {
    return [Math.floor((x - this.box[0]) * this.scale), Math.floor((y - this.box[1]) * this.scale)];
  }
  toPoint(i: number, j: number): Pt {
    return [this.box[0] + i / this.scale, this.box[1] + j / this.scale];
  }
  inside(p: Pt) {
    const [i, j] = this.toPixel(p);
    return this.at(i, j) === 1;
  }

  /** Combinaisons pixel à pixel. */
  and(o: Mask) { return this.map((v, k) => v & o.data[k]); }
  minus(o: Mask) { return this.map((v, k) => v & (1 - o.data[k])); }
  or(o: Mask) { return this.map((v, k) => v | o.data[k]); }
  map(f: (v: number, k: number) => number) {
    const d = new Uint8Array(this.data.length);
    for (let k = 0; k < d.length; k++) d[k] = f(this.data[k], k);
    return new Mask(this.w, this.h, this.box, this.scale, d);
  }

  /** Composante connexe (4-voisinage) contenant le point `seed` ; masque vide si le point est dehors. */
  component(seed: Pt): Mask {
    const out = Mask.empty(this.box, this.scale);
    const [si, sj] = this.toPixel(seed);
    if (!this.at(si, sj)) return out;
    const stack = [sj * this.w + si];
    out.data[stack[0]] = 1;
    while (stack.length) {
      const k = stack.pop()!;
      const i = k % this.w, j = (k - i) / this.w;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= this.w || nj >= this.h) continue;
        const nk = nj * this.w + ni;
        if (this.data[nk] && !out.data[nk]) {
          out.data[nk] = 1;
          stack.push(nk);
        }
      }
    }
    return out;
  }

  /** Toutes les composantes, avec leur taille (pixels) et un point intérieur. */
  components(minPixels = 0): { mask: Mask; size: number; seed: Pt; center: Pt }[] {
    const seen = new Uint8Array(this.data.length);
    const out: { mask: Mask; size: number; seed: Pt; center: Pt }[] = [];
    for (let k = 0; k < this.data.length; k++) {
      if (!this.data[k] || seen[k]) continue;
      const i = k % this.w, j = (k - i) / this.w;
      const comp = this.component(this.toPoint(i + 0.5, j + 0.5));
      let size = 0, sx = 0, sy = 0;
      for (let q = 0; q < comp.data.length; q++) {
        if (!comp.data[q]) continue;
        seen[q] = 1;
        size++;
        sx += q % this.w;
        sy += Math.floor(q / this.w);
      }
      if (size >= minPixels) out.push({ mask: comp, size, seed: this.toPoint(i + 0.5, j + 0.5), center: this.toPoint(sx / size, sy / size) });
    }
    return out;
  }

  /** Érosion / dilatation carrée de `r` pixels. */
  grow(r: number) { return this.morph(r, 1); }
  shrink(r: number) { return this.morph(r, 0); }
  private morph(r: number, value: 0 | 1) {
    const d = new Uint8Array(this.data.length);
    for (let j = 0; j < this.h; j++) {
      for (let i = 0; i < this.w; i++) {
        let v = value === 1 ? 0 : 1;
        for (let dj = -r; dj <= r && v !== value; dj++) {
          for (let di = -r; di <= r; di++) {
            if (this.at(i + di, j + dj) === value) { v = value; break; }
          }
        }
        d[j * this.w + i] = v;
      }
    }
    return new Mask(this.w, this.h, this.box, this.scale, d);
  }

  /** Nombre de pixels « dedans ». */
  count() {
    let n = 0;
    for (const v of this.data) n += v;
    return n;
  }

  /**
   * Contour extérieur de la plus grande composante (suivi de bord de Moore), en coordonnées du repère.
   * Les trous ne sont pas suivis : une zone d'un seul tenant donne un polygone.
   */
  outline(): Pt[] {
    let start = -1;
    for (let k = 0; k < this.data.length; k++) if (this.data[k]) { start = k; break; }
    if (start < 0) return [];
    const dirs: [number, number][] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
    let i = start % this.w, j = (start - i) / this.w;
    const si = i, sj = j;
    let dir = 6; // on arrive par le haut
    const pts: Pt[] = [];
    for (let guard = 0; guard < this.data.length * 4; guard++) {
      pts.push(this.toPoint(i + 0.5, j + 0.5));
      let found = false;
      for (let t = 0; t < 8; t++) {
        const d = (dir + 6 + t) % 8; // on tourne en partant de la gauche de la direction courante
        const ni = i + dirs[d][0], nj = j + dirs[d][1];
        if (this.at(ni, nj)) {
          i = ni; j = nj; dir = d; found = true;
          break;
        }
      }
      if (!found || (i === si && j === sj)) break;
    }
    return pts;
  }
}

/** Simplification de Douglas–Peucker (polygone fermé), tolérance en unités du repère. */
export function simplify(pts: Pt[], tol: number): Pt[] {
  if (pts.length < 4) return pts;
  // Coupe du polygone au point le plus éloigné du premier, puis simplification des deux moitiés.
  let far = 0, best = 0;
  pts.forEach((p, k) => {
    const d = Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]);
    if (d > best) { best = d; far = k; }
  });
  const keep = pts.map(() => false);
  keep[0] = keep[far] = true;
  const ring = [...pts, pts[0]];
  const dpRing = (a: number, b: number) => {
    let max = 0, idx = -1;
    const [ax, ay] = ring[a], [bx, by] = ring[b];
    const len = Math.hypot(bx - ax, by - ay) || 1e-9;
    for (let k = a + 1; k < b; k++) {
      const d = Math.abs((bx - ax) * (ay - ring[k][1]) - (ax - ring[k][0]) * (by - ay)) / len;
      if (d > max) { max = d; idx = k; }
    }
    if (max > tol && idx > 0) {
      keep[idx % pts.length] = true;
      dpRing(a, idx);
      dpRing(idx, b);
    }
  };
  dpRing(0, far);
  dpRing(far, pts.length);
  return pts.filter((_, k) => keep[k]);
}

/** Enveloppe convexe (chaîne monotone d'Andrew). */
export function convexHull(points: Pt[]): Pt[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: Pt[]) => {
    const out: Pt[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(pts), ...half([...pts].reverse())];
}

/** Réduit une enveloppe convexe à `max` points (en retirant les moins saillants). */
export function reduceHull(hull: Pt[], max: number): Pt[] {
  let pts = hull;
  while (pts.length > max) {
    let worst = 0, area = Infinity;
    pts.forEach((p, i) => {
      const a = pts[(i + pts.length - 1) % pts.length], b = pts[(i + 1) % pts.length];
      const s = Math.abs((a[0] - p[0]) * (b[1] - p[1]) - (a[1] - p[1]) * (b[0] - p[0]));
      if (s < area) { area = s; worst = i; }
    });
    pts = pts.filter((_, i) => i !== worst);
  }
  return pts;
}

/** Points du bord d'un masque (extrémités de chaque ligne), pour une enveloppe convexe. */
export function rowEdges(m: Mask): Pt[] {
  const out: Pt[] = [];
  for (let j = 0; j < m.h; j++) {
    let first = -1, last = -1;
    for (let i = 0; i < m.w; i++) if (m.data[j * m.w + i]) { if (first < 0) first = i; last = i; }
    if (first >= 0) out.push(m.toPoint(first, j), m.toPoint(last + 1, j));
  }
  return out;
}

/** Polygone → tracé SVG (2 décimales). */
export const polyPath = (pts: Pt[]) => (pts.length ? `M${pts.map((p) => `${Math.round(p[0] * 100) / 100},${Math.round(p[1] * 100) / 100}`).join("L")}Z` : "");
