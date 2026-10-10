import type { AnatomyNode, Kind, Modality } from "./anatomy";
import { ancestryOf, findNode, regionOfNode } from "./regions";

/**
 * Catalogue médical de l'imagerie : techniques, lésions possibles selon la structure et l'examen,
 * phrases du compte rendu. Partagé entre l'éditeur (navigateur) et la validation (serveur).
 * Références : voir atlas/source/SOURCES.md (classifications de Garden, Schatzker, Danis-Weber…).
 */

export const MODALITIES: Record<Modality, { label: string; short: string; title: string; description: string }> = {
  RADIO: {
    label: "Radiographie",
    short: "Radio",
    title: "Radiographie",
    description: "Rayons X, image plane : os, alignement, corps étrangers radio-opaques. Examen de première intention.",
  },
  SCANNER: {
    label: "Scanner (tomodensitométrie)",
    short: "Scanner",
    title: "Scanner",
    description: "Rayons X en coupes : fractures complexes, hémorragies, vaisseaux (avec injection). Examen de l'urgence.",
  },
  IRM: {
    label: "IRM",
    short: "IRM",
    title: "IRM",
    description: "Champ magnétique, sans rayons X : ligaments, tendons, muscles, nerfs, œdème osseux, fractures occultes.",
  },
};

/** Incidences radiographiques usuelles, par zone examinée. */
export const RADIO_VIEWS: Record<string, string[]> = {
  epaule: ["Face (rotations neutre, interne, externe)", "Profil de Lamy (coiffe)", "Profil axillaire", "Incidence de Garth"],
  bras: ["Face", "Profil"],
  coude: ["Face", "Profil", "Incidences obliques (tête radiale)"],
  "avant-bras": ["Face", "Profil (prenant coude et poignet)"],
  poignet: ["Face", "Profil", "Incidences du scaphoïde (Schreck)"],
  main: ["Face", "3/4 (oblique)", "Profil du doigt"],
  hanche: ["Bassin de face", "Hanche de face", "Profil chirurgical d'Arcelin", "Faux profil de Lequesne"],
  cuisse: ["Fémur de face", "Fémur de profil (prenant hanche et genou)"],
  genou: ["Face", "Profil (rayon horizontal)", "Défilé fémoro-patellaire à 30°", "Incidences obliques (3/4)"],
  jambe: ["Face", "Profil (prenant genou et cheville)"],
  cheville: ["Face", "Profil", "Face en rotation interne de 20° (mortaise)"],
  pied: ["Face dorso-plantaire", "3/4 (oblique)", "Profil", "Calcanéum en incidence rétro-tibiale"],
  thorax: ["Face (debout, en inspiration)", "Face couché (lit du patient)", "Profil", "Grill costal (incidences obliques)"],
  abdomen: ["Abdomen sans préparation (ASP) couché", "ASP debout", "Coupoles debout (pneumopéritoine)", "Décubitus latéral gauche"],
  "bassin-osseux": ["Bassin de face", "Incidence inlet (entrée du bassin)", "Incidence outlet (sortie du bassin)", "Incidences de Judet (cotyles)"],
  "rachis-lombaire": ["Face", "Profil", "Clichés dynamiques (flexion / extension)"],
  rachis: ["Rachis entier de face", "Rachis entier de profil (EOS / grand cliché)"],
  "rachis-cervical": ["Face", "Profil", "Face bouche ouverte (C1-C2)", "Clichés dynamiques (flexion / extension)"],
  "rachis-thoracique": ["Face", "Profil"],
  "rachis-lombo-sacre": ["Face", "Profil", "Clichés dynamiques (flexion / extension)"],
  "tete-cou": ["Crâne de face", "Crâne de profil", "Incidence de Blondeau (sinus, face)", "Panoramique dentaire"],
};
export const DEFAULT_RADIO_VIEWS = ["Face", "Profil"];

export const CT_OPTIONS = {
  injection: [
    ["sans", "Sans injection"],
    ["arteriel", "Avec injection iodée, temps artériel (angioscanner)"],
    ["veineux", "Avec injection iodée, temps veineux"],
  ],
  reconstructions: ["Reconstructions multiplanaires (MPR)", "Reconstructions 3D (VRT)"],
} as const;

export const MRI_SEQUENCES = ["T1", "T2", "DP Fat-Sat (densité de protons)", "STIR", "T1 Fat-Sat après gadolinium", "Diffusion"];
export const MRI_PLANES = ["Axial", "Coronal", "Sagittal"];

/** Un réglage d'une lésion (ex : déplacement « déplacée »), éventuellement réservé à certaines structures. */
/**
 * Un réglage d'une lésion (ex : déplacement « déplacée »), éventuellement réservé à certaines structures (`tags`).
 * `side` : côté de la lésion, écrit juste après la structure (« du lobe temporal droit »). `after` : réglage écrit après
 * la structure (« … du lobe temporal droit, avec engagement »).
 */
type LesionOption = { name: string; label: string; choices: [value: string, label: string][]; tags?: string[]; side?: boolean; after?: boolean };

export type LesionType = {
  id: string;
  label: string;
  /** Types de structures concernés. */
  kinds: Kind[];
  modalities: Modality[];
  /** Réservée aux structures portant l'une de ces étiquettes (ex : « veine »). */
  tags?: string[];
  /** Exclue des structures portant l'une de ces étiquettes. */
  notTags?: string[];
  options?: LesionOption[];
  /** Avertissement affiché dans l'éditeur (ex : IRM et métal). */
  warning?: string;
  /** Lésion située « en regard » de la structure plutôt que dans celle-ci (hématome extradural en regard du lobe temporal). */
  regard?: boolean;
};

