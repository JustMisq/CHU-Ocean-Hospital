/**
 * Lecture de la planche LadyofHats (squelette de face, domaine public) : groupes par chemin d'indices,
 * tracés d'un groupe, silhouette du corps.
 */
import { readFileSync } from "node:fs";

export type ArtPath = { d: string; fill: string; stroke?: string; sw?: number };

export function loadPlate(file: string) {
  const svg = readFileSync(file, "utf8");
  // Chaque groupe <g> : chemin d'indices depuis la racine (« 0.0.1.5 »), début et fin dans le texte.
  const spans = new Map<string, { start: number; end: number }>();
  const stack: { path: number[]; start: number; children: number }[] = [];
  let top = 0;
  for (const m of svg.matchAll(/<g\b[^>]*>|<\/g>/g)) {
    if (m[0] === "</g>") {
      const g = stack.pop()!;
      spans.set(g.path.join("."), { start: g.start, end: m.index! + 4 });
      continue;
    }
    const parent = stack[stack.length - 1];
    stack.push({ path: parent ? [...parent.path, parent.children++] : [top++], start: m.index!, children: 0 });
  }
  const group = (path: string) => {
    const s = spans.get(path);
    if (!s) throw new Error(`Planche : groupe ${path} introuvable`);
    return svg.slice(s.start, s.end);
  };
  /** Silhouette du corps : premier tracé de la planche, hors groupes (contour gris). */
  const silhouette = svg.match(/<path fill="none" stroke="#CFD0D2" d="([^"]+)"/)?.[1].replace(/\s+/g, " ").trim();
  if (!silhouette) throw new Error("Planche : silhouette introuvable");
  // Éléments hors de tout groupe (fond, silhouette, sternum, vertèbres dorsales…), dans l'ordre du fichier.
  const topItems: string[] = [];
  let depth = 0;
  for (const m of svg.matchAll(/<g\b[^>]*>|<\/g>|<(?:path|polygon|ellipse|circle|polyline|line|rect)\b[^>]*\/?>/g)) {
    if (m[0].startsWith("</g")) depth--;
    else if (m[0].startsWith("<g")) depth++;
    else if (depth === 0) topItems.push(m[0]);
  }
  const topItem = (index: number) => {
    const item = topItems[index];
    if (!item) throw new Error(`Planche : élément hors groupe n° ${index} introuvable`);
    return item;
  };
  return { svg, group, top: topItem, silhouette, width: 456.056, height: 925.702 };
}

/** Tracés d'un fragment de planche, avec leurs couleurs. */
export function pathsOf(body: string): ArtPath[] {
  const out: ArtPath[] = [];
  for (const m of body.matchAll(/<path\b([^>]*)\/?>/g)) {
    const attr = (name: string) => m[1].match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
    const d = attr("d")?.replace(/\s+/g, " ").trim();
    if (!d) continue;
    const sw = attr("stroke-width");
    out.push({ d, fill: attr("fill") ?? "#000000", ...(attr("stroke") && { stroke: attr("stroke") }), ...(sw && { sw: Number(sw) }) });
  }
  return out;
}
