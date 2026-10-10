import type { DocumentKind } from "@ocean/db";

/**
 * Registre des types de documents : tout ce qui change d'un type à l'autre est décrit ici
 * (formulaire, validation, numérotation, mise en page du PDF dans document-pdf.tsx).
 * Ajouter un type : une valeur dans l'enum DocumentKind du schéma, une entrée ici, son texte dans document-pdf.tsx.
 */

export type FieldDef = {
  name: string;
  label: string;
  type: "text" | "textarea" | "date" | "datetime" | "select" | "checkbox";
  required?: boolean;
  options?: [value: string, label: string][];
  placeholder?: string;
  hint?: string;
  /** Champ sur une demi-largeur (deux par ligne). */
  half?: boolean;
};

export type DocumentType = {
  label: string;
  description: string;
  /** Préfixe de numérotation quand le service n'a pas de code (ex : DC-202610-0001). */
  prefix: string;
  /** Lignes répétables (médicaments, examens). */
  items?: "medicaments" | "examens";
  /** Texte libre : libellé du champ, et s'il est obligatoire. */
  body: { label: string; required?: boolean; placeholder?: string };
  fields?: FieldDef[];
  /** Validité et case « renouvelable » (ordonnances et examens). */
  validity?: boolean;
  renewable?: boolean;
  /** Contrôles entre champs ; renvoie un message d'erreur ou null. */
  check?: (data: DocumentData) => string | null;
  /** Éditeur dédié à la place du formulaire générique (imagerie : carte du corps, coupes…). */
  custom?: "imaging";
};

export type DocumentData = Record<string, string | boolean>;

const REFUSAL_FIELDS: FieldDef[] = [
  { name: "care", label: "Soins / examens / transport proposés", type: "textarea", required: true, placeholder: "Ex : suture de la plaie au bras droit, transport à l'hôpital pour radiographie…" },
  { name: "risks", label: "Risques expliqués au patient", type: "textarea", required: true, placeholder: "Ex : infection, hémorragie, aggravation des lésions, décès…" },
  { name: "place", label: "Lieu", type: "text", half: true, placeholder: "Ex : Sur intervention, Vinewood Hills" },
  { name: "witnesses", label: "Témoin(s)", type: "text", half: true, placeholder: "Nom(s) et fonction(s)" },
];

