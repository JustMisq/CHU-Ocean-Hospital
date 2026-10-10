import { createRegion, nodeList, type BoneArt, type Kind } from "../anatomy";
import { ART_BONES, artBox, artCenter, artCorners, artLength, artTransform } from "../atlas";
import { clipBand, ellipse, line, longBone, polygon, sampleSmooth, smooth, type Box, type Pt } from "../geometry";
import { UPPER_LIMB_SLICES } from "./upper-limb-slices";

/**
 * Membre supérieur DROIT en position anatomique (paume vers l'avant), vu de face.
 * Repère : x vers la droite de l'écran = vers le milieu du corps (médial), y vers le bas.
 * Le membre gauche est dessiné en miroir (voir BodyMap).
 *
 * Les os sont les dessins de la planche LadyofHats (atlas/), recalés dans ce repère ;
 * peau, articulations, tendons, nerfs et vaisseaux sont dessinés ici autour d'eux.
 */

/** Fraction [x0, y0, x1, y1] de la boîte d'un os (0 = côté latéral / proximal, 1 = médial / distal). */
type Frac = [number, number, number, number];

const { list: nodes, add, extend } = nodeList();

/** Os dessiné, entier. */
const bone = (id: string, label: string, of: string, parent: string, art = id) => add({ id, label, of, kind: "bone", parent, art });

/** Rectangle correspondant à une fraction de la boîte de l'os (dans le repère du modèle). */
function fracBox(art: string, [fx0, fy0, fx1, fy1]: Frac): Box {
  const [x, y, w, h] = artBox(art);
  return [x + fx0 * w, y + fy0 * h, (fx1 - fx0) * w, (fy1 - fy0) * h];
}

/** Partie d'un os (ou région d'un os traitée comme un « os » dans l'arborescence, ex : palette humérale). */
const part = (id: string, label: string, of: string, parent: string, art: string, frac: Frac, kind: Kind = "part") =>
  add({ id, label, of, kind, parent, art, clip: fracBox(art, frac) });

const unit = (a: Pt, b: Pt): Pt => {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
};
const along = (p: Pt, u: Pt, k: number): Pt => [p[0] + u[0] * k, p[1] + u[1] * k];
const mid = (a: Pt, b: Pt, t = 0.5): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** Demi-longueur d'un os (le long de son grand axe). */
const halfLength = (art: string) => artLength(art) / 2;
/** Largeur approximative d'un os de la main : proportion de sa longueur (métacarpien fin, phalange distale trapue). */
const boneWidth = (art: string) => artLength(art) * (art.startsWith("mc") ? 0.24 : art.endsWith("p1") ? 0.3 : art.endsWith("p2") ? 0.36 : 0.45);
/** Interligne entre deux os qui se suivent (métacarpien → phalange…). */
function jointBetween(a: string, b: string): Pt {
  const la = halfLength(a), lb = halfLength(b);
  return mid(artCenter(a), artCenter(b), la / (la + lb));
}

// ─── Main : doigts recalés sur la planche ────────────────────────────────────

const FINGERS = [
  { n: 1, name: "Pouce", of: "du pouce", phalanges: 2 },
  { n: 2, name: "Index", of: "de l'index", phalanges: 3 },
  { n: 3, name: "Majeur", of: "du majeur", phalanges: 3 },
  { n: 4, name: "Annulaire", of: "de l'annulaire", phalanges: 3 },
  { n: 5, name: "Auriculaire", of: "de l'auriculaire", phalanges: 3 },
].map((f) => ({ ...f, mc: `mc${f.n}`, ph: Array.from({ length: f.phalanges }, (_, k) => `doigt${f.n}-p${k + 1}`) }));

/** Peau d'un doigt : capsule le long des os, du milieu du métacarpien au bout du doigt. */
function fingerSkin(f: (typeof FINGERS)[number]): string {
  const bones = [f.mc, ...f.ph];
  const centers = bones.map(artCenter);
  const last = bones[bones.length - 1];
  const u = unit(centers[centers.length - 2], centers[centers.length - 1]);
  const tip = along(centers[centers.length - 1], u, halfLength(last) + 3);
  const widths = bones.map((b, i) => boneWidth(b) * (i === 0 ? 2.6 : 2) + 3);
  return longBone([...centers, tip], [...widths, widths[widths.length - 1] * 0.8]);
}
const FINGER_SKIN = FINGERS.map(fingerSkin).join(" ");

// ─── Peau et segments ────────────────────────────────────────────────────────

