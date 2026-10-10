import { createRegion, nodeList, type BoneArt } from "../anatomy";
import { PLATE_BONES } from "../atlas/plate-bones";
import { THORAX_HEART, THORAX_LINES, THORAX_LOBES, THORAX_SKIN, THORAX_TRACHEA, THORAX_VESSELS } from "../atlas/thorax-shapes";
import { line, type Box, type Pt } from "../geometry";
import { THORAX_SLICES } from "./thorax-slices";

/**
 * Thorax vu de face, dans le repère de la planche du squelette entier (LadyofHats) : le côté droit du patient est à gauche
 * de l'écran. Os : planche LadyofHats (côte par côte). Poumons (par lobe), trachée, cœur et gros vaisseaux : Servier Medical
 * Art recalé dans la cage thoracique (scripts/build-body.mts). Plèvres et coupoles diaphragmatiques suivent les poumons.
 */

const { list: nodes, add } = nodeList();

add({ id: "thorax", label: "Thorax", of: "du thorax", kind: "region", parent: null, d: THORAX_SKIN });

// ─── Cage thoracique ─────────────────────────────────────────────────────────

add({ id: "cage-thoracique", label: "Cage thoracique", of: "de la cage thoracique", kind: "group", parent: "thorax" });
const SIDES = [["d", "droite", "droites"], ["g", "gauche", "gauches"]] as const;
for (const [s, side, sides] of SIDES) {
  add({ id: `cotes-${s}`, label: `Côtes ${sides}`, of: `des côtes ${sides}`, kind: "group", parent: "cage-thoracique", tags: ["cotes"] });
  for (let n = 1; n <= 12; n++) {
    const nth = n === 1 ? "1re" : `${n}e`;
    add({ id: `cote${n}-${s}`, label: `${nth} côte ${side}`, of: `de la ${nth} côte ${side}`, kind: "bone", parent: `cotes-${s}`, art: `cote${n}-${s}` });
  }
}
add({ id: "cartilages-costaux", label: "Cartilages costaux", of: "des cartilages costaux", kind: "bone", parent: "cage-thoracique", art: "cartilages-costaux" });
add({ id: "sternum", label: "Sternum", of: "du sternum", kind: "group", parent: "cage-thoracique" });
add({ id: "manubrium", label: "Manubrium", of: "du manubrium sternal", kind: "bone", parent: "sternum", art: "manubrium" });
const XIPHOID_Y = 271;
add({ id: "sternum-corps-part", label: "Corps du sternum", of: "du corps du sternum", kind: "part", parent: "sternum", art: "sternum-corps", clip: [190, 200, 40, XIPHOID_Y - 200] as Box });
add({ id: "xiphoide", label: "Processus xiphoïde", of: "du processus xiphoïde", kind: "part", parent: "sternum", art: "sternum-corps", clip: [190, XIPHOID_Y, 40, 20] as Box });
add({ id: "clavicule-d", label: "Clavicule droite", of: "de la clavicule droite", kind: "bone", parent: "cage-thoracique", art: "clavicule-d" });
add({ id: "clavicule-g", label: "Clavicule gauche", of: "de la clavicule gauche", kind: "bone", parent: "cage-thoracique", art: "clavicule-g" });
add({ id: "scapula-d", label: "Scapula droite", of: "de la scapula droite", kind: "bone", parent: "cage-thoracique", art: "scapula-d" });
add({ id: "scapula-g", label: "Scapula gauche", of: "de la scapula gauche", kind: "bone", parent: "cage-thoracique", art: "scapula-g" });
add({ id: "rachis-dorsal", label: "Rachis dorsal (vertèbres thoraciques)", of: "du rachis dorsal", kind: "bone", parent: "cage-thoracique", art: "rachis-dorsal" });

// ─── Poumons et plèvres ──────────────────────────────────────────────────────

add({ id: "poumons", label: "Poumons et plèvres", of: "des poumons", kind: "group", parent: "thorax" });
add({ id: "poumon-d", label: "Poumon droit", of: "du poumon droit", kind: "group", parent: "poumons" });
add({ id: "lsd", label: "Lobe supérieur droit", of: "du lobe supérieur droit", kind: "lung", parent: "poumon-d", d: THORAX_LOBES.lsd });
add({ id: "lmd", label: "Lobe moyen", of: "du lobe moyen", kind: "lung", parent: "poumon-d", d: THORAX_LOBES.lmd });
add({ id: "lid", label: "Lobe inférieur droit", of: "du lobe inférieur droit", kind: "lung", parent: "poumon-d", d: THORAX_LOBES.lid });
add({ id: "poumon-g", label: "Poumon gauche", of: "du poumon gauche", kind: "group", parent: "poumons" });
add({ id: "lsg", label: "Lobe supérieur gauche (et lingula)", of: "du lobe supérieur gauche", kind: "lung", parent: "poumon-g", d: THORAX_LOBES.lsg });
add({ id: "lig", label: "Lobe inférieur gauche", of: "du lobe inférieur gauche", kind: "lung", parent: "poumon-g", d: THORAX_LOBES.lig });
add({ id: "plevre-d", label: "Plèvre droite", of: "de la plèvre droite", kind: "cavity", parent: "poumons", d: THORAX_LINES["plevre-d"], stroke: 2.4, tags: ["plevre"] });
add({ id: "plevre-g", label: "Plèvre gauche", of: "de la plèvre gauche", kind: "cavity", parent: "poumons", d: THORAX_LINES["plevre-g"], stroke: 2.4, tags: ["plevre"] });
add({ id: "trachee", label: "Trachée et bronches souches", of: "de la trachée", kind: "airway", parent: "poumons", d: THORAX_TRACHEA });

