import { createRegion, nodeList, type BoneArt } from "../anatomy";
import { SPINE_ART, SPINE_CANAL, SPINE_DISCS, SPINE_VERTEBRAE } from "../atlas/spine-shapes";
import { line, pathPoints, smooth, type Pt } from "../geometry";
import { SPINE_SLICES } from "./spine-slices";

/**
 * Rachis entier vu de profil (avant à droite de l'écran), dans le repère de la figure Servier Medical Art.
 * Vertèbres et disques découpés dans le dessin (scripts/build-body.mts) ; canal, moelle et queue de cheval dessinés ici.
 */

const { list: nodes, add } = nodeList();

/** Silhouette du tronc et du cou en coupe sagittale (schématique), autour du rachis. */
const SKIN = smooth([
  [688, 96], [676, 130], [664, 165], [646, 205], [636, 250], [636, 295], [646, 340], [650, 370], [640, 405], [636, 445], [648, 482],
  [700, 490], [752, 476], [778, 430], [786, 370], [790, 310], [790, 250], [778, 200], [752, 172], [738, 150], [736, 120], [742, 98],
]);

add({ id: "rachis", label: "Rachis", of: "du rachis", kind: "region", parent: null, d: SKIN });

const SEGMENTS: [id: string, label: string, of: string, levels: string[]][] = [
  ["rachis-cervical", "Rachis cervical", "du rachis cervical", ["C1", "C2", "C3", "C4", "C5", "C6", "C7"]],
  ["rachis-thoracique", "Rachis thoracique (dorsal)", "du rachis thoracique", Array.from({ length: 12 }, (_, i) => `T${i + 1}`)],
  ["rachis-lombo-sacre", "Rachis lombaire et sacrum", "du rachis lombo-sacré", ["L1", "L2", "L3", "L4", "L5", "sacrum", "coccyx"]],
];
const NAMES: Record<string, string> = { C1: "C1 (atlas)", C2: "C2 (axis)", sacrum: "Sacrum", coccyx: "Coccyx" };
for (const [seg, label, of, levels] of SEGMENTS) {
  add({ id: seg, label, of, kind: "segment", parent: "rachis" });
  for (const level of levels) {
    const name = NAMES[level] ?? `Vertèbre ${level}`;
    add({
      id: `vert-${level}`, label: name, of: level === "sacrum" || level === "coccyx" ? `du ${level}` : `de la vertèbre ${level}`,
      kind: "bone", parent: seg, d: SPINE_VERTEBRAE[level], tags: ["vertebre"], draw: true,
    });
  }
}

// Disques : rattachés au segment de la vertèbre du dessus.
for (const [id, d] of Object.entries(SPINE_DISCS)) {
  const upper = id.split("-")[0];
  const seg = upper.startsWith("C") ? "rachis-cervical" : upper.startsWith("T") ? "rachis-thoracique" : "rachis-lombo-sacre";
  add({ id: `disque-${id}`, label: `Disque ${id}`, of: `du disque ${id}`, kind: "disc", parent: seg, d, tags: ["disque"] });
}

// ─── Canal et moelle ─────────────────────────────────────────────────────────

/** Point du canal à la hauteur y (interpolé sur l'axe du canal). */
function canalAt(y: number): Pt {
  const pts = SPINE_CANAL as Pt[];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    if (y <= y1) return [x0 + ((x1 - x0) * Math.max(0, y - y0)) / (y1 - y0), y];
  }
  return pts[pts.length - 1];
}
const canalLine = (y0: number, y1: number, step = 6) => {
  const out: Pt[] = [];
  for (let y = y0; y < y1; y += step) out.push(canalAt(y));
  out.push(canalAt(y1));
  return line(out);
};
add({ id: "canal-rachidien", label: "Canal rachidien (espace épidural)", of: "du canal rachidien", kind: "cavity", parent: "rachis", d: canalLine(108, 412), stroke: 7, tags: ["canal"] });
add({ id: "moelle", label: "Moelle épinière", of: "de la moelle épinière", kind: "group", parent: "rachis" });
add({ id: "moelle-cervicale", label: "Moelle cervicale", of: "de la moelle cervicale", kind: "cord", parent: "moelle", d: canalLine(108, 168), stroke: 3.2, draw: true, tags: ["moelle"] });
add({ id: "moelle-thoracique", label: "Moelle thoracique", of: "de la moelle thoracique", kind: "cord", parent: "moelle", d: canalLine(168, 300), stroke: 2.8, draw: true, tags: ["moelle"] });
add({ id: "cone-terminal", label: "Cône terminal", of: "du cône terminal", kind: "cord", parent: "moelle", d: canalLine(300, 318, 4), stroke: 2.4, draw: true, tags: ["moelle"] });
add({ id: "queue-de-cheval", label: "Queue de cheval", of: "de la queue de cheval", kind: "nerve", parent: "moelle", d: canalLine(318, 405), stroke: 1.8, draw: true });
add({ id: "rachis-pm", label: "Parties molles paravertébrales", of: "des parties molles paravertébrales", kind: "soft", parent: "rachis" });

// ─── Région ──────────────────────────────────────────────────────────────────

const BONES: Record<string, BoneArt> = {
  rachis: { paths: SPINE_ART, hull: Object.values(SPINE_VERTEBRAE).flatMap((d) => pathPoints(d)) },
};

export const SPINE = createRegion({
  id: "rachis",
  label: "Rachis",
  of: "du rachis",
  bilateral: false,
  mirror: 0,
  aspect: 0.45,
  unit: 0.55,
  nodes,
  skin: SKIN,
  bones: BONES,
  slices: SPINE_SLICES,
  zones: [{ id: "rachis-cervical", range: [100, 168] }, { id: "rachis-thoracique", range: [168, 309] }, { id: "rachis-lombo-sacre", range: [309, 480] }],
  sliceEnds: ["Haut", "Bas"],
  // En coupe, les vertèbres sont rendues d'après leur découpage (contour net) plutôt que d'après le dessin.
  look: { xrayBone: 0.9, tissueBone: 0, xraySoft: "#4a4a4a" },
});
