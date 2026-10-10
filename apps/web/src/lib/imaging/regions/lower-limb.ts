import { createRegion, nodeList, type BoneArt, type Kind } from "../anatomy";
import { LOWER_LIMB_ARTERIES, LOWER_LIMB_MUSCLES, LOWER_LIMB_NERVES, LOWER_LIMB_SKIN, LOWER_LIMB_TENDONS } from "../atlas/lower-limb-shapes";
import { PLATE_BONES } from "../atlas/plate-bones";
import { boxOf, clipBand, ellipse, line, pathPoints, polygon, smooth, type Box, type Pt } from "../geometry";
import { LOWER_LIMB_SLICES } from "./lower-limb-slices";

/**
 * Membre inférieur DROIT vu de face, dans le repère de la planche du squelette entier (LadyofHats, 456 × 926) :
 * x vers la droite de l'écran = vers le milieu du corps (médial), y vers le bas. Le membre gauche est dessiné en miroir.
 *
 * Os : planche LadyofHats. Muscles, tendons, nerfs et artères : illustrations Servier Medical Art recalées sur la planche
 * (scripts/build-body.mts). Articulations, ligaments, ménisques et veines sont dessinés ici autour des os.
 */

const { list: nodes, add } = nodeList();

// ─── Repères tirés des os dessinés ───────────────────────────────────────────

const boneBox = (id: string): Box => boxOf(PLATE_BONES[id].hull as Pt[]);
const center = (id: string): Pt => {
  const [x, y, w, h] = boneBox(id);
  return [x + w / 2, y + h / 2];
};
/** Longueur d'un os : plus grande distance entre deux points de son contour. */
function length(id: string): number {
  const pts = PLATE_BONES[id].hull;
  let max = 0;
  for (const a of pts) for (const b of pts) max = Math.max(max, Math.hypot(a[0] - b[0], a[1] - b[1]));
  return max;
}
const mid = (a: Pt, b: Pt, t = 0.5): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** Interligne entre deux os qui se suivent (métatarsien → phalange…). */
function jointBetween(a: string, b: string): Pt {
  const la = length(a) / 2, lb = length(b) / 2;
  return mid(center(a), center(b), la / (la + lb));
}
/** Petite articulation entre deux os : ellipse perpendiculaire à leur axe. */
function jointShape(a: string, b: string, w: number) {
  const p = jointBetween(a, b);
  const [ca, cb] = [center(a), center(b)];
  const angle = (Math.atan2(cb[1] - ca[1], cb[0] - ca[0]) * 180) / Math.PI + 90;
  return ellipse(p[0], p[1], w, 1.6, angle);
}

// ─── Peau et segments ────────────────────────────────────────────────────────

const SKIN_POINTS = pathPoints(LOWER_LIMB_SKIN);

const SEGMENTS: [id: string, label: string, of: string, y0: number, y1: number][] = [
  ["hanche", "Hanche", "de la hanche", 360, 488],
  ["cuisse", "Cuisse", "de la cuisse", 488, 625],
  ["genou", "Genou", "du genou", 625, 700],
  ["jambe", "Jambe", "de la jambe", 700, 828],
  ["cheville", "Cheville", "de la cheville", 828, 858],
  ["pied", "Pied", "du pied", 858, 912],
];

add({ id: "membre-inf", label: "Membre inférieur", of: "du membre inférieur", kind: "region", parent: null, d: LOWER_LIMB_SKIN });
for (const [id, label, of, y0, y1] of SEGMENTS) {
  add({ id, label, of, kind: "segment", parent: "membre-inf", d: polygon(clipBand(SKIN_POINTS, y0, y1)) });
  add({ id: `${id}-pm`, label: "Parties molles", of: `des parties molles ${of}`, kind: "soft", parent: id });
}

