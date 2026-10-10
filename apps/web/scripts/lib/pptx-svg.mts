/**
 * Conversion des formes d'une diapositive PowerPoint (DrawingML) en SVG.
 * Sert à réutiliser les illustrations vectorielles de Servier Medical Art (CC BY 4.0), livrées en .pptx.
 * Gère : groupes (repères enfants), positions / rotations / symétries, tracés libres (custGeom), rectangles et ellipses,
 * couleurs RVB et du thème (avec luminosité, transparence), dégradés linéaires et radiaux, contours.
 * Ignore le texte. Les images bitmap sont gardées seulement pour l'aperçu.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

// ─── XML minimal (fichiers OOXML bien formés) ────────────────────────────────

export type XNode = { name: string; attrs: Record<string, string>; children: XNode[] };

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (s: string) => s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (_, e: string) =>
  e[0] === "#" ? String.fromCodePoint(e[1] === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITIES[e] ?? `&${e};`);

export function parseXml(xml: string): XNode {
  const root: XNode = { name: "#root", attrs: {}, children: [] };
  const stack = [root];
  const re = /<(\/?)([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>/g;
  for (const m of xml.matchAll(re)) {
    if (!m[2]) continue; // déclaration, commentaire, CDATA
    if (m[1]) {
      stack.pop();
      continue;
    }
    const attrs: Record<string, string> = {};
    for (const a of m[3].matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[a[1]] = decode(a[2] ?? a[3]);
    const node: XNode = { name: m[2], attrs, children: [] };
    stack[stack.length - 1].children.push(node);
    if (!m[4]) stack.push(node);
  }
  return root;
}

export const child = (n: XNode | undefined, name: string) => n?.children.find((c) => c.name === name);
export const childrenNamed = (n: XNode | undefined, name: string) => n?.children.filter((c) => c.name === name) ?? [];
const num = (v: string | undefined, d = 0) => (v === undefined ? d : Number(v));

// ─── Couleurs ────────────────────────────────────────────────────────────────

type Rgba = { r: number; g: number; b: number; a: number };
const hex = ({ r, g, b }: Rgba) => `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;

function rgbToHsl({ r, g, b }: Rgba) {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B), min = Math.min(R, G, B), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [h / 6, s, l];
}
function hslToRgb(h: number, s: number, l: number, a: number): Rgba {
  if (s === 0) return { r: l * 255, g: l * 255, b: l * 255, a };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t: number) => {
    t = (t + 1) % 1;
    return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
  };
  return { r: f(h + 1 / 3) * 255, g: f(h) * 255, b: f(h - 1 / 3) * 255, a };
}

export class Theme {
  colors: Record<string, string> = {};
  constructor(themeXml?: string) {
    if (!themeXml) return;
    const scheme = findDeep(parseXml(themeXml), "a:clrScheme");
    for (const c of scheme?.children ?? []) {
      const v = child(c, "a:srgbClr")?.attrs.val ?? child(c, "a:sysClr")?.attrs.lastClr;
      if (v) this.colors[c.name.replace("a:", "")] = v;
    }
    this.colors.tx1 ??= this.colors.dk1; this.colors.bg1 ??= this.colors.lt1;
    this.colors.tx2 ??= this.colors.dk2; this.colors.bg2 ??= this.colors.lt2;
  }

  /** Couleur d'un nœud de remplissage (srgbClr, schemeClr, prstClr…) avec ses modificateurs. */
  color(n: XNode | undefined): Rgba | null {
    const c = n?.children.find((x) => /^a:(srgbClr|schemeClr|prstClr|sysClr|scrgbClr)$/.test(x.name));
    if (!c) return null;
    let v = c.attrs.val;
    if (c.name === "a:schemeClr") v = this.colors[v] ?? "808080";
    if (c.name === "a:sysClr") v = c.attrs.lastClr ?? "000000";
    if (c.name === "a:prstClr") v = PRESET[v] ?? "808080";
    let rgba: Rgba = c.name === "a:scrgbClr"
      ? { r: (num(c.attrs.r) / 100000) * 255, g: (num(c.attrs.g) / 100000) * 255, b: (num(c.attrs.b) / 100000) * 255, a: 1 }
      : { r: parseInt(v.slice(0, 2), 16), g: parseInt(v.slice(2, 4), 16), b: parseInt(v.slice(4, 6), 16), a: 1 };
    for (const mod of c.children) {
      const val = num(mod.attrs.val) / 100000;
      if (mod.name === "a:alpha") rgba.a = val;
      else if (mod.name === "a:lumMod" || mod.name === "a:lumOff") {
        const [h, s, l] = rgbToHsl(rgba);
        rgba = hslToRgb(h, s, mod.name === "a:lumMod" ? l * val : Math.min(1, l + val), rgba.a);
      } else if (mod.name === "a:shade") rgba = { ...rgba, r: rgba.r * val, g: rgba.g * val, b: rgba.b * val };
      else if (mod.name === "a:tint") rgba = { ...rgba, r: rgba.r + (255 - rgba.r) * (1 - val), g: rgba.g + (255 - rgba.g) * (1 - val), b: rgba.b + (255 - rgba.b) * (1 - val) };
    }
    return rgba;
  }
}
const PRESET: Record<string, string> = { black: "000000", white: "FFFFFF", red: "FF0000", blue: "0000FF", green: "008000", yellow: "FFFF00", gray: "808080" };

