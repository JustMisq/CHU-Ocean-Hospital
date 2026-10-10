import { createRegion, nodeList, type BoneArt, type Kind } from "../anatomy";
import { ABDOMEN_ORGANS, ABDOMEN_SKIN, ABDOMEN_VESSELS } from "../atlas/abdomen-shapes";
import { PLATE_BONES } from "../atlas/plate-bones";
import { ellipse, line, smooth, type Box, type Pt } from "../geometry";
import { ABDOMEN_SLICES } from "./abdomen-slices";

/**
 * Abdomen et bassin vus de face, dans le repère de la planche du squelette entier (LadyofHats) : le côté droit du patient
 * est à gauche de l'écran. Os : planche LadyofHats. Organes digestifs et urinaires, aorte et système porte : Servier Medical
 * Art recalé dans l'abdomen (scripts/build-body.mts). Veine cave, artères iliaques et psoas sont dessinés ici.
 */

const { list: nodes, add } = nodeList();
/** Ligne médiane de la planche (symphyse pubienne). */
const MID = 207.4;
/** Rectangle symétrique (côté gauche) d'un rectangle du côté droit. */
const mirrorBox = ([x, y, w, h]: Box): Box => [2 * MID - x - w, y, w, h];

add({ id: "abdomen", label: "Abdomen et bassin", of: "de l'abdomen et du bassin", kind: "region", parent: null, d: ABDOMEN_SKIN });

// ─── Organes pleins ──────────────────────────────────────────────────────────

const organ = (id: string, label: string, of: string, parent: string, extra: { kind?: Kind; tags?: string[]; tissue?: "liver" | "spleen" | "kidney" | "pancreas" | "fluid" | "bowel" } = {}) =>
  add({ id, label, of, kind: extra.kind ?? "organ", parent, d: ABDOMEN_ORGANS[id], ...(extra.tags && { tags: extra.tags }), ...(extra.tissue && { tissue: extra.tissue }) });

add({ id: "organes-pleins", label: "Organes pleins", of: "des organes pleins", kind: "group", parent: "abdomen" });
organ("foie", "Foie", "du foie", "organes-pleins", { tags: ["foie", "ombre"], tissue: "liver" });
organ("vesicule", "Vésicule biliaire", "de la vésicule biliaire", "organes-pleins", { kind: "viscus", tags: ["calcul", "vesicule"], tissue: "fluid" });
organ("rate", "Rate", "de la rate", "organes-pleins", { tags: ["rate", "ombre"], tissue: "spleen" });
organ("pancreas", "Pancréas", "du pancréas", "organes-pleins", { tags: ["pancreas"], tissue: "pancreas" });
organ("rein-d", "Rein droit", "du rein droit", "organes-pleins", { tags: ["rein", "calcul", "ombre"], tissue: "kidney" });
organ("rein-g", "Rein gauche", "du rein gauche", "organes-pleins", { tags: ["rein", "calcul", "ombre"], tissue: "kidney" });

// ─── Tube digestif ───────────────────────────────────────────────────────────

add({ id: "tube-digestif", label: "Tube digestif", of: "du tube digestif", kind: "group", parent: "abdomen" });
organ("estomac", "Estomac", "de l'estomac", "tube-digestif", { kind: "viscus", tags: ["gaz", "digestif"] });
organ("duodenum", "Duodénum", "du duodénum", "tube-digestif", { kind: "viscus", tags: ["digestif"] });
organ("grele", "Intestin grêle (jéjunum, iléon)", "de l'intestin grêle", "tube-digestif", { kind: "viscus", tags: ["digestif", "grele"] });
add({ id: "colon", label: "Côlon et rectum", of: "du côlon", kind: "group", parent: "tube-digestif" });
organ("caecum", "Cæcum et appendice", "du cæcum", "colon", { kind: "viscus", tags: ["gaz", "digestif", "appendice"] });
organ("colon-ascendant", "Côlon ascendant", "du côlon ascendant", "colon", { kind: "viscus", tags: ["gaz", "digestif"] });
organ("colon-transverse", "Côlon transverse", "du côlon transverse", "colon", { kind: "viscus", tags: ["gaz", "digestif"] });
organ("colon-descendant", "Côlon descendant", "du côlon descendant", "colon", { kind: "viscus", tags: ["gaz", "digestif"] });
organ("sigmoide", "Côlon sigmoïde", "du côlon sigmoïde", "colon", { kind: "viscus", tags: ["gaz", "digestif"] });
organ("rectum", "Rectum", "du rectum", "colon", { kind: "viscus", tags: ["gaz", "digestif"] });