const bone = (id: string, label: string, of: string, parent: string, art = id, tags?: string[]) => add({ id, label, of, kind: "bone", parent, art, ...(tags && { tags }) });
/** Partie d'un os : le dessin découpé par un rectangle (repère de la planche). */
const part = (id: string, label: string, of: string, parent: string, art: string, clip: Box, kind: Kind = "part", tags?: string[]) =>
  add({ id, label, of, kind, parent, art, clip, ...(tags && { tags }) });
const muscle = (id: string, label: string, of: string, parent: string) => add({ id, label, of, kind: "muscle", parent, d: LOWER_LIMB_MUSCLES[id] });
const nerve = (id: string, label: string, of: string, parent: string) => add({ id, label, of, kind: "nerve", parent, d: LOWER_LIMB_NERVES[id], hit: 3 });
const artery = (id: string, label: string, of: string, parent: string) => add({ id, label, of, kind: "vessel", parent, d: LOWER_LIMB_ARTERIES[id], hit: 2, tags: ["artere"] });
const vein = (id: string, label: string, of: string, parent: string, pts: Pt[], width = 2) =>
  add({ id, label, of, kind: "vessel", parent, d: line(pts), stroke: width, tags: ["veine"], draw: true });

// ─── Hanche ──────────────────────────────────────────────────────────────────

add({ id: "os-coxal", label: "Os coxal (hémi-bassin)", of: "de l'os coxal", kind: "group", parent: "hanche" });
part("aile-iliaque", "Aile iliaque", "de l'aile iliaque", "os-coxal", "os-coxal", [126, 366, 62, 50]);
part("cotyle", "Cotyle (acétabulum)", "du cotyle", "os-coxal", "os-coxal", [140, 416, 27, 32]);
part("pubis", "Branche ilio-pubienne (pubis)", "de la branche ilio-pubienne", "os-coxal", "os-coxal", [167, 432, 41, 20]);
part("ischion", "Ischion et branche ischio-pubienne", "de la branche ischio-pubienne", "os-coxal", "os-coxal", [146, 452, 62, 22]);

add({ id: "femur-prox", label: "Extrémité proximale du fémur", of: "de l'extrémité proximale du fémur", kind: "group", parent: "hanche" });
part("tete-femorale", "Tête fémorale", "de la tête fémorale", "femur-prox", "femur", [144, 425, 20, 22]);
part("col-femoral", "Col du fémur", "du col du fémur", "femur-prox", "femur", [137, 436, 11, 13], "part", ["col-femoral"]);
part("grand-trochanter", "Grand trochanter", "du grand trochanter", "femur-prox", "femur", [118, 438, 16, 18]);
part("massif-trochanterien", "Région pertrochantérienne", "de la région pertrochantérienne", "femur-prox", "femur", [121, 452, 44, 22]);
part("sous-trochanterien", "Région sous-trochantérienne", "de la région sous-trochantérienne", "femur-prox", "femur", [121, 474, 44, 16]);

add({ id: "coxo-femorale", label: "Articulation coxo-fémorale", of: "de la hanche", kind: "joint", parent: "hanche", d: ellipse(152.5, 435, 10.5, 10.5) });
add({ id: "labrum-cotyle", label: "Labrum acétabulaire", of: "du labrum acétabulaire", kind: "cartilage", parent: "hanche", d: line([[142, 432], [145, 425], [152, 422], [159, 423], [164, 428]]), stroke: 1.8, draw: true });
add({ id: "ligament-inguinal", label: "Ligament inguinal", of: "du ligament inguinal", kind: "ligament", parent: "hanche", d: LOWER_LIMB_TENDONS["ligament-inguinal"] });

add({ id: "muscles-hanche", label: "Muscles de la hanche", of: "des muscles de la hanche", kind: "group", parent: "hanche" });
muscle("moyen-fessier", "Moyen fessier", "du muscle moyen fessier", "muscles-hanche");
add({ id: "grand-fessier", label: "Grand fessier (face postérieure)", of: "du muscle grand fessier", kind: "muscle", parent: "muscles-hanche" });
muscle("tfl", "Tenseur du fascia lata", "du muscle tenseur du fascia lata", "muscles-hanche");
muscle("ilio-psoas", "Ilio-psoas", "du muscle ilio-psoas", "muscles-hanche");
muscle("pectine", "Pectiné", "du muscle pectiné", "muscles-hanche");

