import type { Modality, Region } from "./anatomy";
import type { Finding } from "./catalog";
import { concerns } from "./catalog";
import { centroid, pathPoints, type Pt } from "./geometry";
import type { Slice, SliceItem, Tissue } from "./slices";

/**
 * Rendu « réaliste » des coupes : niveau de gris de chaque tissu selon l'examen et la séquence,
 * et signature visuelle de chaque lésion. Valeurs inspirées des contrastes réels :
 * scanner (densités en UH vues à travers une fenêtre : os blanc, graisse sombre, air noir),
 * IRM T1 (graisse blanche), T2 / STIR fat-sat (liquide et œdème blancs), FLAIR (LCS noir, œdème blanc),
 * diffusion (ischémie récente blanche), T2* (sang ancien et dépôts d'hémosidérine noirs).
 */

export type Contrast =
  | "CT_SOFT" | "CT_BONE" | "CT_LUNG" | "CT_BRAIN"
  | "T1" | "T2" | "FS" /* DP fat-sat / STIR */ | "T1_GADO" | "FLAIR" | "DWI" | "T2STAR";

export const CONTRAST_LABELS: Record<Contrast, string> = {
  CT_SOFT: "Fenêtre parties molles",
  CT_BONE: "Fenêtre osseuse",
  CT_LUNG: "Fenêtre pulmonaire",
  CT_BRAIN: "Fenêtre cérébrale",
  T1: "T1",
  T2: "T2",
  FS: "DP / STIR fat-sat",
  T1_GADO: "T1 fat-sat gadolinium",
  FLAIR: "FLAIR",
  DWI: "Diffusion",
  T2STAR: "T2* / SWI",
};

/** Fenêtres et séquences proposées selon l'examen et la région. */
export function contrastsFor(modality: Modality, regionId: string): Contrast[] {
  if (modality === "RADIO") return [];
  if (modality === "SCANNER") {
    if (regionId === "tete-cou") return ["CT_BRAIN", "CT_BONE", "CT_SOFT"];
    if (regionId === "thorax") return ["CT_SOFT", "CT_LUNG", "CT_BONE"];
    return ["CT_SOFT", "CT_BONE"];
  }
  if (regionId === "tete-cou") return ["T1", "T2", "FLAIR", "DWI", "T2STAR", "T1_GADO"];
  return ["T1", "T2", "FS", "T1_GADO"];
}

export const isCT = (c: Contrast) => c.startsWith("CT_");
/** Séquences « sensibles au liquide » : œdème, épanchement, hématome récent et ruptures y brillent. */
export const fluidBright = (c: Contrast) => c === "T2" || c === "FS";

const g = (v: number) => {
  const h = Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0");
  return `#${h}${h}${h}`;
};

/** Densités (UH) sans injection, pour le scanner. */
const HU: Record<Tissue, number> = {
  skin: 40, fat: -100, muscle: 50, tendon: 80, ligament: 70, nerve: 30, artery: 40, vein: 40, bone: 1200, marrow: -15,
  cartilage: 80, joint: 5, air: -1000, lung: -850, fluid: 5, liver: 60, spleen: 50, kidney: 35, pancreas: 40, bowel: 40,
  heart: 45, blood: 40, gm: 38, wm: 25, cord: 35, disc: 80,
};
/** Fenêtre [centre, largeur] → niveau de gris. */
const ctWindow = (level: number, width: number) => (hu: number) => ((hu - (level - width / 2)) / width) * 255;
const CT_WINDOWS: Record<"CT_SOFT" | "CT_BONE" | "CT_LUNG" | "CT_BRAIN", (hu: number) => number> = {
  CT_SOFT: ctWindow(40, 400),
  CT_BONE: ctWindow(400, 1800),
  CT_LUNG: ctWindow(-600, 1500),
  CT_BRAIN: ctWindow(40, 80),
};

