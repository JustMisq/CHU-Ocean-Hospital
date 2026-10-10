/**
 * Déformation « plaque mince » (thin plate spline) : recale une illustration sur une autre à partir de repères
 * appariés (source → cible). Lisse entre les repères, exacte sur eux (au lissage `lambda` près).
 */
import type { Pt } from "./svg-path.mts";

const U = (r2: number) => (r2 < 1e-12 ? 0 : r2 * Math.log(r2));

/** Résolution d'un système linéaire (pivot de Gauss partiel). */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const piv = M[c][c] || 1e-12;
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / piv;
      if (f) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = s / (M[r][r] || 1e-12);
  }
  return x;
}

/** Fonction de déformation ajustée sur les paires (source[i] → cible[i]). */
export function thinPlate(source: Pt[], target: Pt[], lambda = 0): (p: Pt) => Pt {
  const n = source.length;
  // Normalisation : stabilité numérique quelle que soit l'échelle des coordonnées.
  const mx = source.reduce((s, p) => s + p[0], 0) / n, my = source.reduce((s, p) => s + p[1], 0) / n;
  const sc = Math.max(...source.map((p) => Math.hypot(p[0] - mx, p[1] - my))) || 1;
  const S = source.map(([x, y]): Pt => [(x - mx) / sc, (y - my) / sc]);
  const A: number[][] = [];
  for (let i = 0; i < n + 3; i++) A.push(new Array(n + 3).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) A[i][j] = U((S[i][0] - S[j][0]) ** 2 + (S[i][1] - S[j][1]) ** 2);
    A[i][i] += lambda;
    A[i][n] = A[n][i] = 1;
    A[i][n + 1] = A[n + 1][i] = S[i][0];
    A[i][n + 2] = A[n + 2][i] = S[i][1];
  }
  const wx = solve(A, [...target.map((p) => p[0]), 0, 0, 0]);
  const wy = solve(A, [...target.map((p) => p[1]), 0, 0, 0]);
  return ([px, py]) => {
    const x = (px - mx) / sc, y = (py - my) / sc;
    let ox = wx[n] + wx[n + 1] * x + wx[n + 2] * y;
    let oy = wy[n] + wy[n + 1] * x + wy[n + 2] * y;
    for (let i = 0; i < n; i++) {
      const u = U((x - S[i][0]) ** 2 + (y - S[i][1]) ** 2);
      ox += wx[i] * u;
      oy += wy[i] * u;
    }
    return [ox, oy];
  };
}