/** Contour : membre + morceau de paroi thoracique sous l'épaule (où se projettent scapula et clavicule). */
const ARM: Pt[] = [
  [254, 150], [252, 30], [200, 2], [100, -10], [40, -6], [-8, 14], [-30, 60], [-34, 120], [-24, 200], [-14, 290], [-12, 380],
  [-18, 430], [-26, 500], [-22, 580], [-14, 650], [-14, 700], [-20, 745], [-22, 790], [-16, 835], [-4, 868], [30, 884],
  [70, 882], [104, 866], [116, 820], [110, 760], [100, 705], [102, 650], [110, 560], [116, 470], [108, 420], [104, 340],
  [104, 270], [116, 238], [160, 228], [214, 214], [244, 190],
];
const SKIN_POINTS = sampleSmooth(ARM, 8);
const SKIN = `${polygon(SKIN_POINTS)} ${FINGER_SKIN}`;

const SEGMENTS: [id: string, label: string, of: string, y0: number, y1: number][] = [
  ["epaule", "Épaule", "de l'épaule", -20, 160],
  ["bras", "Bras", "du bras", 160, 400],
  ["coude", "Coude", "du coude", 400, 505],
  ["avant-bras", "Avant-bras", "de l'avant-bras", 505, 685],
  ["poignet", "Poignet", "du poignet", 685, 790],
  ["main", "Main", "de la main", 790, 1100],
];

add({ id: "membre-sup", label: "Membre supérieur", of: "du membre supérieur", kind: "region", parent: null, d: SKIN });
for (const [id, label, of, y0, y1] of SEGMENTS) {
  const band = polygon(clipBand(SKIN_POINTS, y0, y1));
  add({ id, label, of, kind: "segment", parent: "membre-sup", d: id === "main" ? `${band} ${FINGER_SKIN}` : band });
  add({ id: `${id}-pm`, label: "Parties molles", of: `des parties molles ${of}`, kind: "soft", parent: id });
}

// ─── Épaule ──────────────────────────────────────────────────────────────────

bone("clavicule", "Clavicule", "de la clavicule", "epaule");
part("clavicule-lat", "Tiers latéral", "du tiers latéral de la clavicule", "clavicule", "clavicule", [0, 0, 0.34, 1]);
part("clavicule-moy", "Tiers moyen", "du tiers moyen de la clavicule", "clavicule", "clavicule", [0.34, 0, 0.67, 1]);
part("clavicule-med", "Tiers médial", "du tiers médial de la clavicule", "clavicule", "clavicule", [0.67, 0, 1, 1]);

bone("scapula", "Scapula (omoplate)", "de la scapula", "epaule");
part("acromion", "Acromion", "de l'acromion", "scapula", "scapula", [0, 0, 0.42, 0.2]);
part("coracoide", "Processus coracoïde", "du processus coracoïde", "scapula", "scapula", [0.3, 0.12, 0.62, 0.3]);
part("glene", "Glène", "de la glène", "scapula", "scapula", [0.36, 0.32, 0.47, 0.58]);
part("scapula-corps", "Corps de la scapula", "du corps de la scapula", "scapula", "scapula", [0.46, 0.33, 1, 1]);

// Humérus : extrémité proximale (épaule), diaphyse (bras), palette (coude).
part("humerus-prox", "Extrémité proximale de l'humérus", "de l'extrémité proximale de l'humérus", "epaule", "humerus", [0, 0, 1, 0.24], "bone");
part("tete-humerale", "Tête humérale", "de la tête humérale", "humerus-prox", "humerus", [0.42, 0, 1, 0.14]);
part("tubercule-majeur", "Tubercule majeur", "du tubercule majeur", "humerus-prox", "humerus", [0, 0, 0.42, 0.13]);
part("col-anatomique", "Col anatomique", "du col anatomique de l'humérus", "humerus-prox", "humerus", [0.3, 0.13, 1, 0.18]);
part("col-chirurgical", "Col chirurgical", "du col chirurgical de l'humérus", "humerus-prox", "humerus", [0, 0.18, 1, 0.24]);