/** Signal IRM (0 noir – 255 blanc) par tissu et séquence. */
const MRI: Record<Exclude<Contrast, `CT_${string}`>, Record<Tissue, number>> = {
  T1: {
    skin: 154, fat: 236, muscle: 107, tendon: 22, ligament: 28, nerve: 122, artery: 14, vein: 30, bone: 11, marrow: 224, cartilage: 92, joint: 58,
    air: 4, lung: 10, fluid: 40, liver: 140, spleen: 95, kidney: 110, pancreas: 150, bowel: 90, heart: 100, blood: 20,
    gm: 92, wm: 132, cord: 112, disc: 92,
  },
  T2: {
    skin: 138, fat: 200, muscle: 74, tendon: 20, ligament: 26, nerve: 140, artery: 14, vein: 40, bone: 11, marrow: 189, cartilage: 122, joint: 232,
    air: 4, lung: 12, fluid: 240, liver: 70, spleen: 150, kidney: 150, pancreas: 100, bowel: 100, heart: 70, blood: 20,
    gm: 140, wm: 95, cord: 112, disc: 200,
  },
  FS: {
    skin: 106, fat: 38, muscle: 85, tendon: 18, ligament: 24, nerve: 154, artery: 14, vein: 40, bone: 9, marrow: 46, cartilage: 138, joint: 240,
    air: 4, lung: 12, fluid: 245, liver: 60, spleen: 160, kidney: 170, pancreas: 90, bowel: 110, heart: 70, blood: 20,
    gm: 150, wm: 100, cord: 120, disc: 190,
  },
  T1_GADO: {
    skin: 120, fat: 42, muscle: 106, tendon: 21, ligament: 30, nerve: 116, artery: 224, vein: 210, bone: 10, marrow: 44, cartilage: 96, joint: 58,
    air: 4, lung: 14, fluid: 40, liver: 170, spleen: 170, kidney: 200, pancreas: 160, bowel: 160, heart: 160, blood: 224,
    gm: 110, wm: 130, cord: 115, disc: 80,
  },
  FLAIR: {
    skin: 120, fat: 190, muscle: 70, tendon: 20, ligament: 25, nerve: 120, artery: 15, vein: 30, bone: 10, marrow: 170, cartilage: 90, joint: 30,
    air: 4, lung: 10, fluid: 20, liver: 80, spleen: 110, kidney: 100, pancreas: 90, bowel: 80, heart: 70, blood: 20,
    gm: 150, wm: 110, cord: 120, disc: 100,
  },
  DWI: {
    skin: 70, fat: 30, muscle: 60, tendon: 15, ligament: 18, nerve: 90, artery: 10, vein: 20, bone: 8, marrow: 30, cartilage: 60, joint: 25,
    air: 2, lung: 8, fluid: 22, liver: 90, spleen: 130, kidney: 120, pancreas: 90, bowel: 80, heart: 40, blood: 15,
    gm: 115, wm: 100, cord: 100, disc: 60,
  },
  T2STAR: {
    skin: 120, fat: 170, muscle: 70, tendon: 15, ligament: 20, nerve: 120, artery: 15, vein: 12, bone: 8, marrow: 150, cartilage: 110, joint: 210,
    air: 2, lung: 8, fluid: 220, liver: 50, spleen: 120, kidney: 130, pancreas: 90, bowel: 90, heart: 60, blood: 18,
    gm: 130, wm: 90, cord: 100, disc: 180,
  },
};

/**
 * Valeurs historiques du membre supérieur (réglées à l'œil sur des coupes réelles) : on les garde pour ne pas
 * changer son rendu ; les autres tissus suivent les fenêtres ci-dessus.
 */
const TUNED: Partial<Record<Contrast, Partial<Record<Tissue, number>>>> = {
  CT_SOFT: { skin: 140, fat: 58, muscle: 125, tendon: 146, ligament: 138, nerve: 112, artery: 132, bone: 255, marrow: 92, cartilage: 140, joint: 104 },
  CT_BONE: { skin: 58, fat: 42, muscle: 61, tendon: 63, ligament: 62, nerve: 60, artery: 61, bone: 255, marrow: 150, cartilage: 63, joint: 56 },
};

