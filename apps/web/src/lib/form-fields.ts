/**
 * Formulaires configurables (types de demandes) : description des champs, lecture et validation, affichage des réponses.
 * Partagé entre le navigateur (éditeur de champs, formulaires) et le serveur (validation).
 */

export const FIELD_TYPES = {
  text: "Texte court",
  textarea: "Texte long",
  number: "Nombre",
  date: "Date",
  datetime: "Date et heure",
  select: "Liste (un choix)",
  multi: "Cases à cocher (plusieurs choix)",
  checkbox: "Case oui / non",
} as const;
export type FieldType = keyof typeof FIELD_TYPES;

export type FormField = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** Choix des listes et cases à cocher. */
  options?: string[];
  /** Champ sur une demi-largeur (deux par ligne). */
  half?: boolean;
  hint?: string;
};

/** Valeurs saisies : texte, liste de choix (multi) ou booléen (case). */
export type FormValues = Record<string, string | string[] | boolean>;

const MAX_FIELDS = 30;

/** « Groupe sanguin / RAI » → « groupe-sanguin-rai ». */
export function fieldName(label: string) {
  return (
    label
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "champ"
  );
}

/** Liste de champs relue depuis la base ou un formulaire (JSON) : champs inconnus ou mal formés ignorés, noms uniques. */
export function parseFields(raw: unknown): FormField[] {
  let list: unknown = raw;
  if (typeof raw === "string") {
    try {
      list = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  const used = new Set<string>();
  const out: FormField[] = [];
  for (const item of list.slice(0, MAX_FIELDS)) {
    if (!item || typeof item !== "object") continue;
    const f = item as Record<string, unknown>;
    const label = typeof f.label === "string" ? f.label.trim().slice(0, 80) : "";
    const type = typeof f.type === "string" && f.type in FIELD_TYPES ? (f.type as FieldType) : null;
    if (!label || !type) continue;
    let name = fieldName(typeof f.name === "string" && f.name ? f.name : label);
    for (let i = 2; used.has(name); i++) name = `${fieldName(label)}-${i}`;
    used.add(name);
    const options = Array.isArray(f.options)
      ? f.options.filter((o): o is string => typeof o === "string").map((o) => o.trim().slice(0, 80)).filter(Boolean).slice(0, 30)
      : [];
    if ((type === "select" || type === "multi") && options.length === 0) continue;
    out.push({
      name,
      label,
      type,
      ...(f.required === true && type !== "checkbox" && { required: true }),
      ...((type === "select" || type === "multi") && { options }),
      ...(f.half === true && { half: true }),
      ...(typeof f.hint === "string" && f.hint.trim() && { hint: f.hint.trim().slice(0, 160) }),
    });
  }
  return out;
}

/** Lecture d'un formulaire envoyé (champs préfixés par `prefix`), avec validation. */
export function readValues(fields: FormField[], form: FormData, prefix = "f-"): { error: string } | { values: FormValues } {
  const values: FormValues = {};
  for (const f of fields) {
    const key = prefix + f.name;
    if (f.type === "checkbox") {
      values[f.name] = form.get(key) === "on";
      continue;
    }
    if (f.type === "multi") {
      const chosen = form.getAll(key).map(String).filter((v) => f.options?.includes(v));
      if (f.required && chosen.length === 0) return { error: `Cochez au moins un choix : ${f.label}.` };
      if (chosen.length) values[f.name] = chosen;
      continue;
    }
    const value = String(form.get(key) ?? "").trim().slice(0, f.type === "textarea" ? 3000 : 200);
    if (!value) {
      if (f.required) return { error: `Champ requis : ${f.label}.` };
      continue;
    }
    if (f.type === "number" && !/^-?\d+([.,]\d+)?$/.test(value)) return { error: `Nombre invalide : ${f.label}.` };
    if (f.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return { error: `Date invalide : ${f.label}.` };
    if (f.type === "datetime" && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return { error: `Date / heure invalide : ${f.label}.` };
    if (f.type === "select" && !f.options?.includes(value)) return { error: `Choix invalide : ${f.label}.` };
    values[f.name] = value;
  }
  return { values };
}

/** Réponses lisibles : [libellé, valeur] (champs vides et cases non cochées omis). */
export function displayValues(fields: FormField[], values: unknown): [label: string, value: string][] {
  const v = (values && typeof values === "object" ? values : {}) as FormValues;
  const out: [string, string][] = [];
  for (const f of fields) {
    const x = v[f.name];
    if (x === undefined || x === "" || x === false) continue;
    if (f.type === "checkbox") out.push([f.label, "Oui"]);
    else if (Array.isArray(x)) out.push([f.label, x.join(", ")]);
    else if (f.type === "date") out.push([f.label, String(x).split("-").reverse().join("/")]);
    else if (f.type === "datetime") {
      const [d, t] = String(x).split("T");
      out.push([f.label, `${d.split("-").reverse().join("/")} à ${t}`]);
    } else out.push([f.label, String(x)]);
  }
  return out;
}
