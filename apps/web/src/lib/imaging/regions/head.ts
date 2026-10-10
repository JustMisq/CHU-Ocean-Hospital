import { createRegion, nodeList, type BoneArt } from "../anatomy";
import { HEAD_BONE_ART, HEAD_BRAIN, HEAD_BRAIN_OUTLINE, HEAD_SKULL } from "../atlas/head-shapes";
import { line, smooth, type Pt } from "../geometry";
import { HEAD_SLICES } from "./head-slices";

/**
 * Tête et cou vus de profil (face à droite de l'écran), dans le repère de la figure du crâne Servier Medical Art.
 * Région médiane : le côté (droit / gauche) se précise lésion par lésion (étiquette « lateralise »).
 * Os du crâne découpés le long des sutures, cerveau recalé dans la boîte crânienne (scripts/build-body.mts).
 */

const { list: nodes, add } = nodeList();

/** Profil de la tête et du cou (peau). */
const SKIN = smooth([
  [438, 505], [436, 470], [428, 430], [412, 395], [395, 368], [372, 345], [356, 300], [354, 262], [362, 225], [385, 190], [420, 165],
  [470, 152], [520, 158], [560, 178], [588, 215], [597, 255], [595, 282], [600, 292], [612, 312], [618, 330], [606, 340], [602, 350],
  [606, 362], [602, 372], [606, 384], [598, 398], [600, 418], [594, 438], [575, 445], [552, 448], [540, 462], [538, 505],
] as Pt[]);

add({ id: "tete-cou", label: "Tête et cou", of: "de la tête et du cou", kind: "region", parent: null, d: SKIN });

// ─── Crâne et face ───────────────────────────────────────────────────────────

const LAT = ["lateralise"];
add({ id: "crane", label: "Crâne (voûte et base)", of: "du crâne", kind: "segment", parent: "tete-cou" });
const skull = (id: string, label: string, of: string, parent: string, tags: string[] = []) =>
  add({ id, label, of, kind: "bone", parent, d: HEAD_SKULL[id], draw: true, tags: [...LAT, ...tags] });
skull("os-frontal", "Os frontal", "de l'os frontal", "crane", ["crane"]);
skull("os-parietal", "Os pariétal", "de l'os pariétal", "crane", ["crane"]);
skull("os-temporal", "Os temporal (écaille et rocher)", "de l'os temporal", "crane", ["crane"]);
skull("os-occipital", "Os occipital", "de l'os occipital", "crane", ["crane"]);
skull("sphenoide", "Sphénoïde (grande aile)", "du sphénoïde", "crane", ["crane"]);

add({ id: "face", label: "Massif facial", of: "du massif facial", kind: "segment", parent: "tete-cou" });
skull("orbite", "Orbite (plancher et parois)", "de l'orbite", "face", ["f"]);
skull("os-nasal", "Os nasal", "des os propres du nez", "face");
skull("os-zygomatique", "Os zygomatique (malaire)", "de l'os zygomatique", "face");
skull("maxillaire", "Maxillaire", "du maxillaire", "face", ["maxillaire"]);
skull("mandibule", "Mandibule", "de la mandibule", "face", ["f"]);
add({ id: "dents", label: "Dents", of: "des dents", kind: "bone", parent: "face", d: HEAD_SKULL.dents, draw: true, tags: LAT });

// ─── Encéphale ───────────────────────────────────────────────────────────────

add({ id: "encephale", label: "Encéphale", of: "de l'encéphale", kind: "segment", parent: "tete-cou" });
const brain = (id: string, label: string, of: string, tags: string[] = []) =>
  add({ id, label, of, kind: "brain", parent: "encephale", d: HEAD_BRAIN[id], tags: [...LAT, ...tags] });
brain("lobe-frontal", "Lobe frontal", "du lobe frontal", ["convexite"]);
brain("lobe-parietal", "Lobe pariétal", "du lobe pariétal", ["convexite"]);
brain("lobe-temporal", "Lobe temporal", "du lobe temporal", ["convexite"]);
brain("lobe-occipital", "Lobe occipital", "du lobe occipital", ["convexite"]);
brain("cervelet", "Cervelet (fosse postérieure)", "de l'hémisphère cérébelleux", ["convexite"]);
add({ id: "tronc-cerebral", label: "Tronc cérébral", of: "du tronc cérébral", kind: "brain", parent: "encephale", d: HEAD_BRAIN["tronc-cerebral"] });
add({
  id: "noyaux-gris", label: "Noyaux gris centraux et thalamus", of: "des noyaux gris centraux", kind: "brain", parent: "encephale", draw: true, tags: LAT,
  d: smooth([[505, 250], [492, 240], [474, 243], [466, 256], [476, 268], [495, 266]]),
});
add({
  id: "ventricules", label: "Ventricules", of: "du système ventriculaire", kind: "cavity", parent: "encephale", draw: true, tissue: "fluid", tags: ["ventricule", ...LAT],
  d: [smooth([[522, 238], [505, 226], [480, 224], [452, 232], [440, 248], [446, 262], [456, 252], [470, 236], [495, 234], [515, 244]]), smooth([[446, 258], [454, 276], [470, 292], [476, 290], [462, 272], [452, 256]])].join(" "),
});