// ─── Voies urinaires ─────────────────────────────────────────────────────────

add({ id: "voies-urinaires", label: "Voies urinaires", of: "des voies urinaires", kind: "group", parent: "abdomen" });
organ("ureteres", "Uretères", "des uretères", "voies-urinaires", { kind: "viscus", tags: ["calcul", "uretere"], tissue: "fluid" });
organ("vessie", "Vessie", "de la vessie", "voies-urinaires", { kind: "viscus", tags: ["vessie"], tissue: "fluid" });

// ─── Vaisseaux ───────────────────────────────────────────────────────────────

add({ id: "vaisseaux-abdominaux", label: "Vaisseaux", of: "des vaisseaux abdominaux", kind: "group", parent: "abdomen" });
add({ id: "aorte-abdominale", label: "Aorte abdominale et branches", of: "de l'aorte abdominale", kind: "vessel", parent: "vaisseaux-abdominaux", d: ABDOMEN_VESSELS["aorte-abdominale"], hit: 2, tags: ["artere", "aorte-abdo"] });
add({ id: "veine-porte", label: "Veine porte et mésentériques", of: "de la veine porte", kind: "vessel", parent: "vaisseaux-abdominaux", d: ABDOMEN_VESSELS["veine-porte"], hit: 2, tags: ["veine"] });
add({
  id: "veine-cave-inf", label: "Veine cave inférieure", of: "de la veine cave inférieure", kind: "vessel", parent: "vaisseaux-abdominaux", draw: true, stroke: 4.2, tags: ["veine"],
  d: line([[199.5, 302], [199, 330], [199, 360], [200, 385], [198, 393]] as Pt[]),
});
add({
  id: "vaisseaux-iliaques", label: "Artères et veines iliaques", of: "des vaisseaux iliaques", kind: "vessel", parent: "vaisseaux-abdominaux", draw: true, stroke: 2.6, tags: ["artere"],
  d: [line([[207, 386], [199, 398], [190, 410], [180, 428], [172, 446]]), line([[208, 386], [216, 398], [225, 410], [235, 428], [243, 446]]), line([[192, 404], [186, 412], [184, 426]]), line([[223, 404], [229, 412], [231, 426]])].join(" "),
});

// ─── Muscles, cavités, paroi ─────────────────────────────────────────────────

const PSOAS: Pt[] = [[197, 328], [195, 350], [191, 375], [185, 400], [178, 425], [170, 448], [166, 458], [172, 457], [181, 434], [191, 410], [198, 388], [200, 360], [200, 335]];
add({ id: "psoas-d", label: "Muscle psoas droit", of: "du muscle psoas droit", kind: "muscle", parent: "abdomen", draw: true, d: smooth(PSOAS), tags: ["ombre"] });
add({ id: "psoas-g", label: "Muscle psoas gauche", of: "du muscle psoas gauche", kind: "muscle", parent: "abdomen", draw: true, d: smooth(PSOAS.map(([x, y]) => [2 * MID - x, y] as Pt)), tags: ["ombre"] });
add({ id: "cavite-peritoneale", label: "Cavité péritonéale", of: "de la cavité péritonéale", kind: "cavity", parent: "abdomen", tags: ["peritoine"] });
add({ id: "retroperitoine", label: "Espace rétropéritonéal", of: "de l'espace rétropéritonéal", kind: "cavity", parent: "abdomen", tags: ["retroperitoine"] });
add({ id: "abdomen-pm", label: "Paroi abdominale", of: "de la paroi abdominale", kind: "soft", parent: "abdomen" });

// ─── Rachis lombaire ─────────────────────────────────────────────────────────

add({ id: "rachis-lombaire", label: "Rachis lombaire", of: "du rachis lombaire", kind: "group", parent: "abdomen" });
const LUMBAR: [n: number, y0: number, y1: number][] = [[1, 326, 341], [2, 341, 356], [3, 356, 370], [4, 370, 385], [5, 385, 407]];
for (const [n, y0, y1] of LUMBAR) {
  add({ id: `L${n}`, label: `Vertèbre L${n}`, of: `de la vertèbre L${n}`, kind: "part", parent: "rachis-lombaire", art: "rachis-lombaire", clip: [180, y0, 56, y1 - y0], tags: ["vertebre"] });
}