/** Couleur d'un tissu ; `injected` : produit de contraste iodé (vaisseaux et organes rehaussés au scanner). */
export function tissueColor(tissue: Tissue, contrast: Contrast, injected = false): string {
  if (isCT(contrast)) {
    const tuned = TUNED[contrast]?.[tissue];
    let hu = HU[tissue];
    if (injected) {
      // Rehaussement : vaisseaux et cavités cardiaques très denses, parenchymes plus modérément.
      const boost: Partial<Record<Tissue, number>> = { artery: 300, vein: 160, blood: 260, liver: 50, spleen: 70, kidney: 140, pancreas: 60, bowel: 40, heart: 60 };
      hu += boost[tissue] ?? 0;
      if (tissue === "artery" && contrast === "CT_SOFT") return g(242);
      if (tissue === "artery" && contrast === "CT_BONE") return g(120);
      if (boost[tissue]) return g(CT_WINDOWS[contrast as keyof typeof CT_WINDOWS](hu));
    }
    if (tuned != null) return g(tuned);
    return g(CT_WINDOWS[contrast as keyof typeof CT_WINDOWS](hu));
  }
  return g(MRI[contrast as keyof typeof MRI][tissue]);
}

/** Élément de dessin d'une lésion sur la coupe. */
export type Overlay =
  | { type: "path"; d: string; fill?: string; stroke?: string; width?: number; opacity?: number }
  | { type: "line"; from: Pt; to: Pt; stroke: string; width: number; opacity?: number }
  | { type: "circle"; at: Pt; r: number; fill: string; opacity?: number };

const itemCenter = (it: SliceItem): Pt => centroid(pathPoints(it.d));
const itemRadius = (it: SliceItem): number => {
  const pts = pathPoints(it.d);
  const c = centroid(pts);
  return Math.max(2, Math.max(...pts.map((p) => Math.hypot(p[0] - c[0], p[1] - c[1]))) * 0.8);
};

/** Pseudo-aléatoire stable (même dessin à chaque rendu pour une lésion donnée). */
export function rng(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507)), ((h >>> 0) % 10000) / 10000);
}

/**
 * Côtés où dessiner une lésion latéralisée (option « cote ») : −1 = droite du patient (à gauche de l'écran), +1 = gauche,
 * 0 = pas de côté précisé (toute la structure).
 */
export function findingSides(f: Finding): (-1 | 0 | 1)[] {
  return f.options.cote === "d" ? [-1] : f.options.cote === "g" ? [1] : f.options.cote === "bilateral" ? [-1, 1] : [0];
}

/** Éléments de la coupe concernés par une lésion, du côté demandé. */
export function findingItems(slice: Slice, f: Finding, side: -1 | 0 | 1): SliceItem[] {
  return slice.items.filter((it) => {
    if (!it.id || !concerns(f.structure, it.id)) return false;
    if (!side) return true;
    const x = itemCenter(it)[0];
    return Math.abs(x) < 2 || Math.sign(x) === side;
  });
}