// Repères relevés sur les os recalés : tête humérale ≈ (50, 92), glène ≈ x 78-84 / y 62-112,
// tubercule majeur ≈ (10, 84), acromion au-dessus de la tête, clavicule de (42, 10) à (236, 14).
const [cx, cy, cw, ch] = artBox("clavicule");
add({ id: "gleno-humerale", label: "Articulation gléno-humérale", of: "de l'articulation gléno-humérale", kind: "joint", parent: "epaule", d: ellipse(79, 88, 5, 22) });
add({ id: "acromio-claviculaire", label: "Articulation acromio-claviculaire", of: "de l'articulation acromio-claviculaire", kind: "joint", parent: "epaule", d: ellipse(cx + 4, cy + ch * 0.6, 8, 8) });
add({ id: "sterno-claviculaire", label: "Articulation sterno-claviculaire", of: "de l'articulation sterno-claviculaire", kind: "joint", parent: "epaule", d: ellipse(cx + cw - 4, cy + ch * 0.6, 9, 9) });

add({ id: "coiffe", label: "Coiffe des rotateurs", of: "de la coiffe des rotateurs", kind: "group", parent: "epaule" });
add({ id: "supra-epineux", label: "Supra-épineux", of: "du tendon supra-épineux", kind: "tendon", parent: "coiffe", d: line([[150, 32], [100, 40], [60, 60], [20, 76]]), stroke: 9 });
add({ id: "infra-epineux", label: "Infra-épineux", of: "du tendon infra-épineux", kind: "tendon", parent: "coiffe", d: line([[150, 120], [100, 104], [50, 96], [12, 96]]), stroke: 9 });
add({ id: "petit-rond", label: "Petit rond", of: "du tendon du petit rond", kind: "tendon", parent: "coiffe", d: line([[140, 170], [90, 130], [40, 112], [14, 110]]), stroke: 7 });
add({ id: "subscapulaire", label: "Subscapulaire", of: "du tendon subscapulaire", kind: "tendon", parent: "coiffe", d: line([[160, 110], [110, 104], [62, 104], [42, 104]]), stroke: 10 });
add({ id: "labrum", label: "Labrum glénoïdien", of: "du labrum glénoïdien", kind: "cartilage", parent: "epaule", d: line([[86, 66], [81, 80], [80, 98], [85, 114]]), stroke: 4 });
add({ id: "lcb", label: "Long chef du biceps", of: "du tendon du long chef du biceps", kind: "tendon", parent: "epaule", d: line([[82, 64], [56, 64], [38, 84], [32, 120], [32, 200]]), stroke: 4 });
add({ id: "bourse-sa", label: "Bourse sous-acromiale", of: "de la bourse sous-acromiale", kind: "soft", parent: "epaule", d: ellipse(40, 46, 26, 6, -8), modalities: ["SCANNER", "IRM"] });
// Deltoïde : triangle de l'acromion et du tiers latéral de la clavicule jusqu'à la tubérosité deltoïdienne.
add({ id: "deltoide", label: "Deltoïde", of: "du muscle deltoïde", kind: "muscle", parent: "epaule", d: smooth([[-10, 18], [20, 0], [60, 6], [86, 30], [66, 62], [42, 120], [26, 190], [14, 224], [0, 200], [-20, 140], [-28, 80]]) });
add({ id: "a-axillaire", label: "Artère axillaire", of: "de l'artère axillaire", kind: "vessel", parent: "epaule", d: line([[240, 80], [180, 108], [124, 136], [96, 150]]), stroke: 5 });
add({ id: "plexus", label: "Plexus brachial", of: "du plexus brachial", kind: "nerve", parent: "epaule", d: line([[244, 58], [184, 90], [128, 126], [100, 148]]), stroke: 5 });

// ─── Bras ────────────────────────────────────────────────────────────────────

part("humerus-diaphyse", "Diaphyse humérale", "de la diaphyse humérale", "bras", "humerus", [0, 0.24, 1, 0.82], "bone");
part("humerus-d1", "Tiers proximal", "du tiers proximal de la diaphyse humérale", "humerus-diaphyse", "humerus", [0, 0.24, 1, 0.43]);
part("humerus-d2", "Tiers moyen", "du tiers moyen de la diaphyse humérale", "humerus-diaphyse", "humerus", [0, 0.43, 1, 0.63]);
part("humerus-d3", "Tiers distal", "du tiers distal de la diaphyse humérale", "humerus-diaphyse", "humerus", [0, 0.63, 1, 0.82]);
// Biceps (ventre fusiforme), brachial (profond, moitié distale), triceps (postérieur : visible sur les deux bords).
add({ id: "biceps", label: "Biceps brachial", of: "du muscle biceps brachial", kind: "muscle", parent: "bras", d: smooth([[46, 120], [62, 170], [66, 260], [58, 350], [44, 402], [30, 404], [18, 350], [14, 260], [22, 170], [36, 120]]) });
add({ id: "brachial", label: "Brachial", of: "du muscle brachial", kind: "muscle", parent: "bras", d: smooth([[22, 300], [60, 300], [72, 380], [66, 440], [50, 476], [36, 470], [22, 420], [16, 360]]) });
add({ id: "triceps", label: "Triceps brachial", of: "du muscle triceps brachial", kind: "muscle", parent: "bras", d: `${smooth([[66, 150], [96, 240], [100, 340], [86, 420], [70, 444], [76, 360], [78, 260]])} ${smooth([[0, 200], [-14, 280], [-12, 360], [0, 420], [8, 360], [8, 280]])}` });
add({ id: "n-radial", label: "Nerf radial", of: "du nerf radial", kind: "nerve", parent: "bras", d: line([[98, 160], [74, 230], [36, 290], [0, 340], [-4, 420], [-6, 500], [-8, 600], [-12, 690], [-30, 760]]), stroke: 4 });
add({ id: "a-brachiale", label: "Artère brachiale", of: "de l'artère brachiale", kind: "vessel", parent: "bras", d: line([[96, 150], [86, 250], [74, 360], [58, 440], [48, 480]]), stroke: 5 });