// ─── Bassin osseux ───────────────────────────────────────────────────────────

add({ id: "bassin-osseux", label: "Bassin osseux (anneau pelvien)", of: "du bassin", kind: "group", parent: "abdomen", tags: ["bassin"] });
/** Parties de l'os coxal (côté droit ; le gauche est symétrique). */
const COXAL: [id: string, label: string, of: string, feminine: boolean, clip: Box][] = [
  ["aile-iliaque", "Aile iliaque", "de l'aile iliaque", true, [126, 366, 62, 50]],
  ["cotyle", "Cotyle (acétabulum)", "du cotyle", false, [140, 416, 27, 32]],
  ["branche-ilio-pubienne", "Branche ilio-pubienne", "de la branche ilio-pubienne", true, [167, 432, 40, 20]],
  ["branche-ischio-pubienne", "Branche ischio-pubienne et ischion", "de la branche ischio-pubienne", true, [146, 452, 61, 22]],
];
for (const [s, side, art] of [["d", "droit", "os-coxal"], ["g", "gauche", "os-coxal-g"]] as const) {
  add({ id: `hemi-bassin-${s}`, label: `Os coxal ${side}`, of: `de l'os coxal ${side}`, kind: "group", parent: "bassin-osseux" });
  for (const [id, label, of, feminine, clip] of COXAL) {
    const adj = side === "droit" && feminine ? "droite" : side;
    add({ id: `${id}-${s}`, label: `${label} ${adj}`, of: `${of} ${adj}`, kind: "part", parent: `hemi-bassin-${s}`, art, clip: s === "d" ? clip : mirrorBox(clip) });
  }
}
add({ id: "sacrum", label: "Sacrum", of: "du sacrum", kind: "bone", parent: "bassin-osseux", art: "sacrum" });
add({ id: "coccyx", label: "Coccyx", of: "du coccyx", kind: "bone", parent: "bassin-osseux", art: "coccyx" });
add({ id: "symphyse-pubienne", label: "Symphyse pubienne", of: "de la symphyse pubienne", kind: "joint", parent: "bassin-osseux", d: ellipse(MID, 455, 2.4, 6.5), tags: ["symphyse"] });
add({ id: "sacro-iliaque-d", label: "Articulation sacro-iliaque droite", of: "de l'articulation sacro-iliaque droite", kind: "joint", parent: "bassin-osseux", d: ellipse(186, 412, 2.4, 12, -22), tags: ["sacro-iliaque"] });
add({ id: "sacro-iliaque-g", label: "Articulation sacro-iliaque gauche", of: "de l'articulation sacro-iliaque gauche", kind: "joint", parent: "bassin-osseux", d: ellipse(2 * MID - 186, 412, 2.4, 12, 22), tags: ["sacro-iliaque"] });

// ─── Région ──────────────────────────────────────────────────────────────────

/** Os dessinés (dans l'ordre) : côtes basses et têtes fémorales en contexte, sans structure cliquable. */
const BONE_IDS = [
  ...[9, 10, 11, 12].flatMap((n) => [`cote${n}-d`, `cote${n}-g`]),
  "rachis-lombaire", "sacrum", "coccyx", "os-coxal", "os-coxal-g", "femur-prox-d", "femur-prox-g",
];
const BONES: Record<string, BoneArt> = Object.fromEntries(
  BONE_IDS.map((id) => {
    const b = PLATE_BONES[id];
    return [id, { paths: b.paths, hull: b.hull as Pt[], ...(b.clip && { clip: b.clip }) }];
  }),
);

export const ABDOMEN = createRegion({
  id: "abdomen",
  label: "Abdomen et bassin",
  of: "de l'abdomen et du bassin",
  bilateral: false,
  mirror: 0,
  aspect: 0.86,
  unit: 0.42,
  nodes,
  skin: ABDOMEN_SKIN,
  bones: BONES,
  slices: ABDOMEN_SLICES,
  zones: [{ id: "rachis-lombaire", range: [324, 408] }, { id: "bassin-osseux", range: [362, 478] }],
  sliceEnds: ["Haut", "Bas"],
  look: { xrayBone: 0.62, tissueBone: 0.35, xraySoft: "#6a6a6a", tissueInterior: "fat" },
  loadArt: () => import("../atlas/abdomen-art").then((m) => m.ABDOMEN_ART),
});