/** Bord externe (côté voûte) d'éléments de coupe : points les plus éloignés du centre, rangés par angle. */
function outerArc(items: SliceItem[]): Pt[] {
  const pts: Pt[] = [];
  for (const it of items) {
    const p = pathPoints(it.d);
    const max = Math.max(...p.map(([x, y]) => Math.hypot(x, y)));
    pts.push(...p.filter(([x, y]) => Math.hypot(x, y) > max * 0.9));
  }
  return pts.sort((a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
}

/** Collection extra-axiale le long d'un arc : lentille (épaisse au milieu) ou croissant (épaisseur constante). */
function extraAxial(arcPts: Pt[], thickness: number, lens: boolean): string {
  if (arcPts.length < 2) return "";
  const n = arcPts.length - 1;
  const inner = arcPts.map(([x, y], i) => {
    const s = i / n;
    const t = lens ? thickness * Math.sin(Math.PI * s) : thickness * Math.min(1, 5 * s, 5 * (1 - s));
    const len = Math.hypot(x, y) || 1;
    return [x - (x / len) * t, y - (y / len) * t] as Pt;
  });
  return `M${[...arcPts, ...inner.reverse()].map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("L")}Z`;
}

/** Densité / signal du sang selon son âge (hématome aigu hyperdense, chronique hypodense) et l'examen. */
function bloodValue(contrast: Contrast, stage = "aigu"): number {
  if (isCT(contrast)) return stage === "chronique" ? 70 : stage === "subaigu" ? 125 : contrast === "CT_BRAIN" ? 235 : 175;
  if (contrast === "T2STAR") return 20;
  if (contrast === "T1") return stage === "subaigu" ? 210 : 130;
  if (contrast === "FLAIR") return 190;
  return stage === "chronique" ? 220 : 70;
}

/** Lésions cérébrales (tête) : leur dessin dépend de la forme des lobes, du côté et de l'examen. */
function brainOverlays(slice: Slice, f: Finding, contrast: Contrast, out: Overlay[]): boolean {
  const rand = rng(f.id);
  for (const side of findingSides(f)) {
    const items = findingItems(slice, f, side);
    const cortex = items.filter((it) => it.tissue === "gm");
    const all = items.filter((it) => it.tissue === "gm" || it.tissue === "wm");
    switch (f.lesion) {
      case "hematome-extradural":
      case "hematome-sous-dural": {
        // Le sous-dural s'étale le long de tout l'hémisphère ; l'extradural reste en lentille sous l'os.
        const hemisphere = f.lesion === "hematome-sous-dural" ? slice.items.filter((it) => it.tissue === "gm" && it.id?.startsWith("lobe-") && (!side || Math.sign(itemCenter(it)[0]) === side)) : cortex;
        const d = extraAxial(outerArc(hemisphere), f.lesion === "hematome-extradural" ? 10 : 5, f.lesion === "hematome-extradural");
        if (d) out.push({ type: "path", d, fill: g(bloodValue(contrast, f.options.stade)), opacity: 0.95 });
        break;
      }
      case "hemorragie-sous-arachnoidienne":
        for (const p of outerArc(cortex).filter((_, i) => i % 3 === 1)) {
          const len = Math.hypot(p[0], p[1]) || 1;
          out.push({ type: "line", from: [p[0] * 0.97, p[1] * 0.97], to: [p[0] - (p[0] / len) * 6, p[1] - (p[1] / len) * 6], stroke: g(isCT(contrast) ? 220 : contrast === "FLAIR" ? 230 : 60), width: 1, opacity: 0.9 });
        }
        break;
      case "pneumencephalie":
        for (const p of outerArc(cortex).filter((_, i) => i % 4 === 0)) out.push({ type: "circle", at: [p[0] * 0.95, p[1] * 0.95], r: 1.4 + rand(), fill: g(0) });
        break;
      case "contusion-cerebrale":
      case "hematome-intracerebral": {
        const target = items.find((it) => it.tissue === "wm") ?? items[0];
        if (!target) break;
        const [cx, cy] = itemCenter(target);
        const r = f.lesion === "hematome-intracerebral" ? 7 : 5;
        // Œdème périlésionnel (hypodense, hypersignal T2), puis sang.
        out.push({ type: "circle", at: [cx, cy], r: r + 3, fill: g(isCT(contrast) ? 55 : fluidBright(contrast) || contrast === "FLAIR" ? 210 : 80), opacity: 0.6 });
        if (f.lesion === "hematome-intracerebral" || f.options.hemorragique === "oui") out.push({ type: "circle", at: [cx, cy], r, fill: g(bloodValue(contrast)), opacity: 0.95 });
        break;
      }
      case "avc-ischemique":
        for (const it of all) {
          const v = isCT(contrast) ? (f.options.phase === "precoce" ? 75 : 45) : contrast === "DWI" ? 235 : contrast === "FLAIR" || fluidBright(contrast) ? (f.options.phase === "precoce" ? 150 : 215) : 70;
          out.push({ type: "path", d: it.d, fill: g(v), opacity: 0.85 });
        }
        break;
      case "oedeme-cerebral":
        for (const it of all) out.push({ type: "path", d: it.d, fill: g(isCT(contrast) ? 60 : fluidBright(contrast) || contrast === "FLAIR" ? 200 : 80), opacity: 0.55 });
        break;
      case "lesions-axonales":
        if (contrast === "T2STAR" || contrast === "FLAIR" || contrast === "T2") {
          for (const it of all.filter((x) => x.tissue === "wm").slice(0, 3)) {
            const [cx, cy] = itemCenter(it);
            out.push({ type: "circle", at: [cx + (rand() - 0.5) * 8, cy + (rand() - 0.5) * 8], r: 1.2, fill: g(contrast === "T2STAR" ? 0 : 220) });
          }
        }
        break;
      case "hemorragie-intraventriculaire":
        for (const it of items) out.push({ type: "path", d: it.d, fill: g(bloodValue(contrast)), opacity: 0.9 });
        break;
      case "hydrocephalie":
        for (const it of items) {
          const [cx, cy] = itemCenter(it);
          out.push({ type: "path", d: it.d.replace(/-?\d+(\.\d+)?,-?\d+(\.\d+)?/g, (m) => { const [x, y] = m.split(",").map(Number); return `${(cx + (x - cx) * 1.6).toFixed(1)},${(cy + (y - cy) * 1.6).toFixed(1)}`; }), fill: g(isCT(contrast) ? 45 : fluidBright(contrast) ? 240 : 40) });
        }
        break;
      default:
        return false;
    }
  }
  // Effet de masse : la ligne médiane est refoulée vers le côté opposé.
  if (f.options.effet === "engagement" || f.options.engagement === "sous-falcoriel") {
    const side = findingSides(f)[0] || -1;
    out.push({ type: "path", d: `M0,-50 Q${-side * 9},0 0,50`, stroke: g(isCT(contrast) ? 170 : 30), width: 1.4, opacity: 0.9 });
  }
  return true;
}

/** Fracture de la voûte : trait radial à travers l'anneau osseux (et fragment enfoncé si embarrure). */
function skullFracture(items: SliceItem[], f: Finding, contrast: Contrast, out: Overlay[]) {
  for (const it of items.filter((x) => x.tissue === "bone")) {
    const pts = pathPoints(it.d);
    const [cx, cy] = itemCenter(it);
    const a = Math.atan2(cy, cx);
    const p = pts.reduce((best, q) => (Math.abs(Math.atan2(q[1], q[0]) - a) < Math.abs(Math.atan2(best[1], best[0]) - a) ? q : best));
    const r = Math.hypot(p[0], p[1]);
    const u: Pt = [Math.cos(a), Math.sin(a)];
    const gap = isCT(contrast) ? g(20) : g(fluidBright(contrast) ? 220 : 30);
    out.push({ type: "line", from: [u[0] * (r - 7), u[1] * (r - 7)], to: [u[0] * (r + 1), u[1] * (r + 1)], stroke: gap, width: 1.4 });
    if (f.options.crane === "embarrure") {
      const t: Pt = [-u[1], u[0]];
      const at = (k: number, s: number): Pt => [u[0] * (r - k) + t[0] * s, u[1] * (r - k) + t[1] * s];
      out.push({ type: "path", d: `M${at(6, 1).join(",")}L${at(6, 9).join(",")}L${at(10, 9).join(",")}L${at(10, 1).join(",")}Z`, fill: g(isCT(contrast) ? 250 : 15) });
    }
    return;
  }
}

/** Dessin des lésions présentes sur cette coupe. */
export function sliceOverlays(region: Region, slice: Slice, findings: Finding[], contrast: Contrast, injected: boolean): Overlay[] {
  const out: Overlay[] = [];
  for (const f of findings) {
    if (brainOverlays(slice, f, contrast, out)) continue;
    const side = findingSides(f)[0];
    const items = findingItems(slice, f, side);
    if ((f.lesion === "fracture" || f.lesion === "fissure") && region.byId.get(f.structure)?.tags?.includes("crane")) {
      skullFracture(items, f, contrast, out);
      continue;
    }
    // Parties molles d'un segment : la graisse sous-cutanée de la coupe, si elle est dans ce segment.
    const range = f.structure.endsWith("-pm") ? region.zoneRange(f.structure.slice(0, -3)) : undefined;
    const soft = range && slice.y >= range[0] && slice.y <= range[1] ? slice.items.find((it) => it.tissue === "fat") : undefined;
    const target = soft ?? items.find((it) => it.tissue !== "marrow") ?? items[0];
    if (!target) continue;
    let c = itemCenter(target);
    let r = itemRadius(target);
    if (soft) {
      // Sous la peau, face antérieure, plutôt qu'au centre du membre (où sont les os).
      const top = pathPoints(soft.d).reduce((a, b) => (b[1] < a[1] ? b : a));
      c = [top[0] + 6, top[1] + 6];
      r = 8;
    }
    const rand = rng(f.id);
    const bright = (v: number, opacity = 0.85): Overlay => ({ type: "path", d: target.d, fill: g(v), opacity });

    switch (f.lesion) {
      case "fracture":
      case "fissure": {
        const angle = rand() * Math.PI;
        // Le trait traverse l'os de part en part, sans déborder dans les parties molles.
        const dx = Math.cos(angle) * r * 1.15, dy = Math.sin(angle) * r * 1.15;
        const width = f.lesion === "fissure" ? 0.8 : f.options.deplacement && f.options.deplacement !== "non" ? 2.6 : 1.6;
        const gap = isCT(contrast) ? g(30) : g(fluidBright(contrast) ? 230 : 20);
        // Œdème autour du trait, visible en IRM sensible au liquide.
        if (fluidBright(contrast)) {
          const marrow = slice.items.find((it) => it.tissue === "marrow" && it.id && concerns(f.structure, it.id));
          if (marrow) out.push({ type: "path", d: marrow.d, fill: g(200), opacity: 0.6 });
        }
        const mid: Pt = [c[0] + (rand() - 0.5) * 2, c[1] + (rand() - 0.5) * 2];
        out.push({ type: "line", from: [c[0] - dx, c[1] - dy], to: mid, stroke: gap, width });
        out.push({ type: "line", from: mid, to: [c[0] + dx, c[1] + dy], stroke: gap, width });
        if (f.options.trait === "comminutif") {
          out.push({ type: "line", from: mid, to: [mid[0] + dy * 0.6, mid[1] - dx * 0.6], stroke: gap, width: width * 0.8 });
        }
        break;
      }
      case "oedeme-osseux": {
        const marrow = slice.items.find((it) => it.tissue === "marrow" && it.id && concerns(f.structure, it.id));
        if (marrow) out.push({ type: "path", d: marrow.d, fill: g(fluidBright(contrast) ? 215 : contrast === "T1" ? 70 : 60), opacity: 0.85 });
        break;
      }
      case "corps-etranger": {
        if (isCT(contrast)) {
          // Métal au scanner : très dense + artefacts « en étoile » (durcissement du faisceau).
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2 + rand() * 0.3;
            const len = 25 + rand() * 30;
            out.push({ type: "line", from: c, to: [c[0] + Math.cos(a) * len, c[1] + Math.sin(a) * len], stroke: i % 2 ? g(250) : g(10), width: 0.7, opacity: 0.55 });
          }
          out.push({ type: "circle", at: c, r: 3.2, fill: g(255) });
        } else {
          // Métal en IRM : vide de signal avec distorsion (et contre-indication !).
          out.push({ type: "circle", at: c, r: 9, fill: g(0), opacity: 0.9 });
          out.push({ type: "circle", at: [c[0] + 5, c[1] - 3], r: 4, fill: g(255), opacity: 0.5 });
        }
        break;
      }
      case "hematome": {
        const v = isCT(contrast) ? 168 : contrast === "T1" ? 150 : fluidBright(contrast) ? 205 : 120;
        out.push({ type: "circle", at: [c[0] + (rand() - 0.5) * r, c[1] + (rand() - 0.5) * r], r: Math.min(r, 10), fill: g(v), opacity: 0.9 });
        break;
      }
      case "epanchement":
      case "hemarthrose":
      case "collection":
        out.push(bright(isCT(contrast) ? (f.lesion === "hemarthrose" ? 150 : 110) : fluidBright(contrast) ? 245 : 70, 0.95));
        if (target.tissue === "joint") out.push({ type: "path", d: target.d, stroke: g(isCT(contrast) ? 120 : 245), width: 3, opacity: 0.8 });
        break;
      case "entorse":
      case "rupture-ligament":
      case "rupture-tendon":
      case "tendinopathie":
      case "lesion-labrum":
      case "lesion-menisque":
        if (fluidBright(contrast)) out.push(bright(f.lesion === "tendinopathie" ? 120 : 210));
        else if (!isCT(contrast)) out.push(bright(80, 0.7));
        if (f.lesion.startsWith("rupture") && f.options.etendue === "complete") {
          out.push({ type: "line", from: [c[0] - r, c[1]], to: [c[0] + r, c[1]], stroke: g(fluidBright(contrast) ? 245 : 40), width: 2.2 });
        }
        if (f.lesion === "lesion-menisque") {
          out.push({ type: "line", from: [c[0] - r * 0.6, c[1] - 1], to: [c[0] + r * 0.6, c[1] + 1], stroke: g(fluidBright(contrast) ? 240 : 150), width: 1.2 });
        }
        break;
      case "lesion-musculaire":
        // Aspect « en plumes » : hypersignal fat-sat (IRM), hypodensité discrète (scanner).
        for (let i = 0; i < 5; i++) {
          const a = rand() * Math.PI * 2;
          out.push({ type: "line", from: c, to: [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r * 0.6], stroke: g(fluidBright(contrast) ? 190 : isCT(contrast) ? 95 : 130), width: 2, opacity: 0.7 });
        }
        break;
      case "lesion-nerf":
        out.push(bright(fluidBright(contrast) ? 235 : 150));
        out.push({ type: "path", d: target.d, stroke: g(fluidBright(contrast) ? 220 : 140), width: 2, opacity: 0.7 });
        break;
      case "lesion-vasculaire":
        if (f.options.type === "occlusion") out.push(bright(isCT(contrast) ? 95 : 40, 1));
        else if (injected || contrast === "T1_GADO") {
          out.push({ type: "circle", at: [c[0] + 4 + rand() * 4, c[1] + 3], r: 6 + rand() * 4, fill: g(230), opacity: 0.85 });
        }
        break;
      case "thrombose":
        // Thrombus : défaut de remplissage au temps injecté, veine élargie ; sans injection, discrètement dense.
        out.push(bright(injected || contrast === "T1_GADO" ? (isCT(contrast) ? 95 : 70) : isCT(contrast) ? 150 : fluidBright(contrast) ? 160 : 120, 1));
        out.push({ type: "path", d: target.d, stroke: g(isCT(contrast) ? 160 : 200), width: 1.2, opacity: 0.8 });
        break;
      case "emphyseme":
        for (let i = 0; i < 9; i++) {
          out.push({ type: "circle", at: [c[0] + (rand() - 0.5) * r * 2, c[1] + (rand() - 0.5) * r * 1.4], r: 1 + rand() * 2, fill: g(0) });
        }
        break;
      case "tumefaction":
        out.push(bright(isCT(contrast) ? 90 : fluidBright(contrast) ? 120 : 150, 0.35));
        break;
      default:
        break;
    }
  }
  return out;
}
