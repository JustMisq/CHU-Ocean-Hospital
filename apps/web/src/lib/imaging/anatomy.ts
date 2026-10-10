import { boxOf, centroid, clipRect, pathPoints, type Box, type Pt } from "./geometry";
import type { Slice, Tissue } from "./slices";

/**
 * Socle commun des régions anatomiques (membre supérieur, membre inférieur…) : chaque région a son repère,
 * son arborescence de structures, ses os dessinés et ses coupes ; le moteur (carte, coupes, compte rendu)
 * ne connaît que ce socle.
 */

export type Modality = "RADIO" | "SCANNER" | "IRM";
export const ALL_MODALITIES: Modality[] = ["RADIO", "SCANNER", "IRM"];

export type Kind =
  | "region" | "segment" | "group" | "bone" | "part" | "joint"
  | "ligament" | "tendon" | "muscle" | "nerve" | "vessel" | "cartilage" | "soft"
  /** Organe plein (foie, rate, rein…), organe creux (tube digestif), poumon, voies aériennes. */
  | "organ" | "viscus" | "lung" | "airway"
  /** Espace où se collectent air, liquide ou sang (plèvre, péritoine, péricarde, espaces méningés). */
  | "cavity"
  | "brain" | "cord" | "disc";

/** Ce que voit chaque examen, par type de structure (une structure peut préciser les siens). */
export const SEEN_BY: Record<Kind, Modality[]> = {
  region: ALL_MODALITIES, segment: ALL_MODALITIES, group: ALL_MODALITIES, bone: ALL_MODALITIES, part: ALL_MODALITIES,
  joint: ALL_MODALITIES, soft: ALL_MODALITIES,
  muscle: ["SCANNER", "IRM"],
  vessel: ["SCANNER", "IRM"],
  ligament: ["IRM"],
  tendon: ["IRM"],
  nerve: ["IRM"],
  cartilage: ["IRM"],
  organ: ["SCANNER", "IRM"],
  viscus: ALL_MODALITIES,
  lung: ["RADIO", "SCANNER"],
  airway: ["RADIO", "SCANNER"],
  cavity: ALL_MODALITIES,
  brain: ["SCANNER", "IRM"],
  cord: ["IRM"],
  disc: ["SCANNER", "IRM"],
};

export type AnatomyNode = {
  id: string;
  label: string;
  /** Complément pour les phrases du compte rendu : « fracture DU RADIUS ». */
  of: string;
  kind: Kind;
  parent: string | null;
  /** Forme pleine (`d`) ou tracé (`stroke` = épaisseur) ; absente pour les groupes et les parties molles. */
  d?: string;
  stroke?: number;
  /** Forme fine (nerf, artère dessinés en surfaces) : zone de clic élargie de cette épaisseur. */
  hit?: number;
  /** Os dessiné : identifiant dans les os de la région. */
  art?: string;
  /** Partie d'un os : l'os découpé par ce rectangle (repère de la région). */
  clip?: Box;
  /** Examens qui montrent cette structure. */
  modalities: Modality[];
  /** Précisions pour les lésions possibles (ex : « veine » pour la thrombose). */
  tags?: string[];
  /** Dessinée d'après sa propre forme même quand la région a une illustration détaillée (veines, os ajoutés…). */
  draw?: boolean;
  /** Tissu pour les niveaux de gris scanner / IRM, si celui du type ne convient pas (ex : cœur). */
  tissue?: Tissue;
};

export type NodeInput = Omit<AnatomyNode, "modalities"> & { modalities?: Modality[] };

/**
 * Tracé d'une illustration : couleurs d'origine, réutilisées telles quelles dans l'atlas. `role` : rôle pour les rendus
 * radio et coupe (contour de l'os, ombrage, trait, ou à ignorer comme les disques), si les couleurs ne suffisent pas à le deviner.
 */
export type ArtPath = { d: string; fill: string; stroke?: string; sw?: number; role?: "base" | "shade" | "line" | "skip" };

/** Os dessiné d'une région. */
export type BoneArt = {
  paths: ArtPath[];
  /** Matrice SVG vers le repère de la région, si le dessin est dans un autre repère. */
  transform?: string;
  /** Contour (enveloppe convexe) dans le repère de la région : boîtes et repères des lésions. */
  hull: Pt[];
  /** Ne garder que cette partie du dessin (ex : moitié droite du bassin). */
  clip?: Box;
};