export function findDeep(n: XNode, name: string): XNode | undefined {
  if (n.name === name) return n;
  for (const c of n.children) {
    const f = findDeep(c, name);
    if (f) return f;
  }
  return undefined;
}

// ─── Transformations ─────────────────────────────────────────────────────────

/** Matrice affine [a, b, c, d, e, f] (comme SVG). */
export type M = [number, number, number, number, number, number];
export const I: M = [1, 0, 0, 1, 0, 0];
export const mul = (m: M, n: M): M => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const T = (x: number, y: number): M => [1, 0, 0, 1, x, y];
const S = (x: number, y: number): M => [x, 0, 0, y, 0, 0];
const R = (deg: number): M => {
  const r = (deg * Math.PI) / 180;
  return [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0];
};

/** Rotation et symétries d'un élément autour du centre de sa boîte (repère parent). */
function xfrmMatrix(xfrm: XNode | undefined) {
  const off = child(xfrm, "a:off"), ext = child(xfrm, "a:ext");
  const x = num(off?.attrs.x), y = num(off?.attrs.y), cx = num(ext?.attrs.cx), cy = num(ext?.attrs.cy);
  const rot = num(xfrm?.attrs.rot) / 60000;
  const fh = xfrm?.attrs.flipH === "1" ? -1 : 1, fv = xfrm?.attrs.flipV === "1" ? -1 : 1;
  const center = T(x + cx / 2, y + cy / 2);
  const orient = mul(center, mul(R(rot), mul(S(fh, fv), T(-(x + cx / 2), -(y + cy / 2)))));
  return { x, y, cx, cy, orient, xfrm };
}

// ─── Géométrie ───────────────────────────────────────────────────────────────

const f2 = (v: number) => Math.round(v * 100) / 100;

/** Tracé SVG d'une géométrie libre, dans le repère de la forme (0..cx, 0..cy). */
function custGeomD(geom: XNode, cx: number, cy: number): string {
  let d = "";
  for (const path of childrenNamed(child(geom, "a:pathLst"), "a:path")) {
    const w = num(path.attrs.w, cx) || cx || 1, h = num(path.attrs.h, cy) || cy || 1;
    const sx = cx / w, sy = cy / h;
    let cur: [number, number] = [0, 0];
    const pt = (n: XNode): [number, number] => [num(n.attrs.x) * sx, num(n.attrs.y) * sy];
    for (const cmd of path.children) {
      const pts = childrenNamed(cmd, "a:pt").map(pt);
      switch (cmd.name) {
        case "a:moveTo": cur = pts[0]; d += `M${f2(cur[0])},${f2(cur[1])}`; break;
        case "a:lnTo": cur = pts[0]; d += `L${f2(cur[0])},${f2(cur[1])}`; break;
        case "a:cubicBezTo": cur = pts[2]; d += `C${pts.map((p) => `${f2(p[0])},${f2(p[1])}`).join(" ")}`; break;
        case "a:quadBezTo": cur = pts[1]; d += `Q${pts.map((p) => `${f2(p[0])},${f2(p[1])}`).join(" ")}`; break;
        case "a:arcTo": {
          const wR = num(cmd.attrs.wR) * sx, hR = num(cmd.attrs.hR) * sy;
          const st = (num(cmd.attrs.stAng) / 60000) * (Math.PI / 180), sw = (num(cmd.attrs.swAng) / 60000) * (Math.PI / 180);
          const ccx = cur[0] - wR * Math.cos(st), ccy = cur[1] - hR * Math.sin(st);
          const end: [number, number] = [ccx + wR * Math.cos(st + sw), ccy + hR * Math.sin(st + sw)];
          d += `A${f2(wR)},${f2(hR)} 0 ${Math.abs(sw) > Math.PI ? 1 : 0} ${sw > 0 ? 1 : 0} ${f2(end[0])},${f2(end[1])}`;
          cur = end;
          break;
        }
        case "a:close": d += "Z"; break;
      }
    }
  }
  return d;
}