// ─── Vaisseaux ───────────────────────────────────────────────────────────────

add({ id: "vaisseaux-tete", label: "Vaisseaux", of: "des vaisseaux de la tête et du cou", kind: "group", parent: "tete-cou" });
const vessel = (id: string, label: string, of: string, pts: Pt[], width: number, tags: string[]) =>
  add({ id, label, of, kind: "vessel", parent: "vaisseaux-tete", d: line(pts), stroke: width, draw: true, tags });
vessel("carotide", "Artère carotide (commune et interne)", "de l'artère carotide", [[541, 505], [534, 470], [524, 440], [516, 405], [512, 372], [508, 346], [500, 318], [494, 300]], 3.4, ["artere", "f", ...LAT]);
vessel("artere-vertebrale", "Artère vertébrale", "de l'artère vertébrale", [[478, 505], [476, 470], [474, 430], [472, 398], [468, 372], [458, 356], [452, 340]], 2.6, ["artere", "f", ...LAT]);
vessel("artere-cerebrale-moyenne", "Artère cérébrale moyenne (sylvienne)", "de l'artère cérébrale moyenne", [[496, 300], [486, 286], [470, 276], [452, 268], [434, 262]], 2.2, ["artere", "f", ...LAT]);
vessel("artere-meningee-moyenne", "Artère méningée moyenne", "de l'artère méningée moyenne", [[492, 320], [494, 298], [488, 276], [478, 252], [462, 232]], 1.6, ["artere", "f", ...LAT]);
vessel("sinus-veineux", "Sinus veineux (sagittal, latéraux)", "des sinus veineux", [[560, 180], [520, 164], [470, 160], [420, 172], [386, 205], [370, 245], [372, 280], [390, 300], [420, 308]], 2.4, ["veine"]);

// ─── Cou ─────────────────────────────────────────────────────────────────────

add({ id: "cou", label: "Cou", of: "du cou", kind: "segment", parent: "tete-cou" });
add({ id: "pharynx", label: "Pharynx", of: "du pharynx", kind: "airway", parent: "cou", d: line([[522, 340], [520, 370], [522, 400], [530, 430], [538, 450]]), stroke: 7, draw: true });
add({ id: "larynx-trachee", label: "Larynx et trachée cervicale", of: "du larynx", kind: "airway", parent: "cou", d: line([[546, 440], [552, 465], [551, 505]]), stroke: 9, draw: true });
add({ id: "cou-pm", label: "Parties molles du cou", of: "des parties molles du cou", kind: "soft", parent: "cou", tags: LAT });
add({ id: "tete-pm", label: "Cuir chevelu et parties molles", of: "du cuir chevelu", kind: "soft", parent: "tete-cou", tags: LAT });

// ─── Région ──────────────────────────────────────────────────────────────────

const BONES: Record<string, BoneArt> = {
  crane: { paths: HEAD_BONE_ART.skull, hull: [] },
  "rachis-cervical-tete": { paths: HEAD_BONE_ART.spine, hull: [] },
};

export const HEAD = createRegion({
  id: "tete-cou",
  label: "Tête et cou",
  of: "de la tête et du cou",
  bilateral: false,
  mirror: 0,
  aspect: 0.8,
  unit: 0.8,
  nodes,
  skin: SKIN,
  bones: BONES,
  slices: HEAD_SLICES,
  zones: [{ id: "crane", range: [150, 360] }, { id: "face", range: [270, 445] }, { id: "encephale", range: [160, 360] }, { id: "cou", range: [340, 505] }],
  sliceEnds: ["Base", "Vertex"],
  // Coupe : la voûte n'est qu'un anneau autour du cerveau (le contour du cerveau est « creusé » dans les os).
  look: { xrayBone: 0.85, tissueBone: 0, xraySoft: "#4a4a4a", tissueHole: HEAD_BRAIN_OUTLINE },
  loadArt: () => import("../atlas/head-art").then((m) => m.HEAD_ART),
});