/** Systèmes anatomiques affichables séparément sur la carte. */
export const LAYERS = {
  os: "Os et articulations",
  muscles: "Muscles",
  tendons: "Tendons et ligaments",
  nerfs: "Système nerveux",
  vaisseaux: "Vaisseaux",
  organes: "Organes",
} as const;
export type Layer = keyof typeof LAYERS;
export const ALL_LAYERS = Object.keys(LAYERS) as Layer[];

/** Calque d'une structure (null : toujours affichée — régions, segments, groupes, parties molles). */
export function layerOf(kind: Kind): Layer | null {
  switch (kind) {
    case "bone": case "part": case "joint": case "disc": return "os";
    case "muscle": return "muscles";
    case "tendon": case "ligament": case "cartilage": return "tendons";
    case "nerve": case "brain": case "cord": return "nerfs";
    case "vessel": return "vaisseaux";
    case "organ": case "viscus": case "lung": case "airway": case "cavity": return "organes";
    default: return null;
  }
}

export type RegionDef = {
  id: string;
  label: string;
  /** « du membre inférieur » */
  of: string;
  /** Région paire (droite / gauche) : le côté gauche est dessiné en miroir. */
  bilateral: boolean;
  /** Miroir du côté gauche : x' = mirror − x. */
  mirror: number;
  /** Proportions de la carte (largeur / hauteur). */
  aspect: number;
  /** Échelle des détails (traits, repères, lésions) par rapport au membre supérieur. */
  unit: number;
  nodes: NodeInput[];
  /** Contour de la peau. */
  skin: string;
  bones: Record<string, BoneArt>;
  slices: Slice[];
  /** Zones proposées comme « zone examinée » (segments), avec leur hauteur [y0, y1]. */
  zones: { id: string; range: [number, number] }[];
  /** Libellés des deux bouts du curseur de coupes. */
  sliceEnds: [string, string];
  /**
   * Réglages du rendu « examen » : intensité des os en radio (`xrayBone`) et en coupe (`tissueBone`), gris des parties
   * molles en radio (`xraySoft`), tissu de fond des coupes (`tissueInterior`, muscle par défaut ; graisse médiastinale au thorax).
   * Le thorax baisse les côtes (sinon elles masquent les poumons) et éclaircit le médiastin. `tissueHole` : zone où les os
   * dessinés sont masqués en coupe (la boîte crânienne laisse voir le cerveau).
   */
  look?: { xrayBone?: number; tissueBone?: number; xraySoft?: string; tissueInterior?: Tissue; tissueHole?: string };
  /** Illustration détaillée (atlas), lourde : chargée seulement quand on l'affiche. */
  loadArt?: () => Promise<RegionArt>;
};

/**
 * Illustration détaillée d'une région : tracés aux couleurs d'origine, dans le repère de la région, rangés par calque
 * (`layers`) ou dans l'ordre de dessin d'origine avec leur calque (`ordered` : vaisseaux cachés derrière les organes…).
 */
export type RegionArt = { layers: Partial<Record<Layer, ArtPath[]>>; ordered?: (ArtPath & { layer: Layer })[] };

export type Region = Omit<RegionDef, "nodes"> & {
  nodes: AnatomyNode[];
  byId: Map<string, AnatomyNode>;
  root: AnatomyNode;
  childrenOf: (id: string) => AnatomyNode[];
  ancestry: (id: string) => AnatomyNode[];
  nodePoints: (id: string) => Pt[];
  frameOf: (id: string, mirrored: boolean, aspect: number) => Box;
  markerOf: (id: string) => Pt;
  visibleIn: (id: string, modality: Modality, layers?: readonly Layer[]) => boolean;
  /** Calques présents dans la région et visibles dans cet examen. */
  layersFor: (modality: Modality) => Layer[];
  /** Zone examinée (segment) qui contient une structure. */
  zoneOf: (id: string) => string;
  zoneRange: (id: string) => [number, number] | undefined;
};

/** A une forme dessinable (tracé propre ou os dessiné). */
export const hasShape = (n: AnatomyNode) => Boolean(n.d || n.art);