// ─── Coude ───────────────────────────────────────────────────────────────────

part("humerus-distal", "Palette humérale", "de la palette humérale", "coude", "humerus", [0, 0.82, 1, 1], "bone");
part("supracondylienne", "Région supracondylienne", "de la région supracondylienne", "humerus-distal", "humerus", [0, 0.82, 1, 0.9]);
part("epicondyle-lat", "Épicondyle latéral", "de l'épicondyle latéral", "humerus-distal", "humerus", [0, 0.88, 0.22, 1]);
part("capitulum", "Capitulum", "du capitulum", "humerus-distal", "humerus", [0.22, 0.92, 0.5, 1]);
part("trochlee", "Trochlée", "de la trochlée", "humerus-distal", "humerus", [0.5, 0.92, 0.78, 1]);
part("epicondyle-med", "Épicondyle médial (épitrochlée)", "de l'épicondyle médial", "humerus-distal", "humerus", [0.78, 0.86, 1, 1]);

part("radius-prox", "Extrémité proximale du radius", "de l'extrémité proximale du radius", "coude", "radius", [0, 0, 1, 0.2], "bone");
part("tete-radiale", "Tête radiale", "de la tête radiale", "radius-prox", "radius", [0, 0, 1, 0.08]);
part("col-radial", "Col du radius", "du col du radius", "radius-prox", "radius", [0, 0.08, 1, 0.14]);
part("tuberosite-radiale", "Tubérosité radiale", "de la tubérosité radiale", "radius-prox", "radius", [0, 0.14, 1, 0.2]);
part("ulna-prox", "Extrémité proximale de l'ulna", "de l'extrémité proximale de l'ulna", "coude", "ulna", [0, 0, 1, 0.2], "bone");
part("olecrane", "Olécrâne", "de l'olécrâne", "ulna-prox", "ulna", [0, 0, 1, 0.1]);
part("coronoide", "Processus coronoïde", "du processus coronoïde", "ulna-prox", "ulna", [0, 0.1, 1, 0.2]);

add({ id: "humero-ulnaire", label: "Articulation huméro-ulnaire", of: "de l'articulation huméro-ulnaire", kind: "joint", parent: "coude", d: ellipse(58, 452, 16, 6) });
add({ id: "humero-radiale", label: "Articulation huméro-radiale", of: "de l'articulation huméro-radiale", kind: "joint", parent: "coude", d: ellipse(26, 454, 14, 5) });
add({ id: "radio-ulnaire-prox", label: "Articulation radio-ulnaire proximale", of: "de l'articulation radio-ulnaire proximale", kind: "joint", parent: "coude", d: ellipse(42, 470, 6, 9) });
add({ id: "lcm-coude", label: "Ligament collatéral médial (ulnaire)", of: "du ligament collatéral médial du coude", kind: "ligament", parent: "coude", d: line([[88, 424], [78, 446], [68, 470]]), stroke: 5 });
add({ id: "lcl-coude", label: "Ligament collatéral latéral (radial)", of: "du ligament collatéral latéral du coude", kind: "ligament", parent: "coude", d: line([[-2, 428], [4, 452], [10, 472]]), stroke: 5 });
add({ id: "lig-annulaire", label: "Ligament annulaire", of: "du ligament annulaire", kind: "ligament", parent: "coude", d: ellipse(25, 478, 20, 6), stroke: 3 });
add({ id: "biceps-distal", label: "Tendon distal du biceps", of: "du tendon distal du biceps", kind: "tendon", parent: "coude", d: line([[38, 420], [34, 470], [31, 503]]), stroke: 5 });
add({ id: "n-ulnaire", label: "Nerf ulnaire", of: "du nerf ulnaire", kind: "nerve", parent: "coude", d: line([[104, 170], [98, 300], [96, 420], [86, 480], [82, 600], [84, 700], [86, 760], [92, 820]]), stroke: 4 });
add({ id: "n-median", label: "Nerf médian", of: "du nerf médian", kind: "nerve", parent: "coude", d: line([[100, 155], [88, 260], [70, 380], [56, 450], [48, 530], [44, 640], [40, 720], [40, 770], [40, 820]]), stroke: 4 });