const ALL: Modality[] = ["RADIO", "SCANNER", "IRM"];
const BONE: Kind[] = ["bone", "part"];

export const LESIONS: LesionType[] = [
  {
    id: "fracture",
    label: "Fracture",
    kinds: BONE,
    modalities: ALL,
    options: [
      // Libellés accordés avec « fracture » : « fracture à trait oblique », « fracture comminutive »…
      { name: "trait", label: "Trait", choices: [["transversal", "à trait transversal"], ["oblique", "à trait oblique"], ["spiroide", "spiroïde"], ["comminutif", "comminutive"], ["bois-vert", "en bois vert"], ["avulsion", "par avulsion (arrachement)"], ["tassement", "par tassement"]] },
      { name: "deplacement", label: "Déplacement", choices: [["non", "non déplacée"], ["deplacee", "déplacée"], ["angulee", "angulée"], ["chevauchement", "avec chevauchement"]] },
      { name: "articulaire", label: "Atteinte articulaire", choices: [["non", "extra-articulaire"], ["oui", "intra-articulaire"]] },
      {
        name: "garden",
        label: "Classification de Garden",
        tags: ["col-femoral"],
        choices: [["1", "Garden I (incomplète, engrenée en valgus)"], ["2", "Garden II (complète, non déplacée)"], ["3", "Garden III (déplacée en varus, fragments en contact)"], ["4", "Garden IV (déplacement complet)"]],
      },
      {
        name: "schatzker",
        label: "Classification de Schatzker",
        tags: ["plateau-tibial"],
        choices: [
          ["1", "Schatzker I (séparation du plateau latéral)"], ["2", "Schatzker II (séparation-enfoncement latéral)"], ["3", "Schatzker III (enfoncement pur latéral)"],
          ["4", "Schatzker IV (plateau médial)"], ["5", "Schatzker V (bitubérositaire)"], ["6", "Schatzker VI (avec disjonction métaphyso-diaphysaire)"],
        ],
      },
      {
        name: "crane",
        label: "Type",
        tags: ["crane"],
        choices: [["lineaire", "linéaire"], ["embarrure", "avec embarrure"], ["ouverte", "ouverte (plaie en regard)"], ["base", "irradiant à la base du crâne"]],
      },
      {
        name: "lefort",
        label: "Classification de Le Fort",
        tags: ["maxillaire"],
        choices: [["1", "Le Fort I (horizontale, au-dessus des dents)"], ["2", "Le Fort II (pyramidale)"], ["3", "Le Fort III (disjonction cranio-faciale)"]],
      },
      {
        name: "ao",
        label: "Classification AO Spine",
        tags: ["vertebre"],
        choices: [
          ["A0", "AO A0 (processus transverse ou épineux)"], ["A1", "AO A1 (tassement d'un plateau, mur postérieur intact)"], ["A2", "AO A2 (fracture-séparation des deux plateaux)"],
          ["A3", "AO A3 (burst incomplet, un plateau + mur postérieur)"], ["A4", "AO A4 (burst complet, deux plateaux + mur postérieur)"],
          ["B1", "AO B1 (Chance osseux, rupture de la bande de tension)"], ["B2", "AO B2 (rupture ligamentaire postérieure)"], ["B3", "AO B3 (hyperextension)"],
          ["C", "AO C (translation / luxation)"],
        ],
      },
      {
        name: "recul",
        label: "Recul du mur postérieur",
        tags: ["vertebre"],
        choices: [["non", "sans recul du mur postérieur"], ["oui", "avec recul du mur postérieur dans le canal"]],
      },
      {
        name: "weber",
        label: "Classification de Danis-Weber",
        tags: ["malleole-laterale"],
        choices: [["A", "Weber A (sous la syndesmose)"], ["B", "Weber B (au niveau de la syndesmose)"], ["C", "Weber C (au-dessus de la syndesmose)"]],
      },
    ],
  },
  { id: "fissure", label: "Fissure", kinds: BONE, modalities: ALL },
  { id: "oedeme-osseux", label: "Contusion osseuse (œdème médullaire)", kinds: BONE, modalities: ["IRM"] },
  {
    id: "corps-etranger",
    label: "Corps étranger / projectile",
    kinds: [...BONE, "soft", "muscle", "lung", "organ", "viscus"],
    modalities: ["RADIO", "SCANNER"],
    options: [
      { name: "nature", label: "Nature", choices: [["projectile", "projectile balistique"], ["eclat", "éclat métallique"], ["verre", "fragment de verre"], ["autre", "autre corps étranger"]] },
      { name: "nombre", label: "Nombre", choices: [["1", "unique"], ["plusieurs", "multiples"]] },
    ],
    warning: "Un corps étranger métallique contre-indique l'IRM : radiographie ou scanner.",
  },
  {
    id: "luxation",
    label: "Luxation",
    kinds: ["joint"],
    modalities: ALL,
    options: [{ name: "sens", label: "Direction", choices: [["anterieure", "antérieure"], ["posterieure", "postérieure"], ["mediale", "médiale"], ["laterale", "latérale"], ["inferieure", "inférieure"]] }],
  },
  { id: "subluxation", label: "Subluxation", kinds: ["joint"], modalities: ALL },
  { id: "epanchement", label: "Épanchement articulaire", kinds: ["joint"], modalities: ["SCANNER", "IRM"] },
  { id: "hemarthrose", label: "Hémarthrose", kinds: ["joint"], modalities: ["SCANNER", "IRM"] },
  {
    id: "lipohemarthrose",
    label: "Lipohémarthrose (niveau graisse-sang)",
    kinds: ["joint"],
    modalities: ALL,
    warning: "Signe indirect de fracture intra-articulaire (plateau tibial notamment) : compléter par un scanner.",
  },
  { id: "arthrose", label: "Arthrose (pincement, ostéophytes)", kinds: ["joint"], modalities: ALL },
  {
    id: "entorse",
    label: "Entorse",
    kinds: ["ligament"],
    modalities: ["IRM"],
    options: [{ name: "grade", label: "Gravité", choices: [["1", "bénigne (grade I)"], ["2", "de grade II (rupture partielle)"], ["3", "grave (grade III)"]] }],
  },
  { id: "rupture-ligament", label: "Rupture ligamentaire", kinds: ["ligament"], modalities: ["IRM"], options: [{ name: "etendue", label: "Étendue", choices: [["partielle", "partielle"], ["complete", "complète"]] }] },
  {
    id: "diastasis",
    label: "Diastasis (écart anormal)",
    kinds: ["ligament", "joint"],
    tags: ["syndesmose", "lisfranc", "symphyse", "sacro-iliaque"],
    modalities: ALL,
    warning: "Comparer au côté sain ; en radiographie, les clichés en charge ou en contrainte sont plus sensibles.",
  },
  { id: "tendinopathie", label: "Tendinopathie", kinds: ["tendon"], modalities: ["IRM"] },
  {
    id: "rupture-tendon",
    label: "Rupture tendineuse",
    kinds: ["tendon"],
    modalities: ["IRM"],
    options: [
      { name: "etendue", label: "Étendue", choices: [["partielle", "partielle"], ["transfixiante", "transfixiante"], ["complete", "complète"]] },
      { name: "retraction", after: true, label: "Rétraction", choices: [["non", "sans rétraction"], ["oui", "avec rétraction"]] },
    ],
  },
  {
    id: "lesion-labrum",
    label: "Lésion du labrum / fibrocartilage",
    kinds: ["cartilage"],
    notTags: ["menisque"],
    modalities: ["IRM"],
    options: [{ name: "type", label: "Type", choices: [["desinsertion", "désinsertion"], ["fissure", "fissure"], ["slap", "lésion SLAP"], ["bankart", "lésion de Bankart"]] }],
  },
  {
    id: "lesion-menisque",
    label: "Lésion méniscale",
    kinds: ["cartilage"],
    tags: ["menisque"],
    modalities: ["IRM"],
    options: [
      { name: "type", label: "Type", choices: [["horizontale", "horizontale"], ["verticale", "verticale longitudinale"], ["radiaire", "radiaire"], ["anse", "en anse de seau"], ["languette", "en languette (flap)"], ["complexe", "complexe"]] },
      { name: "segment", label: "Segment", choices: [["ca", "de la corne antérieure"], ["corps", "du segment moyen"], ["cp", "de la corne postérieure"]] },
    ],
  },
  {
    id: "lesion-musculaire",
    label: "Lésion musculaire",
    kinds: ["muscle"],
    modalities: ["SCANNER", "IRM"],
    options: [{ name: "type", label: "Type", choices: [["contusion", "contusion"], ["elongation", "élongation"], ["dechirure", "déchirure"], ["desinsertion", "désinsertion"]] }],
  },
  { id: "hematome", label: "Hématome", kinds: ["muscle", "soft"], modalities: ["SCANNER", "IRM"] },
  {
    id: "lesion-nerf",
    label: "Lésion nerveuse",
    kinds: ["nerve"],
    modalities: ["IRM"],
    options: [{ name: "type", label: "Type", choices: [["contusion", "contusion (hypersignal)"], ["compression", "compression"], ["section", "section partielle ou complète"]] }],
  },
  {
    id: "lesion-vasculaire",
    label: "Lésion vasculaire",
    kinds: ["vessel"],
    notTags: ["veine"],
    modalities: ["SCANNER", "IRM"],
    options: [{ name: "type", label: "Type", choices: [["extravasation", "saignement actif (extravasation)"], ["occlusion", "occlusion / thrombose"], ["dissection", "dissection"], ["section", "section"], ["faux-anevrisme", "faux anévrisme"]] }],
    warning: "Les vaisseaux se voient au scanner AVEC injection (temps artériel).",
  },
  {
    id: "thrombose",
    label: "Thrombose veineuse",
    kinds: ["vessel"],
    tags: ["veine"],
    modalities: ["SCANNER", "IRM"],
    options: [{ name: "occlusion", label: "Occlusion", choices: [["partielle", "partiellement occlusive"], ["complete", "complètement occlusive"]] }],
    warning: "Examen de première intention : écho-Doppler (veine incompressible). Au scanner, injection au temps veineux : défaut de remplissage.",
  },
  // ─── Thorax ───
  {
    id: "pneumothorax",
    label: "Pneumothorax",
    kinds: ["cavity"],
    tags: ["plevre"],
    modalities: ["RADIO", "SCANNER"],
    options: [
      { name: "abondance", label: "Abondance", choices: [["minime", "de faible abondance (décollement partiel)"], ["moyen", "de moyenne abondance"], ["complet", "complet"]] },
      { name: "compressif", after: true, label: "Compression", choices: [["non", "non compressif"], ["oui", "compressif (déviation médiastinale)"]] },
    ],
    warning: "Le pneumothorax compressif est un diagnostic clinique : exsufflation sans attendre l'imagerie.",
  },
  {
    id: "hemothorax",
    label: "Hémothorax",
    kinds: ["cavity"],
    tags: ["plevre"],
    modalities: ["RADIO", "SCANNER", "IRM"],
    options: [
      { name: "abondance", label: "Abondance", choices: [["faible", "de faible abondance"], ["moyen", "de moyenne abondance"], ["massif", "massif"]] },
      { name: "air", after: true, label: "Air associé", choices: [["non", "isolé"], ["oui", "avec pneumothorax (hémopneumothorax)"]] },
    ],
    warning: "Au scanner, le sang frais mesure environ 35 à 70 UH ; injection au temps artériel pour chercher un saignement actif.",
  },
  { id: "epanchement-pleural", label: "Épanchement pleural liquidien", kinds: ["cavity"], tags: ["plevre"], modalities: ["RADIO", "SCANNER", "IRM"] },
  { id: "contusion-pulmonaire", label: "Contusion pulmonaire", kinds: ["lung"], modalities: ["RADIO", "SCANNER"] },
  { id: "laceration-pulmonaire", label: "Lacération pulmonaire (pneumatocèle / hématocèle)", kinds: ["lung"], modalities: ["SCANNER"] },
  { id: "condensation", label: "Foyer de condensation (pneumopathie)", kinds: ["lung"], modalities: ["RADIO", "SCANNER"] },
  { id: "atelectasie", label: "Atélectasie", kinds: ["lung"], modalities: ["RADIO", "SCANNER"] },
  { id: "oedeme-pulmonaire", label: "Œdème pulmonaire", kinds: ["lung"], modalities: ["RADIO", "SCANNER"] },
  {
    id: "volet-costal",
    label: "Volet costal",
    kinds: ["group"],
    tags: ["cotes"],
    modalities: ["RADIO", "SCANNER"],
    warning: "Au moins trois côtes contiguës fracturées en deux endroits ; souvent associé à une contusion pulmonaire étendue.",
  },
  { id: "rupture-diaphragme", label: "Rupture diaphragmatique", kinds: ["muscle"], tags: ["diaphragme"], modalities: ["RADIO", "SCANNER", "IRM"] },
  {
    id: "embolie-pulmonaire",
    label: "Embolie pulmonaire",
    kinds: ["vessel"],
    tags: ["artere-pulmonaire"],
    modalities: ["SCANNER"],
    options: [{ name: "niveau", label: "Niveau", choices: [["tronc", "proximale (tronc ou artères pulmonaires)"], ["lobaire", "lobaire"], ["segmentaire", "segmentaire ou sous-segmentaire"]] }],
    warning: "Angioscanner pulmonaire (injection) : défaut d'opacification endoluminal.",
  },
  {
    id: "lesion-aortique",
    label: "Lésion traumatique de l'aorte",
    kinds: ["vessel"],
    tags: ["aorte"],
    modalities: ["SCANNER", "IRM"],
    options: [
      { name: "grade", label: "Grade", choices: [["1", "grade I (déchirure intimale)"], ["2", "grade II (hématome intramural)"], ["3", "grade III (faux anévrisme)"], ["4", "grade IV (rupture)"]] },
      { name: "site", label: "Siège", choices: [["isthme", "au niveau de l'isthme"], ["ascendante", "de la portion ascendante"], ["descendante", "de la portion descendante"]] },
    ],
    warning: "Siège habituel : l'isthme, juste après l'artère sous-clavière gauche (décélération). Angioscanner.",
  },
  { id: "elargissement-mediastin", label: "Élargissement du médiastin", kinds: ["vessel"], tags: ["aorte"], modalities: ["RADIO"], warning: "Signe peu spécifique : angioscanner pour rechercher une lésion aortique." },
  {
    id: "epanchement-pericardique",
    label: "Épanchement péricardique / hémopéricarde",
    kinds: ["cavity"],
    tags: ["pericarde"],
    modalities: ["SCANNER", "IRM"],
    options: [{ name: "tamponnade", after: true, label: "Tamponnade", choices: [["non", "sans signe de tamponnade"], ["oui", "avec signes de tamponnade (cavités comprimées, veines caves dilatées)"]] }],
    warning: "Échographie cardiaque en première intention.",
  },
  { id: "cardiomegalie", label: "Cardiomégalie", kinds: ["organ"], tags: ["coeur"], modalities: ["RADIO", "SCANNER", "IRM"] },
  { id: "pneumomediastin", label: "Pneumomédiastin", kinds: ["cavity"], tags: ["mediastin"], modalities: ["RADIO", "SCANNER"] },
  { id: "hematome-mediastinal", label: "Hématome médiastinal", kinds: ["cavity"], tags: ["mediastin"], modalities: ["SCANNER", "IRM"] },
  { id: "rupture-tracheo-bronchique", label: "Rupture trachéo-bronchique", kinds: ["airway"], modalities: ["SCANNER"] },
  // ─── Abdomen et bassin ───
  ...(["foie", "rate", "rein"] as const).map((organ): LesionType => ({
    id: `traumatisme-${organ}`,
    label: "Lésion traumatique (AAST)",
    kinds: ["organ"],
    tags: [organ],
    modalities: ["SCANNER", "IRM"],
    options: [
      {
        name: "grade",
        after: true,
        label: "Grade AAST",
        choices: organ === "rein"
          ? [["1", "grade I (contusion, hématome sous-capsulaire)"], ["2", "grade II (lacération ≤ 1 cm, hématome périrénal)"], ["3", "grade III (lacération > 1 cm sans atteinte des cavités)"], ["4", "grade IV (atteinte des cavités, fuite d'urine, lésion segmentaire)"], ["5", "grade V (rein éclaté, lésion du pédicule)"]]
          : organ === "rate"
            ? [["1", "grade I (hématome < 10 %, lacération < 1 cm)"], ["2", "grade II (hématome 10-50 %, lacération 1-3 cm)"], ["3", "grade III (hématome > 50 %, lacération > 3 cm)"], ["4", "grade IV (lésion vasculaire, saignement contenu)"], ["5", "grade V (rate éclatée, saignement dans le péritoine)"]]
            : [["1", "grade I (hématome < 10 %, lacération < 1 cm)"], ["2", "grade II (hématome 10-50 %, lacération 1-3 cm)"], ["3", "grade III (lacération > 3 cm, saignement contenu)"], ["4", "grade IV (destruction de 25 à 75 % d'un lobe)"], ["5", "grade V (destruction > 75 % d'un lobe, lésion veineuse juxta-hépatique)"]],
      },
      { name: "saignement", after: true, label: "Saignement actif", choices: [["non", "sans saignement actif"], ["oui", "avec saignement actif (extravasation de contraste)"]] },
    ],
    warning: "Scanner injecté en deux temps (artériel et portal) pour chercher une lésion vasculaire ou un saignement actif.",
  })),
  {
    id: "traumatisme-pancreas",
    label: "Traumatisme pancréatique",
    kinds: ["organ"],
    tags: ["pancreas"],
    modalities: ["SCANNER", "IRM"],
    options: [{ name: "canal", after: true, label: "Canal de Wirsung", choices: [["non", "sans atteinte canalaire visible"], ["oui", "avec suspicion d'atteinte du canal de Wirsung"]] }],
  },
  {
    id: "hemoperitoine",
    label: "Hémopéritoine",
    kinds: ["cavity"],
    tags: ["peritoine"],
    modalities: ["SCANNER", "IRM"],
    options: [{ name: "abondance", label: "Abondance", choices: [["faible", "de faible abondance (Morison, cul-de-sac de Douglas)"], ["moyen", "de moyenne abondance"], ["grand", "de grande abondance"]] }],
  },
  {
    id: "pneumoperitoine",
    label: "Pneumopéritoine",
    kinds: ["cavity"],
    tags: ["peritoine"],
    modalities: ["RADIO", "SCANNER"],
    warning: "Signe une perforation d'un organe creux. En radio : cliché debout (croissant gazeux sous les coupoles) ou décubitus latéral gauche.",
  },
  { id: "hematome-retroperitoneal", label: "Hématome rétropéritonéal", kinds: ["cavity"], tags: ["retroperitoine"], modalities: ["SCANNER", "IRM"] },
  { id: "perforation-digestive", label: "Perforation digestive", kinds: ["viscus"], tags: ["digestif"], modalities: ["SCANNER"], warning: "Air extra-digestif au contact de l'anse, épanchement, défaut de rehaussement de la paroi." },
  {
    id: "occlusion",
    label: "Occlusion (anses dilatées, niveaux hydro-aériques)",
    kinds: ["viscus"],
    tags: ["digestif"],
    modalities: ["RADIO", "SCANNER"],
    options: [{ name: "souffrance", after: true, label: "Souffrance de la paroi", choices: [["non", "sans signe de souffrance"], ["oui", "avec signes de souffrance (paroi mal rehaussée)"]] }],
  },
  { id: "appendicite", label: "Appendicite", kinds: ["viscus"], tags: ["appendice"], modalities: ["SCANNER", "IRM"] },
  { id: "lithiase", label: "Lithiase (calcul)", kinds: ["viscus", "organ"], tags: ["calcul"], modalities: ["RADIO", "SCANNER", "IRM"], options: [{ name: "dilatation", after: true, label: "Retentissement", choices: [["non", "sans dilatation d'amont"], ["oui", "avec dilatation d'amont"]] }] },
  {
    id: "rupture-vessie",
    label: "Rupture vésicale",
    kinds: ["viscus"],
    tags: ["vessie"],
    modalities: ["SCANNER"],
    options: [{ name: "type", label: "Type", choices: [["extra", "extrapéritonéale"], ["intra", "intrapéritonéale"], ["mixte", "mixte"]] }],
    warning: "À rechercher devant toute fracture du bassin : cystoscanner (opacification de la vessie).",
  },
  {
    id: "fracture-bassin",
    label: "Fracture de l'anneau pelvien (Young-Burgess)",
    kinds: ["group"],
    tags: ["bassin"],
    modalities: ["RADIO", "SCANNER"],
    options: [{
      name: "mecanisme",
      label: "Type",
      choices: [
        ["apc1", "APC I (compression antéro-postérieure, diastasis < 2,5 cm)"], ["apc2", "APC II (ouverture en livre, sacro-iliaque antérieure)"], ["apc3", "APC III (disjonction sacro-iliaque complète)"],
        ["lc1", "LC I (compression latérale, branches + sacrum)"], ["lc2", "LC II (avec fracture de l'aile iliaque)"], ["lc3", "LC III (avec lésion controlatérale en ouverture)"],
        ["vs", "VS (cisaillement vertical)"], ["cm", "mécanisme combiné"],
      ],
    }],
    warning: "Fracture instable = risque hémorragique majeur : angioscanner, rechercher une lésion de la vessie et de l'urètre.",
  },
  {
    id: "anevrisme-aortique",
    label: "Anévrisme de l'aorte",
    kinds: ["vessel"],
    tags: ["aorte-abdo"],
    modalities: ["SCANNER", "IRM"],
    options: [{ name: "rupture", label: "Rupture", choices: [["non", "non rompu"], ["fissure", "fissuré"], ["rompu", "rompu (hématome rétropéritonéal)"]] }],
  },
  // ─── Rachis ───
  {
    id: "hernie-discale",
    label: "Hernie discale",
    kinds: ["disc"],
    modalities: ["SCANNER", "IRM"],
    options: [
      { name: "type", label: "Type", choices: [["bombement", "bombement discal (> 90° de la circonférence)"], ["protrusion", "protrusion"], ["extrusion", "extrusion"], ["sequestration", "séquestration (fragment libre)"]] },
      { name: "siege", label: "Siège", choices: [["mediane", "médiane"], ["paramediane-d", "paramédiane droite"], ["paramediane-g", "paramédiane gauche"], ["foraminale-d", "foraminale droite"], ["foraminale-g", "foraminale gauche"]] },
      { name: "conflit", after: true, label: "Conflit", choices: [["non", "sans conflit radiculaire"], ["racine", "avec conflit radiculaire"], ["canal", "avec rétrécissement canalaire"]] },
    ],
  },
  { id: "discopathie", label: "Discopathie (pincement, dégénérescence)", kinds: ["disc"], modalities: ["RADIO", "SCANNER", "IRM"] },
  {
    id: "lesion-medullaire",
    label: "Lésion médullaire",
    kinds: ["cord"],
    modalities: ["IRM"],
    options: [{ name: "type", label: "Type", choices: [["oedeme", "œdème médullaire (hypersignal T2)"], ["contusion", "contusion médullaire"], ["hematomyelie", "contusion hémorragique (hématomyélie)"], ["section", "section médullaire"]] }],
    warning: "Seule l'IRM montre la moelle. Préciser la hauteur de l'hypersignal T2 (valeur pronostique).",
  },
  {
    id: "compression-medullaire",
    label: "Compression médullaire / de la queue de cheval",
    kinds: ["cord", "nerve", "cavity"],
    tags: ["moelle", "canal"],
    modalities: ["SCANNER", "IRM"],
    options: [{ name: "cause", label: "Cause", choices: [["fragment", "par recul d'un fragment osseux"], ["hernie", "par hernie discale"], ["hematome", "par hématome épidural"], ["autre", "autre"]] }],
    warning: "Urgence neurochirurgicale.",
  },
  { id: "hematome-epidural-rachidien", label: "Hématome épidural rachidien", kinds: ["cavity"], tags: ["canal"], modalities: ["SCANNER", "IRM"] },  // ─── Tête ───
  {
    id: "hematome-extradural",
    label: "Hématome extradural",
    kinds: ["brain"],
    tags: ["convexite"],
    regard: true,
    modalities: ["SCANNER", "IRM"],
    options: [{ name: "effet", after: true, label: "Effet de masse", choices: [["non", "sans effet de masse"], ["oui", "avec effet de masse"], ["engagement", "avec déviation de la ligne médiane et engagement"]] }],
    warning: "Lentille biconvexe hyperdense, ne franchit pas les sutures ; souvent sous une fracture (artère méningée moyenne). Urgence neurochirurgicale.",
  },
  {
    id: "hematome-sous-dural",
    label: "Hématome sous-dural",
    kinds: ["brain"],
    tags: ["convexite"],
    regard: true,
    modalities: ["SCANNER", "IRM"],
    options: [
      { name: "stade", label: "Stade", choices: [["aigu", "aigu (hyperdense)"], ["subaigu", "subaigu (isodense)"], ["chronique", "chronique (hypodense)"]] },
      { name: "effet", after: true, label: "Effet de masse", choices: [["non", "sans effet de masse"], ["oui", "avec effet de masse"], ["engagement", "avec déviation de la ligne médiane et engagement"]] },
    ],
    warning: "Croissant étendu le long de la convexité, franchit les sutures mais pas la faux du cerveau.",
  },
  {
    id: "hemorragie-sous-arachnoidienne",
    label: "Hémorragie sous-arachnoïdienne",
    kinds: ["brain"],
    tags: ["convexite"],
    regard: true,
    modalities: ["SCANNER", "IRM"],
    options: [{ name: "origine", label: "Aspect", choices: [["traumatique", "traumatique (sillons de la convexité)"], ["anevrismale", "des citernes de la base (rupture d'anévrisme suspectée)"]] }],
    warning: "Hyperdensité spontanée des sillons ou des citernes ; en IRM, FLAIR et T2*. Origine non traumatique : angioscanner.",
  },
  {
    id: "contusion-cerebrale",
    label: "Contusion cérébrale",
    kinds: ["brain"],
    modalities: ["SCANNER", "IRM"],
    options: [{ name: "hemorragique", label: "Aspect", choices: [["non", "non hémorragique"], ["oui", "hémorragique"]] }],
  },
  { id: "hematome-intracerebral", label: "Hématome intraparenchymateux", kinds: ["brain"], modalities: ["SCANNER", "IRM"] },
  {
    id: "avc-ischemique",
    label: "Infarctus cérébral (AVC ischémique)",
    kinds: ["brain"],
    modalities: ["SCANNER", "IRM"],
    options: [
      { name: "territoire", label: "Territoire", choices: [["acm", "sylvien (artère cérébrale moyenne)"], ["aca", "de l'artère cérébrale antérieure"], ["acp", "de l'artère cérébrale postérieure"], ["vb", "vertébro-basilaire"]] },
      { name: "phase", label: "Phase", choices: [["precoce", "à la phase précoce"], ["constitue", "constitué"]] },
    ],
    warning: "Le scanner peut être normal les premières heures ; IRM en diffusion (hypersignal immédiat). Score ASPECTS pour le territoire sylvien.",
  },
  {
    id: "oedeme-cerebral",
    label: "Œdème cérébral",
    kinds: ["brain"],
    modalities: ["SCANNER", "IRM"],
    options: [{ name: "engagement", after: true, label: "Engagement", choices: [["non", "sans engagement"], ["sous-falcoriel", "avec engagement sous-falcoriel"], ["temporal", "avec engagement temporal"], ["amygdales", "avec engagement des amygdales cérébelleuses"]] }],
  },
  { id: "lesions-axonales", label: "Lésions axonales diffuses", kinds: ["brain"], modalities: ["IRM"], warning: "Micro-saignements visibles en T2* / SWI, souvent absents au scanner." },
  { id: "pneumencephalie", label: "Pneumencéphalie", kinds: ["brain"], tags: ["convexite"], regard: true, modalities: ["RADIO", "SCANNER"] },
  { id: "hemorragie-intraventriculaire", label: "Hémorragie intraventriculaire", kinds: ["cavity"], tags: ["ventricule"], modalities: ["SCANNER", "IRM"] },
  { id: "hydrocephalie", label: "Hydrocéphalie (dilatation ventriculaire)", kinds: ["cavity"], tags: ["ventricule"], modalities: ["SCANNER", "IRM"] },  { id: "tumefaction", label: "Tuméfaction", kinds: ["soft"], modalities: ALL },
  { id: "emphyseme", label: "Emphysème sous-cutané", kinds: ["soft"], modalities: ["RADIO", "SCANNER"] },
  { id: "collection", label: "Collection / abcès", kinds: ["soft", "muscle"], modalities: ["SCANNER", "IRM"] },
];