nerve("n-femoral", "Nerf fémoral", "du nerf fémoral", "hanche");
nerve("n-cutane-lat", "Nerf cutané latéral de la cuisse", "du nerf cutané latéral de la cuisse", "hanche");
artery("a-iliaque-ext", "Artère iliaque externe", "de l'artère iliaque externe", "hanche");

// ─── Cuisse ──────────────────────────────────────────────────────────────────

add({ id: "femur-diaphyse", label: "Diaphyse fémorale", of: "de la diaphyse fémorale", kind: "group", parent: "cuisse" });
part("femur-d1", "Tiers proximal", "du tiers proximal de la diaphyse fémorale", "femur-diaphyse", "femur", [125, 488, 50, 44]);
part("femur-d2", "Tiers moyen", "du tiers moyen de la diaphyse fémorale", "femur-diaphyse", "femur", [130, 532, 50, 44]);
part("femur-d3", "Tiers distal", "du tiers distal de la diaphyse fémorale", "femur-diaphyse", "femur", [138, 576, 50, 44]);

add({ id: "quadriceps", label: "Quadriceps", of: "du quadriceps", kind: "group", parent: "cuisse" });
muscle("droit-femoral", "Droit fémoral", "du muscle droit fémoral", "quadriceps");
muscle("vaste-lateral", "Vaste latéral", "du muscle vaste latéral", "quadriceps");
muscle("vaste-medial", "Vaste médial", "du muscle vaste médial", "quadriceps");
add({ id: "vaste-intermediaire", label: "Vaste intermédiaire (profond)", of: "du muscle vaste intermédiaire", kind: "muscle", parent: "quadriceps" });
muscle("sartorius", "Sartorius", "du muscle sartorius", "cuisse");
add({ id: "adducteurs", label: "Adducteurs", of: "des muscles adducteurs", kind: "group", parent: "cuisse" });
muscle("long-adducteur", "Long adducteur", "du muscle long adducteur", "adducteurs");
muscle("gracile", "Gracile", "du muscle gracile", "adducteurs");
add({ id: "ischio-jambiers", label: "Ischio-jambiers (face postérieure)", of: "des muscles ischio-jambiers", kind: "muscle", parent: "cuisse" });

nerve("n-sciatique", "Nerf sciatique", "du nerf sciatique", "cuisse");
nerve("n-obturateur", "Nerf obturateur", "du nerf obturateur", "cuisse");
artery("a-femorale", "Artère fémorale", "de l'artère fémorale", "cuisse");
artery("a-femorale-profonde", "Artère fémorale profonde", "de l'artère fémorale profonde", "cuisse");
vein("v-femorale", "Veine fémorale", "de la veine fémorale", "cuisse", [[165.5, 452], [163, 465], [162, 480], [162.5, 510], [164.5, 540], [168.5, 560], [172.5, 590], [176.5, 620], [179.5, 640]], 2.4);

// ─── Genou ───────────────────────────────────────────────────────────────────

add({ id: "femur-distal", label: "Extrémité distale du fémur", of: "de l'extrémité distale du fémur", kind: "group", parent: "genou" });
part("supracondylienne-femur", "Région supracondylienne", "de la région supracondylienne du fémur", "femur-distal", "femur", [145, 618, 62, 18]);
part("condyle-lat", "Condyle fémoral latéral", "du condyle fémoral latéral", "femur-distal", "femur", [146, 636, 28, 25]);
part("condyle-med", "Condyle fémoral médial", "du condyle fémoral médial", "femur-distal", "femur", [174, 636, 32, 25]);
bone("patella", "Patella (rotule)", "de la patella", "genou");