// ─── Avant-bras ──────────────────────────────────────────────────────────────

part("radius-diaphyse", "Diaphyse radiale", "de la diaphyse radiale", "avant-bras", "radius", [0, 0.2, 1, 0.86], "bone");
part("radius-d1", "Tiers proximal", "du tiers proximal de la diaphyse radiale", "radius-diaphyse", "radius", [0, 0.2, 1, 0.42]);
part("radius-d2", "Tiers moyen", "du tiers moyen de la diaphyse radiale", "radius-diaphyse", "radius", [0, 0.42, 1, 0.64]);
part("radius-d3", "Tiers distal", "du tiers distal de la diaphyse radiale", "radius-diaphyse", "radius", [0, 0.64, 1, 0.86]);
part("ulna-diaphyse", "Diaphyse ulnaire", "de la diaphyse ulnaire", "avant-bras", "ulna", [0, 0.2, 1, 0.88], "bone");
part("ulna-d1", "Tiers proximal", "du tiers proximal de la diaphyse ulnaire", "ulna-diaphyse", "ulna", [0, 0.2, 1, 0.43]);
part("ulna-d2", "Tiers moyen", "du tiers moyen de la diaphyse ulnaire", "ulna-diaphyse", "ulna", [0, 0.43, 1, 0.66]);
part("ulna-d3", "Tiers distal", "du tiers distal de la diaphyse ulnaire", "ulna-diaphyse", "ulna", [0, 0.66, 1, 0.88]);
add({ id: "membrane-io", label: "Membrane interosseuse", of: "de la membrane interosseuse", kind: "ligament", parent: "avant-bras", d: smooth([[34, 520], [56, 520], [62, 670], [26, 670]]) });
// Loge antérieure : rond pronateur (oblique), fléchisseur radial du carpe, long palmaire, fléchisseur ulnaire du carpe.
add({
  id: "flechisseurs",
  label: "Loge antérieure (fléchisseurs)",
  of: "des muscles fléchisseurs de l'avant-bras",
  kind: "muscle",
  parent: "avant-bras",
  d: [
    smooth([[86, 420], [96, 436], [62, 500], [26, 560], [14, 556], [40, 490], [72, 436]]),
    smooth([[80, 432], [90, 452], [72, 560], [52, 650], [42, 690], [36, 682], [48, 600], [64, 500]]),
    smooth([[90, 436], [96, 452], [74, 620], [54, 700], [50, 696], [64, 600], [82, 470]]),
    smooth([[98, 430], [108, 470], [102, 600], [88, 690], [82, 700], [86, 600], [92, 480]]),
  ].join(" "),
});
// Loge latérale : brachioradial et longs extenseurs radiaux du carpe.
add({
  id: "extenseurs",
  label: "Loge latérale et postérieure (extenseurs)",
  of: "des muscles extenseurs de l'avant-bras",
  kind: "muscle",
  parent: "avant-bras",
  d: [
    smooth([[-6, 360], [-18, 450], [-16, 560], [-8, 660], [2, 690], [8, 600], [4, 480], [2, 400]]),
    smooth([[2, 420], [-8, 470], [-6, 560], [2, 640], [8, 648], [10, 560], [12, 470]]),
  ].join(" "),
});
add({ id: "a-radiale", label: "Artère radiale", of: "de l'artère radiale", kind: "vessel", parent: "avant-bras", d: line([[46, 482], [26, 560], [4, 650], [-2, 700], [-8, 740]]), stroke: 4 });
add({ id: "a-ulnaire", label: "Artère ulnaire", of: "de l'artère ulnaire", kind: "vessel", parent: "avant-bras", d: line([[50, 482], [74, 560], [82, 650], [84, 720], [80, 770]]), stroke: 4 });