export function createRegion(def: RegionDef): Region {
  const nodes: AnatomyNode[] = def.nodes.map((n) => ({ ...n, modalities: n.modalities ?? SEEN_BY[n.kind] }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  if (byId.size !== nodes.length) throw new Error(`${def.id} : identifiant de structure en double`);
  const kids = new Map<string, AnatomyNode[]>();
  for (const n of nodes) if (n.parent) kids.set(n.parent, [...(kids.get(n.parent) ?? []), n]);
  const childrenOf = (id: string) => kids.get(id) ?? [];

  const ancestry = (id: string) => {
    const out: AnatomyNode[] = [];
    for (let n = byId.get(id); n; n = n.parent ? byId.get(n.parent) : undefined) out.unshift(n);
    return out;
  };

  /** `seen` : évite de tourner en rond (structure sans forme dont la zone est celle du parent, qui la contient). */
  const nodePoints = (id: string, seen = new Set<string>()): Pt[] => {
    const n = byId.get(id);
    if (!n || seen.has(id)) return [];
    seen.add(id);
    if (n.art) {
      const hull = def.bones[n.art]?.hull ?? [];
      if (!n.clip) return hull;
      // Partie d'os : contour de l'os découpé par le rectangle.
      const cut = clipRect(hull, n.clip);
      const [x, y, w, h] = n.clip;
      return cut.length >= 3 ? cut : [[x + w / 2, y + h / 2]];
    }
    if (!n.d) {
      const pts = childrenOf(id).flatMap((c) => nodePoints(c.id, seen));
      // Sans forme ni enfants (parties molles d'un segment) : la zone du segment parent.
      return pts.length || !n.parent ? pts : nodePoints(n.parent, seen);
    }
    return pathPoints(n.d);
  };

  const frameOf = (id: string, mirrored: boolean, aspect: number): Box => {
    const pts: Pt[] = nodePoints(id).map(([x, y]) => [mirrored ? def.mirror - x : x, y]);
    let [x, y, w, h] = pts.length ? boxOf(pts) : boxOf(nodePoints(nodes[0].id));
    const pad = Math.max(w, h) * 0.12 + 8 * def.unit;
    x -= pad; y -= pad; w += pad * 2; h += pad * 2;
    if (w / h < aspect) { const nw = h * aspect; x -= (nw - w) / 2; w = nw; }
    else { const nh = w / aspect; y -= (nh - h) / 2; h = nh; }
    return [x, y, w, h];
  };

  const markerOf = (id: string): Pt => {
    const pts = nodePoints(id);
    return centroid(pts.length ? pts : nodePoints(nodes[0].id));
  };

  const visibleIn = (id: string, modality: Modality, layers?: readonly Layer[]): boolean => {
    const n = byId.get(id);
    if (!n) return false;
    if (n.kind === "group" || n.kind === "region" || n.kind === "segment") return childrenOf(id).some((c) => visibleIn(c.id, modality, layers));
    const layer = layerOf(n.kind);
    return n.modalities.includes(modality) && (!layers || layer === null || layers.includes(layer));
  };

  const layersFor = (modality: Modality) =>
    (Object.keys(LAYERS) as Layer[]).filter((l) => nodes.some((n) => layerOf(n.kind) === l && n.modalities.includes(modality)));

  const zoneIds = new Set(def.zones.map((z) => z.id));
  const zoneOf = (id: string) => ancestry(id).find((n) => zoneIds.has(n.id))?.id ?? nodes[0].id;
  const zoneRange = (id: string) => def.zones.find((z) => z.id === id)?.range;

  return { ...def, nodes, byId, root: nodes[0], childrenOf, ancestry, nodePoints, frameOf, markerOf, visibleIn, layersFor, zoneOf, zoneRange };
}

/** Petit outil de construction : `add` empile les structures dans l'ordre (la première est la racine). */
export function nodeList() {
  const list: NodeInput[] = [];
  const add = (n: NodeInput) => {
    list.push(n);
    return n.id;
  };
  /** Ajoute des branches au tracé d'une structure déjà déclarée. */
  const extend = (id: string, extra: string[]) => {
    const n = list.find((x) => x.id === id)!;
    n.d = [n.d, ...extra].filter(Boolean).join(" ");
  };
  return { list, add, extend };
}