add({ id: "tibia-prox", label: "Extrémité proximale du tibia", of: "de l'extrémité proximale du tibia", kind: "group", parent: "genou" });
part("plateau-lat", "Plateau tibial latéral", "du plateau tibial latéral", "tibia-prox", "tibia", [153, 656, 25, 20], "part", ["plateau-tibial"]);
part("plateau-med", "Plateau tibial médial", "du plateau tibial médial", "tibia-prox", "tibia", [178, 656, 28, 20], "part", ["plateau-tibial"]);
part("tuberosite-tibiale", "Tubérosité tibiale", "de la tubérosité tibiale", "tibia-prox", "tibia", [168, 676, 18, 16]);
part("fibula-prox", "Tête et col de la fibula", "du col de la fibula", "genou", "fibula", [150, 672, 20, 26], "bone");

add({ id: "femoro-tibiale", label: "Articulation fémoro-tibiale", of: "du genou", kind: "joint", parent: "genou", d: ellipse(178, 660.5, 24, 3.2) });
add({ id: "femoro-patellaire", label: "Articulation fémoro-patellaire", of: "de l'articulation fémoro-patellaire", kind: "joint", parent: "genou", d: ellipse(176, 652, 9, 2.6) });
add({ id: "tibio-fibulaire-prox", label: "Articulation tibio-fibulaire proximale", of: "de l'articulation tibio-fibulaire proximale", kind: "joint", parent: "genou", d: ellipse(159.5, 677, 2.6, 4.6, -35) });

add({ id: "menisques", label: "Ménisques", of: "des ménisques", kind: "group", parent: "genou" });
add({ id: "menisque-med", label: "Ménisque médial", of: "du ménisque médial", kind: "cartilage", parent: "menisques", d: ellipse(191, 661.5, 10, 1.7), tags: ["menisque"], draw: true });
add({ id: "menisque-lat", label: "Ménisque latéral", of: "du ménisque latéral", kind: "cartilage", parent: "menisques", d: ellipse(165, 661.5, 9, 1.7), tags: ["menisque"], draw: true });
add({ id: "ligaments-genou", label: "Ligaments du genou", of: "des ligaments du genou", kind: "group", parent: "genou" });
add({ id: "lca", label: "Ligament croisé antérieur (LCA)", of: "du ligament croisé antérieur", kind: "ligament", parent: "ligaments-genou", d: line([[172, 649], [175, 657], [179, 667]]), stroke: 2.2, draw: true });
add({ id: "lcp", label: "Ligament croisé postérieur (LCP)", of: "du ligament croisé postérieur", kind: "ligament", parent: "ligaments-genou", d: line([[181, 649], [178.5, 657], [175, 668]]), stroke: 2.4, draw: true });
add({ id: "lcm-genou", label: "Ligament collatéral médial (LCM)", of: "du ligament collatéral médial du genou", kind: "ligament", parent: "ligaments-genou", d: line([[198.5, 638], [201, 652], [201.5, 666], [199, 690]]), stroke: 2.8, draw: true });
add({ id: "lcl-genou", label: "Ligament collatéral latéral (LCL)", of: "du ligament collatéral latéral du genou", kind: "ligament", parent: "ligaments-genou", d: line([[154, 640], [152.5, 655], [154, 668], [156.5, 678]]), stroke: 2.2, draw: true });
add({ id: "tendon-quadricipital", label: "Tendon quadricipital", of: "du tendon quadricipital", kind: "tendon", parent: "genou", d: LOWER_LIMB_TENDONS["tendon-quadricipital"] });
add({ id: "ligament-patellaire", label: "Ligament patellaire (tendon rotulien)", of: "du ligament patellaire", kind: "tendon", parent: "genou", d: LOWER_LIMB_TENDONS["ligament-patellaire"] });

nerve("n-fibulaire-commun", "Nerf fibulaire commun", "du nerf fibulaire commun", "genou");
artery("a-poplitee", "Artère poplitée", "de l'artère poplitée", "genou");
vein("v-poplitee", "Veine poplitée", "de la veine poplitée", "genou", [[179.5, 640], [182, 655], [183.5, 670], [184, 690]], 2.4);