// ─── Poignet (extrémités distales, carpe) ────────────────────────────────────

part("radius-distal", "Extrémité distale du radius", "de l'extrémité distale du radius", "poignet", "radius", [0, 0.86, 1, 1], "bone");
part("radius-epiphyse", "Épiphyse radiale distale", "de l'épiphyse radiale distale", "radius-distal", "radius", [0.3, 0.86, 1, 1]);
part("styloide-radiale", "Styloïde radiale", "de la styloïde radiale", "radius-distal", "radius", [0, 0.86, 0.3, 1]);
part("ulna-distale", "Extrémité distale de l'ulna", "de l'extrémité distale de l'ulna", "poignet", "ulna", [0, 0.88, 1, 1], "bone");
part("styloide-ulnaire", "Styloïde ulnaire", "de la styloïde ulnaire", "ulna-distale", "ulna", [0.55, 0.93, 1, 1]);

add({ id: "carpe", label: "Carpe", of: "du carpe", kind: "group", parent: "poignet" });
bone("scaphoide", "Scaphoïde", "du scaphoïde", "carpe");
bone("lunatum", "Lunatum (semi-lunaire)", "du lunatum", "carpe");
bone("triquetrum", "Triquetrum (pyramidal)", "du triquetrum", "carpe");
bone("pisiforme", "Pisiforme", "du pisiforme", "carpe");
bone("trapeze", "Trapèze", "du trapèze", "carpe");
bone("trapezoide", "Trapézoïde", "du trapézoïde", "carpe");
bone("capitatum", "Capitatum (grand os)", "du capitatum", "carpe");
bone("hamatum", "Hamatum (os crochu)", "de l'hamatum", "carpe");

const [rx, , rw] = artBox("radius");
const [ux, uy, uw, uh] = artBox("ulna");
const scaphoid = artCenter("scaphoide"), lunate = artCenter("lunatum"), triquetrum = artCenter("triquetrum");
const proximalRow = mid(scaphoid, triquetrum);
add({ id: "radio-carpienne", label: "Articulation radio-carpienne", of: "de l'articulation radio-carpienne", kind: "joint", parent: "poignet", d: ellipse(proximalRow[0] - 4, proximalRow[1] - 10, 32, 5, -4) });
add({ id: "radio-ulnaire-dist", label: "Articulation radio-ulnaire distale", of: "de l'articulation radio-ulnaire distale", kind: "joint", parent: "poignet", d: ellipse((rx + rw + ux) / 2, uy + uh - 12, 5, 9) });
add({ id: "tfcc", label: "Complexe fibrocartilagineux triangulaire (TFCC)", of: "du complexe fibrocartilagineux triangulaire", kind: "cartilage", parent: "poignet", d: ellipse((ux + uw / 2 + triquetrum[0]) / 2, (uy + uh + triquetrum[1]) / 2, 9, 4) });
add({ id: "scapho-lunaire", label: "Ligament scapho-lunaire", of: "du ligament scapho-lunaire", kind: "ligament", parent: "poignet", d: line([mid(scaphoid, lunate, 0.4), mid(scaphoid, lunate, 0.6)]), stroke: 5 });
add({ id: "medio-carpienne", label: "Articulation médio-carpienne", of: "de l'articulation médio-carpienne", kind: "joint", parent: "carpe", d: ellipse(...mid(proximalRow, mid(artCenter("trapezoide"), artCenter("hamatum"))), 30, 4) });
add({ id: "canal-carpien", label: "Canal carpien (rétinaculum des fléchisseurs)", of: "du canal carpien", kind: "ligament", parent: "poignet", d: line([artCenter("trapeze"), mid(artCenter("capitatum"), artCenter("trapezoide")), artCenter("hamatum")]), stroke: 6 });

// ─── Main ────────────────────────────────────────────────────────────────────

add({ id: "metacarpiens", label: "Métacarpiens", of: "des métacarpiens", kind: "group", parent: "main" });
add({ id: "doigts", label: "Doigts", of: "des doigts", kind: "group", parent: "main" });