function prstGeomD(prst: string, cx: number, cy: number): string {
  if (prst === "ellipse") return `M0,${f2(cy / 2)}A${f2(cx / 2)},${f2(cy / 2)} 0 1 1 ${f2(cx)},${f2(cy / 2)}A${f2(cx / 2)},${f2(cy / 2)} 0 1 1 0,${f2(cy / 2)}Z`;
  if (prst === "roundRect") {
    const r = Math.min(cx, cy) * 0.1667;
    return `M${f2(r)},0H${f2(cx - r)}A${f2(r)},${f2(r)} 0 0 1 ${f2(cx)},${f2(r)}V${f2(cy - r)}A${f2(r)},${f2(r)} 0 0 1 ${f2(cx - r)},${f2(cy)}H${f2(r)}A${f2(r)},${f2(r)} 0 0 1 0,${f2(cy - r)}V${f2(r)}A${f2(r)},${f2(r)} 0 0 1 ${f2(r)},0Z`;
  }
  return `M0,0H${f2(cx)}V${f2(cy)}H0Z`;
}

// ─── Conversion d'une diapositive ────────────────────────────────────────────

export type SvgShape = {
  /** Nom donné dans PowerPoint (souvent descriptif : « Liver », « Kidney »…). */
  name: string;
  /** Chemin de groupes (noms) depuis la racine de la diapositive. */
  groups: string[];
  /** Même chemin, en indices (rang du groupe parmi ses frères) : identifiant stable d'un groupe. */
  path: number[];
  d: string;
  transform: M;
  fill: string;
  fillOpacity: number;
  stroke?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
};

export type SlideResult = { width: number; height: number; shapes: SvgShape[]; defs: string[]; images: { href: string; transform: M; w: number; h: number }[] };

export function convertSlide(slideXml: string, theme: Theme, slideW: number, slideH: number, mediaDir?: string, relsXml?: string): SlideResult {
  const tree = parseXml(slideXml);
  const spTree = findDeep(tree, "p:spTree")!;
  const defs: string[] = [];
  const shapes: SvgShape[] = [];
  const images: SlideResult["images"] = [];
  const rels: Record<string, string> = {};
  if (relsXml) for (const r of findDeep(parseXml(relsXml), "Relationships")?.children ?? []) rels[r.attrs.Id] = r.attrs.Target;
  let gradId = 0;

  const paint = (spPr: XNode | undefined, box: { cx: number; cy: number }) => {
    let fill = "none", fillOpacity = 1;
    const solid = child(spPr, "a:solidFill"), grad = child(spPr, "a:gradFill");
    if (solid) {
      const c = theme.color(solid);
      if (c) { fill = hex(c); fillOpacity = c.a; }
    } else if (grad) {
      const stops = childrenNamed(child(grad, "a:gsLst"), "a:gs").map((gs) => ({ pos: num(gs.attrs.pos) / 100000, c: theme.color(gs) })).filter((s) => s.c);
      if (stops.length) {
        const id = `g${gradId++}`;
        const stopXml = stops.sort((a, b) => a.pos - b.pos).map((s) => `<stop offset="${f2(s.pos)}" stop-color="${hex(s.c!)}" stop-opacity="${f2(s.c!.a)}"/>`).join("");
        const path = child(grad, "a:path");
        if (path) {
          defs.push(`<radialGradient id="${id}" cx="0.5" cy="0.5" r="0.6">${stopXml}</radialGradient>`);
        } else {
          const ang = num(child(grad, "a:lin")?.attrs.ang) / 60000;
          defs.push(`<linearGradient id="${id}" gradientTransform="rotate(${f2(ang)} 0.5 0.5)">${stopXml}</linearGradient>`);
        }
        fill = `url(#${id})`;
      }
    }
    let stroke: string | undefined, strokeWidth: number | undefined, strokeOpacity: number | undefined;
    const ln = child(spPr, "a:ln");
    if (ln && !child(ln, "a:noFill")) {
      const c = theme.color(child(ln, "a:solidFill"));
      if (c) { stroke = hex(c); strokeOpacity = c.a; strokeWidth = num(ln.attrs.w, 9525); }
    }
    void box;
    return { fill, fillOpacity, stroke, strokeWidth, strokeOpacity };
  };

  const walk = (n: XNode, parent: M, groups: string[], path: number[]) => {
    let index = 0;
    for (const el of n.children) {
      if (el.name === "p:grpSp") {
        const grpSpPr = child(el, "p:grpSpPr");
        const xfrm = child(grpSpPr, "a:xfrm");
        const { x, y, cx, cy, orient } = xfrmMatrix(xfrm);
        const chOff = child(xfrm, "a:chOff"), chExt = child(xfrm, "a:chExt");
        const cox = num(chOff?.attrs.x), coy = num(chOff?.attrs.y), ccx = num(chExt?.attrs.cx, cx) || 1, ccy = num(chExt?.attrs.cy, cy) || 1;
        const childMap = mul(T(x, y), mul(S(cx / ccx, cy / ccy), T(-cox, -coy)));
        const name = child(child(el, "p:nvGrpSpPr"), "p:cNvPr")?.attrs.name ?? "groupe";
        walk(el, mul(parent, mul(orient, childMap)), [...groups, name], [...path, index++]);
      } else if (el.name === "p:sp" || el.name === "p:cxnSp") {
        const spPr = child(el, "p:spPr");
        const { x, y, cx, cy, orient } = xfrmMatrix(child(spPr, "a:xfrm"));
        const cust = child(spPr, "a:custGeom"), prst = child(spPr, "a:prstGeom");
        const d = cust ? custGeomD(cust, cx, cy) : prstGeomD(prst?.attrs.prst ?? "rect", cx, cy);
        if (!d) continue;
        const p = paint(spPr, { cx, cy });
        if (p.fill === "none" && !p.stroke) continue;
        const name = child(child(el, el.name === "p:sp" ? "p:nvSpPr" : "p:nvCxnSpPr"), "p:cNvPr")?.attrs.name ?? "forme";
        const transform = mul(parent, mul(orient, T(x, y)));
        // L'épaisseur d'un trait DrawingML est absolue (EMU) : on la ramène au repère local, sinon les groupes
        // à petites unités internes l'agrandissent énormément.
        const scale = Math.sqrt(Math.abs(transform[0] * transform[3] - transform[1] * transform[2])) || 1;
        shapes.push({ name, groups, path, d, transform, ...p, ...(p.strokeWidth && { strokeWidth: p.strokeWidth / scale }) });
      } else if (el.name === "p:pic" && mediaDir) {
        const blip = findDeep(el, "a:blip");
        const target = blip && rels[blip.attrs["r:embed"]];
        const { x, y, cx, cy, orient } = xfrmMatrix(child(child(el, "p:spPr"), "a:xfrm"));
        if (target) {
          const file = resolve(mediaDir, "..", "slides", target);
          if (existsSync(file)) {
            const ext = file.split(".").pop()!.toLowerCase();
            const mime = ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : null;
            if (mime) images.push({ href: `data:${mime};base64,${readFileSync(file).toString("base64")}`, transform: mul(parent, mul(orient, T(x, y))), w: cx, h: cy });
          }
        }
      }
    }
  };
  walk(spTree, I, [], []);
  return { width: slideW, height: slideH, shapes, defs, images };
}