// ─── Jambe ───────────────────────────────────────────────────────────────────

add({ id: "tibia-diaphyse", label: "Diaphyse tibiale", of: "de la diaphyse tibiale", kind: "group", parent: "jambe" });
part("tibia-d1", "Tiers proximal", "du tiers proximal de la diaphyse tibiale", "tibia-diaphyse", "tibia", [160, 692, 45, 46]);
part("tibia-d2", "Tiers moyen", "du tiers moyen de la diaphyse tibiale", "tibia-diaphyse", "tibia", [160, 738, 45, 46]);
part("tibia-d3", "Tiers distal", "du tiers distal de la diaphyse tibiale", "tibia-diaphyse", "tibia", [160, 784, 45, 46]);
part("fibula-diaphyse", "Diaphyse fibulaire", "de la diaphyse fibulaire", "jambe", "fibula", [148, 698, 32, 130], "bone");

add({ id: "loges-jambe", label: "Loges musculaires", of: "des loges musculaires de la jambe", kind: "group", parent: "jambe" });
muscle("loge-anterieure", "Loge antérieure (tibial antérieur, extenseurs)", "des muscles de la loge antérieure", "loges-jambe");
muscle("fibulaires", "Loge latérale (fibulaires)", "des muscles fibulaires", "loges-jambe");
add({ id: "loge-post-profonde", label: "Loge postérieure profonde (face postérieure)", of: "des muscles de la loge postérieure profonde", kind: "muscle", parent: "loges-jambe" });
add({ id: "triceps-sural", label: "Triceps sural (mollet)", of: "du triceps sural", kind: "group", parent: "loges-jambe" });
muscle("gastrocnemien", "Gastrocnémien", "du muscle gastrocnémien", "triceps-sural");
muscle("soleaire", "Soléaire", "du muscle soléaire", "triceps-sural");
add({ id: "tendon-achille", label: "Tendon calcanéen (d'Achille)", of: "du tendon calcanéen (d'Achille)", kind: "tendon", parent: "jambe", d: line([[181.5, 790], [181.5, 815], [182.5, 840], [183, 860]]), stroke: 3.2, draw: true });

nerve("n-tibial", "Nerf tibial", "du nerf tibial", "jambe");
nerve("n-fibulaire-superficiel", "Nerf fibulaire superficiel", "du nerf fibulaire superficiel", "jambe");
nerve("n-fibulaire-profond", "Nerf fibulaire profond", "du nerf fibulaire profond", "jambe");
nerve("n-saphene", "Nerf saphène", "du nerf saphène", "jambe");
artery("a-tibiale-ant", "Artère tibiale antérieure (et dorsale du pied)", "de l'artère tibiale antérieure", "jambe");
artery("a-tibiale-post", "Artère tibiale postérieure", "de l'artère tibiale postérieure", "jambe");
artery("a-fibulaire", "Artère fibulaire", "de l'artère fibulaire", "jambe");
vein("v-tibiales", "Veines tibiales postérieures", "des veines tibiales postérieures", "jambe", [[185.5, 697], [190.5, 720], [192.5, 760], [194.5, 815], [198, 829]], 2);
vein("v-grande-saphene", "Grande veine saphène", "de la grande veine saphène", "jambe", [
  [198.5, 842], [199.5, 820], [201, 790], [202, 760], [202.5, 730], [201.5, 700], [200.5, 680], [202, 660], [203, 630],
  [202.5, 600], [200, 570], [196, 540], [190, 510], [183, 485], [176, 470], [170, 465],
], 1.6);

// ─── Cheville ────────────────────────────────────────────────────────────────

part("pilon-tibial", "Pilon tibial", "du pilon tibial", "cheville", "tibia", [168, 828, 25, 23], "bone");
part("malleole-med", "Malléole médiale", "de la malléole médiale", "cheville", "tibia", [193, 826, 12, 26], "bone");
part("malleole-lat", "Malléole latérale", "de la malléole latérale", "cheville", "fibula", [158, 826, 20, 22], "bone", ["malleole-laterale"]);
bone("talus", "Talus (astragale)", "du talus", "cheville");