export const LESION_BY_ID = new Map(LESIONS.map((l) => [l.id, l]));

const hasTag = (node: AnatomyNode, tags: string[]) => tags.some((t) => node.tags?.includes(t));

/** La lésion s'applique-t-elle à cette structure (type, étiquettes) ? */
const fits = (l: LesionType, node: AnatomyNode) =>
  l.kinds.includes(node.kind) && (!l.tags || hasTag(node, l.tags)) && (!l.notTags || !hasTag(node, l.notTags));

/** Lésions proposées pour une structure dans un examen donné. */
export function lesionsFor(structureId: string, modality: Modality): LesionType[] {
  const node = findNode(structureId);
  if (!node) return [];
  return LESIONS.filter((l) => fits(l, node) && l.modalities.includes(modality));
}

/** Réglages d'une lésion proposés pour cette structure (classifications réservées à certaines structures). */
export function optionsFor(lesion: LesionType, structureId: string): LesionOption[] {
  const node = findNode(structureId);
  const own = (lesion.options ?? []).filter((o) => !o.tags || (node && hasTag(node, o.tags)));
  // Structures paires d'une région médiane (lobes, os du crâne…) : le côté se précise lésion par lésion.
  if (!node?.tags?.includes("lateralise")) return own;
  const f = node.tags.includes("f");
  const side: LesionOption = { name: "cote", label: "Côté", side: true, choices: [["d", f ? "droite" : "droit"], ["g", "gauche"], ["bilateral", f ? "bilatérale" : "bilatéral"]] };
  return [side, ...own];
}