const ROMAN = ["I", "II", "III", "IV", "V"];
const WRIST: Pt = [44, 718];
for (const f of FINGERS) {
  const i = f.n - 1;
  bone(f.mc, `${ROMAN[i]}e métacarpien (${f.name.toLowerCase()})`, `du ${ROMAN[i]}e métacarpien`, "metacarpiens");
  // Base / diaphyse / col et tête : découpe le long du grand axe, la base étant du côté du poignet.
  const [bx, , bw, bh] = artBox(f.mc);
  const horizontal = bw > bh;
  const baseFirst = horizontal ? Math.abs(bx - WRIST[0]) < Math.abs(bx + bw - WRIST[0]) : true;
  const frac = (a: number, b: number): Frac => {
    const [s, e] = baseFirst ? [a, b] : [1 - b, 1 - a];
    return horizontal ? [s, 0, e, 1] : [0, s, 1, e];
  };
  part(`${f.mc}-base`, "Base", `de la base du ${ROMAN[i]}e métacarpien`, f.mc, f.mc, frac(0, 0.28));
  part(`${f.mc}-diaphyse`, "Diaphyse", `de la diaphyse du ${ROMAN[i]}e métacarpien`, f.mc, f.mc, frac(0.28, 0.72));
  part(`${f.mc}-col`, "Col et tête", `du col du ${ROMAN[i]}e métacarpien`, f.mc, f.mc, frac(0.72, 1));

  const finger = `doigt${f.n}`;
  add({ id: finger, label: f.name, of: f.of, kind: "group", parent: "doigts" });
  const names = f.phalanges === 2 ? ["proximale", "distale"] : ["proximale", "moyenne", "distale"];
  const seq = [f.mc, ...f.ph];
  const jointShape = (a: string, b: string) => {
    const p = jointBetween(a, b);
    const ax = unit(artCenter(a), artCenter(b));
    const w = boneWidth(b) * 0.8 + 1.5;
    return ellipse(p[0], p[1], w, 3, (Math.atan2(ax[1], ax[0]) * 180) / Math.PI + 90);
  };
  add({ id: `${finger}-mcp`, label: "Articulation métacarpo-phalangienne", of: `de la métacarpo-phalangienne ${f.of}`, kind: "joint", parent: finger, d: jointShape(f.mc, f.ph[0]) });
  f.ph.forEach((ph, k) => {
    bone(ph, `Phalange ${names[k]}`, `de la phalange ${names[k]} ${f.of}`, finger);
    if (k < f.ph.length - 1) {
      const ip = f.phalanges === 2 ? "interphalangienne" : k === 0 ? "interphalangienne proximale" : "interphalangienne distale";
      add({ id: `${finger}-ip${k + 1}`, label: `Articulation ${ip}`, of: `de l'${ip} ${f.of}`, kind: "joint", parent: finger, d: jointShape(seq[k + 1], seq[k + 2]) });
    }
  });
  if (f.n === 1) {
    // LCU du pouce : bord ulnaire (médial) de la métacarpo-phalangienne.
    const p = jointBetween(f.mc, f.ph[0]);
    const ax = unit(artCenter(f.mc), artCenter(f.ph[0]));
    const side: Pt = [-ax[1], ax[0]];
    const s = side[0] > 0 ? side : ([-side[0], -side[1]] as Pt); // vers le médial (+x)
    add({ id: "lcu-pouce", label: "Ligament collatéral ulnaire du pouce", of: "du ligament collatéral ulnaire du pouce", kind: "ligament", parent: finger, d: line([along(along(p, ax, -6), s, 5), along(along(p, ax, 6), s, 5)]), stroke: 4 });
  }
}

const tunnel = mid(artCenter("capitatum"), artCenter("trapezoide"));
add({
  id: "tendons-flech",
  label: "Tendons fléchisseurs",
  of: "des tendons fléchisseurs des doigts",
  kind: "tendon",
  parent: "main",
  d: FINGERS.map((f) => line([[40, 690], tunnel, jointBetween(f.mc, f.ph[0]), artCenter(f.ph[f.ph.length - 1])])).join(" "),
  stroke: 3,
});

// ─── Main : éminences, nerfs et artères digitaux ─────────────────────────────

const mc1 = artCenter("mc1"), mc5 = artCenter("mc5");
add({ id: "thenar", label: "Éminence thénar", of: "de l'éminence thénar", kind: "muscle", parent: "main", d: ellipse(mc1[0] + 8, mc1[1] + 10, 13, 22, 25) });
add({ id: "hypothenar", label: "Éminence hypothénar", of: "de l'éminence hypothénar", kind: "muscle", parent: "main", d: ellipse(mc5[0] + 2, mc5[1] - 4, 9, 24, -8) });

/**
 * Trajet le long d'un bord de doigt (nerf ou artère digitale propre) : du métacarpien au bout du doigt,
 * décalé du côté `side` (−1 = côté latéral/pouce, +1 = côté médial/auriculaire).
 */