add({ id: "talo-crurale", label: "Articulation talo-crurale", of: "de la cheville", kind: "joint", parent: "cheville", d: ellipse(184, 849.5, 15, 2.4) });
add({ id: "ligaments-cheville", label: "Ligaments de la cheville", of: "des ligaments de la cheville", kind: "group", parent: "cheville" });
add({ id: "ltfa", label: "Ligament talo-fibulaire antérieur", of: "du ligament talo-fibulaire antérieur", kind: "ligament", parent: "ligaments-cheville", d: line([[168.5, 846], [172, 849.5], [175.5, 852.5]]), stroke: 2.2, draw: true });
add({ id: "lcf", label: "Ligament calcanéo-fibulaire", of: "du ligament calcanéo-fibulaire", kind: "ligament", parent: "ligaments-cheville", d: line([[166, 847], [165.5, 853], [166.5, 860]]), stroke: 2.2, draw: true });
add({ id: "ligament-deltoidien", label: "Ligament collatéral médial (deltoïdien)", of: "du ligament deltoïdien", kind: "ligament", parent: "ligaments-cheville", d: `${line([[199, 848], [197, 853], [195, 858]])} ${line([[201, 848], [201.5, 853], [201, 859]])}`, stroke: 2.4, draw: true });
add({ id: "syndesmose", label: "Syndesmose tibio-fibulaire", of: "de la syndesmose tibio-fibulaire", kind: "ligament", parent: "ligaments-cheville", d: line([[171.5, 832], [174, 837], [176.5, 842]]), stroke: 2.4, tags: ["syndesmose"], draw: true });
add({ id: "retinaculum-extenseurs", label: "Rétinaculum des extenseurs", of: "du rétinaculum des extenseurs", kind: "tendon", parent: "cheville", d: LOWER_LIMB_TENDONS["retinaculum-extenseurs"] });

// ─── Pied ────────────────────────────────────────────────────────────────────

add({ id: "tarse", label: "Tarse", of: "du tarse", kind: "group", parent: "pied" });
// Calcanéum : caché derrière le talus sur une vue de face, dessiné ici (la planche ne le montre pas).
add({
  id: "calcaneum", label: "Calcanéum", of: "du calcanéum", kind: "bone", parent: "tarse", draw: true,
  d: smooth([[178, 862], [187, 859], [195, 861], [199, 866], [197, 872], [189, 875], [181, 873], [176.5, 867.5]]),
});
bone("naviculaire", "Naviculaire (scaphoïde tarsien)", "du naviculaire", "tarse");
bone("cuboide", "Cuboïde", "du cuboïde", "tarse");
add({ id: "cuneiformes", label: "Cunéiformes", of: "des cunéiformes", kind: "group", parent: "tarse" });
bone("cuneiforme-med", "Cunéiforme médial", "du cunéiforme médial", "cuneiformes");
bone("cuneiforme-int", "Cunéiforme intermédiaire", "du cunéiforme intermédiaire", "cuneiformes");
bone("cuneiforme-lat", "Cunéiforme latéral", "du cunéiforme latéral", "cuneiformes");

add({ id: "sous-talienne", label: "Articulation sous-talienne", of: "de l'articulation sous-talienne", kind: "joint", parent: "pied", d: ellipse(185, 864, 10, 1.8) });
add({ id: "chopart", label: "Interligne de Chopart (médio-tarsien)", of: "de l'interligne de Chopart", kind: "joint", parent: "pied", d: ellipse(181, 857, 19, 1.8, 8) });
add({ id: "lisfranc", label: "Interligne de Lisfranc (tarso-métatarsien)", of: "de l'interligne de Lisfranc", kind: "joint", parent: "pied", d: ellipse(173, 862.5, 18, 1.8, 18), tags: ["lisfranc"] });
add({ id: "ligament-lisfranc", label: "Ligament de Lisfranc", of: "du ligament de Lisfranc", kind: "ligament", parent: "pied", d: line([[184.5, 863], [182, 866.5]]), stroke: 2, tags: ["lisfranc"], draw: true });