export type Finding = {
  id: string;
  structure: string;
  lesion: string;
  options: Record<string, string>;
  /** Taille en mm, facultative (hématome, corps étranger…). */
  size?: string;
  note?: string;
};

export type ImagingData = {
  modality: Modality;
  /** Côté examiné, pour les régions paires (membres). */
  side?: "D" | "G";
  /** Zone examinée (segment ou région). */
  zone: string;
  views: string[];
  injection?: string;
  reconstructions?: string[];
  sequences?: string[];
  planes?: string[];
  indication: string;
  findings: Finding[];
  results: string;
  conclusion: string;
};

const SIDE = { D: "droit", G: "gauche" } as const;

/** « de l'avant-bras droit » (côté seulement pour les régions paires). */
export function zoneText(d: Pick<ImagingData, "zone" | "side">): string {
  const zone = findNode(d.zone);
  return `${zone?.of ?? ""}${d.side ? ` ${SIDE[d.side]}` : ""}`.trim();
}

/** « Radiographie de l'avant-bras droit, incidences de face et de profil. » */
export function techniqueText(d: ImagingData): string {
  const where = zoneText(d);
  if (d.modality === "RADIO") {
    // Minuscule en début de chaque incidence seulement : « face, profil, incidences du scaphoïde (Schreck) ».
    const views = d.views.map((v) => v.charAt(0).toLowerCase() + v.slice(1)).join(", ");
    return `Radiographie ${where}${views ? `, incidences : ${views}` : ""}.`;
  }
  if (d.modality === "SCANNER") {
    const inj = CT_OPTIONS.injection.find(([v]) => v === d.injection)?.[1] ?? "Sans injection";
    const rec = d.reconstructions?.length ? ` ${d.reconstructions.join(", ")}.` : "";
    return `Scanner ${where}, acquisition hélicoïdale. ${inj}.${rec}`;
  }
  const seq = d.sequences?.length ? ` Séquences : ${d.sequences.join(", ")}` : "";
  const planes = d.planes?.length ? ` dans ${d.planes.length > 1 ? "les plans" : "le plan"} ${d.planes.join(", ").toLowerCase()}` : "";
  return `IRM ${where}.${seq}${planes}.`;
}