export const DOCUMENT_TYPES: Record<DocumentKind, DocumentType> = {
  ORDONNANCE: {
    label: "Ordonnance",
    description: "Médicaments, soins, matériel.",
    prefix: "ORD",
    items: "medicaments",
    body: { label: "Remarques (facultatif)" },
    validity: true,
    renewable: true,
  },
  EXAMENS: {
    label: "Prescription d'examens",
    description: "Analyses, radiographies, consultations spécialisées.",
    prefix: "EXA",
    items: "examens",
    body: { label: "Remarques (facultatif)" },
    validity: true,
  },
  CERTIFICAT: {
    label: "Certificat médical",
    description: "Aptitude, constatation de blessures, texte libre.",
    prefix: "CERT",
    body: { label: "Contenu du certificat", required: true, placeholder: "Je soussigné(e), certifie avoir examiné ce jour…" },
  },
  ARRET_TRAVAIL: {
    label: "Arrêt de travail",
    description: "Arrêt initial ou prolongation, avec dates et sorties.",
    prefix: "AT",
    body: { label: "Remarques (facultatif)" },
    fields: [
      { name: "type", label: "Type", type: "select", required: true, half: true, options: [["initial", "Arrêt initial"], ["prolongation", "Prolongation"]] },
      { name: "job", label: "Profession / employeur", type: "text", half: true, placeholder: "Ex : LSPD, mécanicien au Bennys…" },
      { name: "start", label: "Du", type: "date", required: true, half: true },
      { name: "end", label: "Au (inclus)", type: "date", required: true, half: true },
      { name: "outings", label: "Sorties", type: "select", required: true, half: true, options: [["non", "Non autorisées"], ["oui", "Autorisées (hors 9h-11h et 14h-16h)"], ["libres", "Libres"]] },
      { name: "reason", label: "Motif médical", type: "textarea", required: true, placeholder: "Ex : fracture du poignet droit, repos strict…" },
    ],
    check: (d) => (String(d.end) < String(d.start) ? "La date de fin doit être après la date de début." : null),
  },
  DECES: {
    label: "Certificat de décès",
    description: "Constat de décès, cause et circonstances.",
    prefix: "DC",
    body: { label: "Observations (facultatif)" },
    fields: [
      { name: "deathAt", label: "Date et heure du décès", type: "datetime", required: true, half: true },
      { name: "place", label: "Lieu du décès", type: "text", required: true, half: true, placeholder: "Ex : Pillbox Hill, voie publique" },
      { name: "cause", label: "Cause du décès", type: "textarea", required: true, placeholder: "Ex : hémorragie massive consécutive à une plaie par balle thoracique" },
      {
        name: "manner",
        label: "Circonstances",
        type: "select",
        required: true,
        half: true,
        options: [["naturelle", "Mort naturelle"], ["accident", "Accident"], ["violente", "Mort violente (agression, homicide)"], ["suicide", "Suicide"], ["indeterminee", "Indéterminée"]],
      },
      { name: "forensic", label: "Obstacle médico-légal (à signaler aux autorités)", type: "checkbox", half: true },
    ],
  },
  REFUS_SOINS: {
    label: "Refus de soins (décharge)",
    description: "Le patient refuse les soins et signe la décharge.",
    prefix: "RS",
    body: { label: "Observations (facultatif)" },
    fields: [...REFUSAL_FIELDS, { name: "signed", label: "Décharge signée par le patient (en jeu)", type: "checkbox" }],
  },
  REFUS_SIGNATURE: {
    label: "Refus de signer la décharge",
    description: "Le patient refuse les soins ET refuse de signer : attestation du soignant devant témoin.",
    prefix: "RSD",
    body: { label: "Observations (facultatif)" },
    fields: REFUSAL_FIELDS.map((f) => (f.name === "witnesses" ? { ...f, required: true, hint: "Obligatoire : le refus doit être constaté devant témoin." } : f)),
  },
  IMAGERIE: {
    label: "Compte rendu d'imagerie",
    description: "Radio, scanner ou IRM : carte du corps, coupes, lésions et compte rendu.",
    prefix: "IMG",
    body: { label: "" },
    custom: "imaging",
  },
};

export const DOCUMENT_KINDS = Object.keys(DOCUMENT_TYPES) as DocumentKind[];

/** Titre imprimé (et affiché dans les listes). */
export const kindLabel = (kind: DocumentKind) => DOCUMENT_TYPES[kind].label;

/** Une ligne d'ordonnance : « CICALFATE+ crème » / « Appliquer… » / « QSP 3 mois ». */
export type DocumentItem = { name: string; instructions: string; quantity: string };

/** En-tête figé à l'émission : le PDF reste identique même si le dossier ou le profil changent ensuite. */
export type DocumentSnapshot = {
  hospitalName: string;
  hospitalCity: string;
  hospitalAddress: string;
  service: { name: string; head: { name: string; title: string | null } | null } | null;
  prescriber: { name: string; title: string | null; role: string | null; signatureUrl: string | null };
  patient: {
    firstName: string;
    lastName: string;
    birthDate: string | null;
    sex: string | null;
    number: string;
    /** Facultatifs : absents des documents émis avant leur ajout. */
    apparentAge?: string | null;
    unidentified?: boolean;
  };
};

/**
 * Lit les champs du type depuis le formulaire (valeurs déjà « propres » : chaînes coupées, booléens).
 * Renvoie l'erreur à afficher, ou les données à enregistrer.
 */
export function readFields(type: DocumentType, form: FormData): { error: string } | { data: DocumentData } {
  const data: DocumentData = {};
  for (const f of type.fields ?? []) {
    if (f.type === "checkbox") {
      data[f.name] = form.get(f.name) === "on";
      continue;
    }
    const value = String(form.get(f.name) ?? "").trim().slice(0, f.type === "textarea" ? 2000 : 200);
    if (!value) {
      if (f.required) return { error: `Champ requis : ${f.label}.` };
      continue;
    }
    if (f.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return { error: `Date invalide : ${f.label}.` };
    if (f.type === "datetime" && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return { error: `Date / heure invalide : ${f.label}.` };
    if (f.type === "select" && !f.options?.some(([v]) => v === value)) return { error: `Choix invalide : ${f.label}.` };
    data[f.name] = value;
  }
  const error = type.check?.(data);
  return error ? { error } : { data };
}