add({ id: "metatarsiens", label: "Métatarsiens", of: "des métatarsiens", kind: "group", parent: "pied" });
add({ id: "orteils", label: "Orteils", of: "des orteils", kind: "group", parent: "pied" });
const ROMAN = ["I", "II", "III", "IV", "V"];
const TOES = ["Hallux (gros orteil)", "2e orteil", "3e orteil", "4e orteil", "5e orteil"];
const TOE_OF = ["de l'hallux", "du 2e orteil", "du 3e orteil", "du 4e orteil", "du 5e orteil"];
for (let n = 1; n <= 5; n++) {
  const mt = `mt${n}`;
  bone(mt, `${ROMAN[n - 1]}e métatarsien`, `du ${ROMAN[n - 1]}e métatarsien`, "metatarsiens");
  if (n === 5) {
    // Base du 5e (tubérosité : fracture-avulsion, fracture de Jones) — la base est du côté du tarse (en haut à droite).
    const [x, y, w, h] = boneBox(mt);
    part("mt5-base", "Base (tubérosité)", "de la base du Ve métatarsien", mt, mt, [x + w * 0.62, y, w * 0.38 + 1, h * 0.36]);
    part("mt5-diaphyse", "Diaphyse", "de la diaphyse du Ve métatarsien", mt, mt, [x + w * 0.25, y + h * 0.3, w * 0.45, h * 0.45]);
    part("mt5-tete", "Col et tête", "du col du Ve métatarsien", mt, mt, [x - 1, y + h * 0.68, w * 0.36, h * 0.33]);
  }
  const toe = `orteil${n}`;
  add({ id: toe, label: TOES[n - 1], of: TOE_OF[n - 1], kind: "group", parent: "orteils" });
  add({ id: `${toe}-mtp`, label: "Articulation métatarso-phalangienne", of: `de la métatarso-phalangienne ${TOE_OF[n - 1]}`, kind: "joint", parent: toe, d: jointShape(mt, `${toe}-p1`, 3.2) });
  bone(`${toe}-p1`, "Phalange proximale", `de la phalange proximale ${TOE_OF[n - 1]}`, toe);
  bone(`${toe}-p2`, n === 1 ? "Phalange distale" : "Phalanges moyenne et distale", `de la phalange distale ${TOE_OF[n - 1]}`, toe);
  add({ id: `${toe}-ip`, label: "Articulation interphalangienne", of: `de l'interphalangienne ${TOE_OF[n - 1]}`, kind: "joint", parent: toe, d: jointShape(`${toe}-p1`, `${toe}-p2`, 2.4) });
}
muscle("pedieux", "Muscles du dos du pied (pédieux)", "des muscles du dos du pied", "pied");

// ─── Région ──────────────────────────────────────────────────────────────────

const BONES: Record<string, BoneArt> = Object.fromEntries(
  Object.entries(PLATE_BONES).map(([id, b]) => [id, { paths: b.paths, hull: b.hull as Pt[], ...(b.clip && { clip: b.clip }) }]),
);

export const LOWER_LIMB = createRegion({
  id: "membre-inf",
  label: "Membre inférieur",
  of: "du membre inférieur",
  bilateral: true,
  // Symétrique par rapport à la ligne médiane de la planche (symphyse pubienne, x = 207,4).
  mirror: 414.8,
  aspect: 0.5,
  unit: 0.42,
  nodes,
  skin: LOWER_LIMB_SKIN,
  bones: BONES,
  slices: LOWER_LIMB_SLICES,
  zones: SEGMENTS.map(([id, , , y0, y1]) => ({ id, range: [y0, y1] })),
  sliceEnds: ["Proximal", "Distal"],
  loadArt: () => import("../atlas/lower-limb-art").then((m) => m.LOWER_LIMB_ART),
});