/** « Fracture spiroïde déplacée, intra-articulaire du tiers distal de la diaphyse radiale (12 mm). » */
export function findingText(f: Finding): string {
  const lesion = LESION_BY_ID.get(f.lesion);
  const node = findNode(f.structure);
  if (!lesion || !node) return "";
  const text = (o: LesionOption) => o.choices.find(([v]) => v === f.options[o.name])?.[1];
  const options = optionsFor(lesion, f.structure);
  // Réglages simples avant la structure ; côté juste après ; classifications (« Garden III… ») à la fin.
  const plain = options.filter((o) => !o.tags && !o.side && !o.after).map(text).filter(Boolean);
  const side = options.filter((o) => o.side).map(text).filter(Boolean)[0];
  const classified = options.filter((o) => o.tags || o.after).map(text).filter(Boolean);
  const size = f.size ? ` (${f.size} mm)` : "";
  const note = f.note ? ` ${f.note.trim().replace(/\.?$/, ".")}` : "";
  const where = `${lesion.regard ? "en regard " : ""}${node.of}${side ? ` ${side}` : ""}`;
  return `${lesion.label}${plain.length ? ` ${plain.join(", ")}` : ""} ${where}${classified.length ? `, ${classified.join(", ")}` : ""}${size}.${note}`;
}
/** Conclusion proposée à partir des lésions (le radiologue la reformule s'il le souhaite). */
export function suggestConclusion(d: ImagingData): string {
  if (d.findings.length === 0) return "Pas d'anomalie décelable sur cet examen.";
  return d.findings.map((f) => findingText(f).replace(/\s*\(\d+([.,]\d+)? mm\)/, "").split(".")[0]).join(". ") + ".";
}