/** Diapositive → document SVG complet (aperçu). */
export function slideToSvg(r: SlideResult, scale = 1 / 12700): string {
  const m = (t: M) => `matrix(${t.map((v, i) => (i < 4 ? v : v)).map((v) => Math.round(v * 1e6) / 1e6).join(" ")})`;
  const body = [
    ...r.images.map((im) => `<image href="${im.href}" width="${im.w}" height="${im.h}" transform="${m(im.transform)}" preserveAspectRatio="none"/>`),
    ...r.shapes.map((s) =>
      `<path d="${s.d}" transform="${m(s.transform)}" fill="${s.fill}" fill-opacity="${s.fillOpacity}"${s.stroke ? ` stroke="${s.stroke}" stroke-width="${s.strokeWidth}" stroke-opacity="${s.strokeOpacity}"` : ""}/>`),
  ].join("");
  const W = r.width * scale, H = r.height * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${f2(W)}" height="${f2(H)}" viewBox="0 0 ${r.width} ${r.height}"><defs>${r.defs.join("")}</defs><rect width="${r.width}" height="${r.height}" fill="#fff"/>${body}</svg>`;
}

/** Ouvre un .pptx déjà décompressé (dossier) : taille des diapositives, thème, liste des diapositives. */
export function openDeck(dir: string) {
  const pres = parseXml(readFileSync(join(dir, "ppt/presentation.xml"), "utf8"));
  const sz = findDeep(pres, "p:sldSz")!;
  const themeFile = join(dir, "ppt/theme/theme1.xml");
  const theme = new Theme(existsSync(themeFile) ? readFileSync(themeFile, "utf8") : undefined);
  return { width: num(sz.attrs.cx), height: num(sz.attrs.cy), theme, dir };
}

export function loadSlide(deck: ReturnType<typeof openDeck>, n: number, withImages = false) {
  const file = join(deck.dir, `ppt/slides/slide${n}.xml`);
  const rels = join(deck.dir, `ppt/slides/_rels/slide${n}.xml.rels`);
  return convertSlide(readFileSync(file, "utf8"), deck.theme, deck.width, deck.height, withImages ? join(deck.dir, "ppt/media") : undefined, existsSync(rels) ? readFileSync(rels, "utf8") : undefined);
}

export { dirname };