function digitalPath(f: (typeof FINGERS)[number], side: -1 | 1, inset = 0.42): Pt[] {
  const bones = [f.mc, ...f.ph];
  const axis = unit(artCenter(f.mc), artCenter(bones[bones.length - 1]));
  // Perpendiculaire orientée vers le médial (+x) puis multipliée par `side`.
  let perp: Pt = [-axis[1], axis[0]];
  if (perp[0] < 0) perp = [-perp[0], -perp[1]];
  const offset = (p: Pt, b: string) => along(p, [perp[0] * side, perp[1] * side], boneWidth(b) * inset + 1.5);
  const start = offset(mid(artCenter(f.mc), jointBetween(f.mc, f.ph[0]), 0.6), f.mc);
  const pts = f.ph.map((ph) => offset(artCenter(ph), ph));
  const last = f.ph[f.ph.length - 1];
  return [start, ...pts, offset(along(artCenter(last), axis, halfLength(last) * 0.7), last)];
}
/** Point de la paume au pied d'un doigt (pour relier troncs et branches). */
const webSpace = (f: (typeof FINGERS)[number]) => mid(artCenter(f.mc), jointBetween(f.mc, f.ph[0]), 0.45);

const [thumb, index, middle, ring, little] = FINGERS;
const tunnelExit: Pt = mid(artCenter("capitatum"), artCenter("trapezoide"));
const guyon: Pt = along(artCenter("hamatum"), [1, 0], 6);

// Nerf médian : du canal carpien vers pouce, index, majeur et bord latéral de l'annulaire.
const medianBranches = [
  [tunnelExit, webSpace(thumb), ...digitalPath(thumb, -1)],
  [tunnelExit, webSpace(thumb), ...digitalPath(thumb, 1)],
  [tunnelExit, webSpace(index), ...digitalPath(index, -1)],
  [tunnelExit, webSpace(index), ...digitalPath(index, 1)],
  [tunnelExit, webSpace(middle), ...digitalPath(middle, -1)],
  [tunnelExit, webSpace(middle), ...digitalPath(middle, 1)],
  [tunnelExit, webSpace(ring), ...digitalPath(ring, -1)],
].map((pts) => line(pts as Pt[]));
// Nerf ulnaire : du canal de Guyon vers l'auriculaire et le bord médial de l'annulaire.
const ulnarBranches = [
  [guyon, webSpace(little), ...digitalPath(little, -1)],
  [guyon, webSpace(little), ...digitalPath(little, 1)],
  [guyon, webSpace(ring), ...digitalPath(ring, 1)],
].map((pts) => line(pts as Pt[]));
// Branche superficielle du nerf radial : face dorsale du pouce.
const radialBranch = line([[-30, 760], ...digitalPath(thumb, -1, 0.15)]);

// Arcade palmaire superficielle (ulnaire → thénar) et artères digitales propres.
const archPts: Pt[] = [guyon, ...[little, ring, middle, index].map((f) => mid(artCenter(f.mc), jointBetween(f.mc, f.ph[0]), 0.25)), along(artCenter("mc1"), [0, 1], 8)];
const digitalArteries = FINGERS.flatMap((f) => ([-1, 1] as const).map((s) => line([mid(artCenter(f.mc), jointBetween(f.mc, f.ph[0]), 0.25), ...digitalPath(f, s, 0.3)])));

// Nerfs et artères descendent jusqu'aux doigts.
extend("n-median", medianBranches);
extend("n-ulnaire", ulnarBranches);
extend("n-radial", [radialBranch]);
extend("a-ulnaire", [line(archPts), ...digitalArteries]);
extend("a-radiale", [line([[-8, 740], along(artCenter("mc1"), [0, 1], 8)])]);

// ─── Région ──────────────────────────────────────────────────────────────────

const BONES: Record<string, BoneArt> = Object.fromEntries(
  Object.entries(ART_BONES).map(([id, bone]) => [id, { paths: bone.paths, transform: artTransform(id), hull: artCorners(id) }]),
);

export const UPPER_LIMB = createRegion({
  id: "membre-sup",
  label: "Membre supérieur",
  of: "du membre supérieur",
  bilateral: true,
  mirror: 162,
  aspect: 0.62,
  unit: 1,
  nodes,
  skin: SKIN,
  bones: BONES,
  slices: UPPER_LIMB_SLICES,
  zones: SEGMENTS.map(([id, , , y0, y1]) => ({ id, range: [y0, y1] })),
  sliceEnds: ["Proximal", "Distal"],
});