// ─── Médiastin ───────────────────────────────────────────────────────────────

add({ id: "mediastin", label: "Médiastin et cœur", of: "du médiastin", kind: "group", parent: "thorax" });
add({ id: "coeur", label: "Cœur", of: "du cœur", kind: "organ", parent: "mediastin", d: THORAX_HEART, tissue: "heart", tags: ["coeur"], modalities: ["RADIO", "SCANNER", "IRM"] });
add({ id: "pericarde", label: "Péricarde", of: "du péricarde", kind: "cavity", parent: "mediastin", d: THORAX_HEART, stroke: 2, tags: ["pericarde"] });
const vessel = (id: string, label: string, of: string, tags: string[], extra: { modalities?: ("RADIO" | "SCANNER" | "IRM")[] } = {}) =>
  add({ id, label, of, kind: "vessel", parent: "mediastin", d: THORAX_VESSELS[id], hit: 2, tags, ...extra });
vessel("aorte", "Aorte thoracique", "de l'aorte thoracique", ["artere", "aorte"], { modalities: ["RADIO", "SCANNER", "IRM"] });
vessel("troncs-supra-aortiques", "Troncs supra-aortiques", "des troncs supra-aortiques", ["artere"]);
vessel("arteres-pulmonaires", "Tronc et artères pulmonaires", "des artères pulmonaires", ["artere", "artere-pulmonaire"]);
vessel("veines-pulmonaires", "Veines pulmonaires", "des veines pulmonaires", ["veine"]);
vessel("vcs", "Veine cave supérieure", "de la veine cave supérieure", ["veine"]);
vessel("troncs-veineux", "Troncs veineux brachio-céphaliques", "des troncs veineux brachio-céphaliques", ["veine"]);
vessel("vci", "Veine cave inférieure (segment thoracique)", "de la veine cave inférieure", ["veine"]);
add({
  id: "oesophage", label: "Œsophage", of: "de l'œsophage", kind: "viscus", parent: "mediastin", draw: true, stroke: 3.2, modalities: ["SCANNER", "IRM"],
  d: line([[210.5, 170], [211, 190], [212, 215], [213.5, 245], [215, 275], [218, 300], [222, 314]] as Pt[]),
});
add({ id: "espace-mediastinal", label: "Espace médiastinal", of: "du médiastin", kind: "cavity", parent: "mediastin", tags: ["mediastin"] });

// ─── Diaphragme et paroi ─────────────────────────────────────────────────────

add({ id: "diaphragme", label: "Diaphragme", of: "du diaphragme", kind: "muscle", parent: "thorax", d: `${THORAX_LINES["diaphragme-d"]} ${THORAX_LINES["diaphragme-g"]}`, stroke: 2.4, draw: true, tags: ["diaphragme"], modalities: ["RADIO", "SCANNER", "IRM"] });
add({ id: "thorax-pm", label: "Parties molles de la paroi", of: "des parties molles de la paroi thoracique", kind: "soft", parent: "thorax" });

// ─── Région ──────────────────────────────────────────────────────────────────

const BONE_IDS = [
  "scapula-d", "scapula-g", "rachis-dorsal",
  ...["d", "g"].flatMap((s) => Array.from({ length: 12 }, (_, i) => `cote${i + 1}-${s}`)),
  "cartilages-costaux", "manubrium", "sternum-corps", "clavicule-d", "clavicule-g",
];
const BONES: Record<string, BoneArt> = Object.fromEntries(
  BONE_IDS.map((id) => {
    const b = PLATE_BONES[id];
    return [id, { paths: b.paths, hull: b.hull as Pt[], ...(b.clip && { clip: b.clip }) }];
  }),
);

export const THORAX = createRegion({
  id: "thorax",
  label: "Thorax",
  of: "du thorax",
  bilateral: false,
  mirror: 0,
  aspect: 0.86,
  unit: 0.42,
  nodes,
  skin: THORAX_SKIN,
  bones: BONES,
  slices: THORAX_SLICES,
  zones: [],
  sliceEnds: ["Haut", "Bas"],
  look: { xrayBone: 0.32, tissueBone: 0.2, xraySoft: "#7c7c7c", tissueInterior: "fat" },
  loadArt: () => import("../atlas/thorax-art").then((m) => m.THORAX_ART),
});