const MAX_FINDINGS = 30;

/** Validation serveur des données envoyées par l'éditeur. */
export function parseImaging(raw: unknown): { error: string } | { data: ImagingData } {
  if (!raw || typeof raw !== "object") return { error: "Données d'imagerie manquantes." };
  const r = raw as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const list = (v: unknown, allowed: readonly string[]) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && allowed.includes(x)) : []);

  const modality = r.modality;
  if (modality !== "RADIO" && modality !== "SCANNER" && modality !== "IRM") return { error: "Choisissez l'examen." };
  const zone = str(r.zone, 40);
  const region = regionOfNode(zone);
  if (!region) return { error: "Choisissez la zone examinée." };
  const side = r.side === "D" || r.side === "G" ? r.side : undefined;
  if (region.bilateral && !side) return { error: "Choisissez le côté." };
  const indication = str(r.indication, 1000);
  if (!indication) return { error: "Indiquez le motif de l'examen (indication)." };
  const conclusion = str(r.conclusion, 2000);
  if (!conclusion) return { error: "Rédigez la conclusion." };

  const findings: Finding[] = [];
  for (const item of Array.isArray(r.findings) ? r.findings.slice(0, MAX_FINDINGS) : []) {
    const f = item as Record<string, unknown>;
    const structure = str(f.structure, 40);
    const lesion = LESION_BY_ID.get(str(f.lesion, 40));
    if (regionOfNode(structure) !== region || !lesion || !lesionsFor(structure, modality).includes(lesion)) {
      return { error: "Une lésion ne correspond pas à la structure ou à l'examen choisi." };
    }
    const opts = (f.options ?? {}) as Record<string, unknown>;
    const options: Record<string, string> = {};
    for (const o of optionsFor(lesion, structure)) {
      const v = str(opts[o.name], 40);
      if (o.choices.some(([c]) => c === v)) options[o.name] = v;
    }
    const size = str(f.size, 6);
    findings.push({
      id: str(f.id, 40) || crypto.randomUUID(),
      structure,
      lesion: lesion.id,
      options,
      ...(size && /^\d+([.,]\d+)?$/.test(size) && { size }),
      ...(str(f.note, 300) && { note: str(f.note, 300) }),
    });
  }

  const zoneViews = RADIO_VIEWS[zone] ?? DEFAULT_RADIO_VIEWS;
  return {
    data: {
      modality,
      ...(region.bilateral && { side }),
      zone,
      views: modality === "RADIO" ? list(r.views, zoneViews) : [],
      ...(modality === "SCANNER" && {
        injection: CT_OPTIONS.injection.some(([v]) => v === r.injection) ? String(r.injection) : "sans",
        reconstructions: list(r.reconstructions, CT_OPTIONS.reconstructions),
      }),
      ...(modality === "IRM" && { sequences: list(r.sequences, MRI_SEQUENCES), planes: list(r.planes, MRI_PLANES) }),
      indication,
      findings,
      results: str(r.results, 3000),
      conclusion,
    },
  };
}

/** La lésion est-elle dans (ou au-dessus de) cette structure ? Sert à afficher les lésions sur les coupes. */
export const concerns = (findingStructure: string, structure: string) =>
  ancestryOf(structure).some((n) => n.id === findingStructure) || ancestryOf(findingStructure).some((n) => n.id === structure);
