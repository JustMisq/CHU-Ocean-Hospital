import type { DocumentKind } from "@ocean/db";
import type { FormField } from "./form-fields";

/**
 * Modèles de types de demandes proposés selon le service (reconnu par des mots de son nom). La direction ou le chef de
 * service les ajoute en un clic, puis les adapte. Rien n'est créé automatiquement.
 */

export type RequestPreset = {
  name: string;
  description: string;
  fields: FormField[];
  acceptFields?: FormField[];
  responseFields?: FormField[];
  requiredDocuments?: DocumentKind[];
  responseDocument?: DocumentKind;
};

const URGENCE: FormField = { name: "contexte", label: "Contexte clinique", type: "textarea", required: true, hint: "Ce que le service doit savoir : antécédents, traitements, constantes…" };

const PRESETS: { match: RegExp; presets: RequestPreset[] }[] = [
  {
    match: /labo|biolog/i,
    presets: [
      {
        name: "Analyse de biologie",
        description: "Prise de sang, urines, toxicologie : le laboratoire rend les résultats.",
        fields: [
          {
            name: "analyses",
            label: "Analyses demandées",
            type: "multi",
            required: true,
            options: ["NFS (numération formule sanguine)", "Ionogramme, créatinine", "CRP", "Bilan hépatique", "Hémostase (TP, TCA)", "Groupe sanguin, RAI", "Troponine", "Lactates", "Alcoolémie", "Toxicologie (stupéfiants)", "Bêta-HCG (grossesse)", "ECBU (urines)"],
          },
          { name: "prelevement", label: "Prélèvement", type: "select", required: true, half: true, options: ["Déjà prélevé, envoyé au labo", "À prélever par le labo"] },
          { name: "jeun", label: "Patient à jeun", type: "checkbox", half: true },
          { name: "renseignements", label: "Renseignements cliniques", type: "textarea" },
        ],
        responseFields: [
          { name: "resultats", label: "Résultats", type: "textarea", required: true, hint: "Une analyse par ligne, avec les valeurs et les normes." },
          { name: "anomalie", label: "Résultat anormal à signaler en urgence", type: "checkbox" },
        ],
      },
      {
        name: "Prélèvement médico-légal (sang, toxicologie)",
        description: "Sur réquisition des forces de l'ordre : alcoolémie, stupéfiants.",
        fields: [
          { name: "analyses", label: "Recherche", type: "multi", required: true, options: ["Alcoolémie", "Stupéfiants", "Médicaments"] },
          { name: "requisition", label: "N° de réquisition", type: "text", half: true },
          { name: "autorite", label: "Autorité requérante", type: "text", half: true, hint: "Ex : LSPD, BCSO, agent X" },
        ],
        acceptFields: [{ name: "scelle", label: "N° de scellé", type: "text", required: true }],
        responseFields: [{ name: "resultats", label: "Résultats", type: "textarea", required: true }],
      },
    ],
  },
  {
    match: /imagerie|radiolog/i,
    presets: [
      {
        name: "Demande d'imagerie",
        description: "Radio, scanner ou IRM : le service rédige le compte rendu d'imagerie.",
        fields: [
          { name: "examen", label: "Examen souhaité", type: "select", required: true, half: true, options: ["Radiographie", "Scanner", "IRM", "Échographie", "Au choix du radiologue"] },
          { name: "zone", label: "Zone à explorer", type: "text", required: true, half: true, hint: "Ex : poignet droit, thorax, crâne" },
          { name: "question", label: "Question posée", type: "textarea", required: true, hint: "Ex : recherche de fracture, d'hémorragie intracrânienne…" },
          { name: "contre-indications", label: "Contre-indications connues", type: "multi", options: ["Allergie à l'iode", "Insuffisance rénale", "Grossesse possible", "Pacemaker / implant", "Éclat métallique", "Claustrophobie"] },
        ],
        responseDocument: "IMAGERIE",
      },
    ],
  },
  {
    match: /anesth/i,
    presets: [
      {
        name: "Consultation pré-anesthésique",
        description: "Obligatoire avant une intervention programmée.",
        fields: [
          { name: "intervention", label: "Intervention prévue", type: "text", required: true },
          { name: "date", label: "Date prévue", type: "date", half: true },
          { name: "urgence", label: "Intervention en urgence", type: "checkbox", half: true },
          { name: "antecedents", label: "Antécédents et traitements", type: "textarea" },
        ],
        responseFields: [
          { name: "asa", label: "Score ASA", type: "select", required: true, half: true, options: ["ASA 1", "ASA 2", "ASA 3", "ASA 4", "ASA 5"] },
          { name: "anesthesie", label: "Anesthésie prévue", type: "select", required: true, half: true, options: ["Générale", "Locorégionale", "Locale", "Sédation"] },
          { name: "apte", label: "Patient apte à l'intervention", type: "select", required: true, half: true, options: ["Apte", "Apte sous réserve", "Non apte"] },
          { name: "consignes", label: "Consignes (jeûne, traitements à arrêter…)", type: "textarea" },
        ],
      },
    ],
  },
  {
    match: /chirurg|ortho|viscéral|plastique|neurochir/i,
    presets: [
      {
        name: "Demande d'intervention chirurgicale",
        description: "Le service accepte en planifiant l'intervention.",
        fields: [
          { name: "intervention", label: "Intervention proposée", type: "text", required: true },
          { name: "indication", label: "Indication / lésions", type: "textarea", required: true },
          { name: "delai", label: "Délai", type: "select", required: true, half: true, options: ["Urgence immédiate", "Dans les 24 h", "Programmée"] },
        ],
        acceptFields: [
          { name: "date", label: "Date et heure prévues", type: "datetime", required: true, half: true },
          { name: "bloc", label: "Bloc / salle", type: "text", half: true },
        ],
        responseFields: [
          { name: "geste", label: "Geste réalisé", type: "textarea", required: true },
          { name: "suites", label: "Suites et consignes", type: "textarea" },
        ],
      },
      {
        name: "Demande d'avis chirurgical",
        description: "Avis sur un patient, sans intervention décidée.",
        fields: [URGENCE, { name: "question", label: "Question posée", type: "textarea", required: true }],
        responseFields: [{ name: "avis", label: "Avis", type: "textarea", required: true }],
      },
    ],
  },
  {
    match: /légale|legale/i,
    presets: [
      {
        name: "Examen médico-légal (constatation de blessures)",
        description: "Sur réquisition : le service constate et rédige le certificat.",
        fields: [
          { name: "motif", label: "Faits", type: "textarea", required: true, hint: "Agression, accident, garde à vue…" },
          { name: "autorite", label: "Autorité requérante", type: "text", half: true },
          { name: "requisition", label: "N° de réquisition", type: "text", half: true },
        ],
        acceptFields: [{ name: "requisition", label: "Réquisition vérifiée (n°)", type: "text", required: true }],
        responseFields: [{ name: "itt", label: "ITT (jours)", type: "number", half: true }, { name: "conclusion", label: "Conclusion", type: "textarea", required: true }],
        responseDocument: "CERTIFICAT",
      },
      {
        name: "Demande d'autopsie",
        description: "Le certificat de décès doit déjà être émis.",
        fields: [
          { name: "motif", label: "Motif / obstacle médico-légal", type: "textarea", required: true },
          { name: "autorite", label: "Autorité requérante", type: "text", half: true },
          { name: "requisition", label: "N° de réquisition", type: "text", half: true },
        ],
        requiredDocuments: ["DECES"],
        acceptFields: [{ name: "requisition", label: "Réquisition vérifiée (n°)", type: "text", required: true }],
        responseFields: [{ name: "cause", label: "Cause du décès retenue", type: "textarea", required: true }, { name: "constatations", label: "Constatations", type: "textarea" }],
      },
    ],
  },
  {
    match: /funèbre|funebre/i,
    presets: [
      {
        name: "Prise en charge d'un défunt",
        description: "Le certificat de décès doit déjà être émis.",
        fields: [
          { name: "famille", label: "Contact de la famille", type: "text", half: true },
          { name: "lieu", label: "Lieu où se trouve le corps", type: "text", half: true },
          { name: "souhaits", label: "Souhaits connus (inhumation, crémation…)", type: "textarea" },
        ],
        requiredDocuments: ["DECES"],
        responseFields: [{ name: "obseques", label: "Date des obsèques", type: "datetime" }, { name: "remarques", label: "Remarques", type: "textarea" }],
      },
    ],
  },
  {
    match: /kin[ée]/i,
    presets: [
      {
        name: "Prescription de rééducation",
        description: "Séances de kinésithérapie.",
        fields: [
          { name: "zone", label: "Zone / pathologie", type: "text", required: true },
          { name: "seances", label: "Nombre de séances", type: "number", half: true },
          { name: "objectif", label: "Objectif", type: "textarea", required: true },
        ],
        responseFields: [{ name: "bilan", label: "Bilan de fin de rééducation", type: "textarea", required: true }],
      },
    ],
  },
  {
    match: /infirm/i,
    presets: [
      {
        name: "Demande de soins infirmiers",
        description: "Pansements, injections, surveillance.",
        fields: [
          { name: "soins", label: "Soins", type: "multi", required: true, options: ["Pansement", "Prise de sang", "Injection", "Perfusion", "Surveillance des constantes", "Retrait de points / agrafes"] },
          { name: "frequence", label: "Fréquence / durée", type: "text", half: true },
          { name: "consignes", label: "Consignes", type: "textarea" },
        ],
        responseFields: [{ name: "transmissions", label: "Transmissions", type: "textarea", required: true }],
      },
    ],
  },
  {
    match: /psych|addicto/i,
    presets: [
      {
        name: "Demande d'avis psychiatrique / psychologique",
        description: "Évaluation, risque suicidaire, orientation.",
        fields: [
          { name: "motif", label: "Motif", type: "textarea", required: true },
          { name: "risque", label: "Risque suicidaire évalué", type: "select", half: true, options: ["Non évalué", "Faible", "Modéré", "Élevé"] },
          { name: "cadre", label: "Cadre de soins", type: "select", half: true, options: ["Soins libres", "À la demande d'un tiers", "Sur décision du représentant de l'État"] },
        ],
        responseFields: [{ name: "avis", label: "Avis et orientation", type: "textarea", required: true }],
      },
    ],
  },
  {
    match: /cardio|neuro|gyn|médecine générale|medecine generale/i,
    presets: [
      {
        name: "Demande d'avis spécialisé",
        description: "Avis du spécialiste sur un patient.",
        fields: [URGENCE, { name: "question", label: "Question posée", type: "textarea", required: true }],
        responseFields: [{ name: "avis", label: "Avis", type: "textarea", required: true }, { name: "suivi", label: "Revoir le patient en consultation", type: "checkbox" }],
      },
    ],
  },
  {
    match: /admin/i,
    presets: [
      {
        name: "Demande administrative",
        description: "Facturation, dossier, matériel, autre.",
        fields: [
          { name: "objet", label: "Objet", type: "select", required: true, options: ["Facturation", "Dossier patient", "Matériel", "Planning", "Autre"] },
          { name: "details", label: "Détails", type: "textarea", required: true },
        ],
        responseFields: [{ name: "reponse", label: "Réponse", type: "textarea", required: true }],
      },
    ],
  },
];

/** Modèles proposés pour un service (selon son nom et son identifiant). */
export function presetsFor(service: { name: string; slug: string }): RequestPreset[] {
  const text = `${service.name} ${service.slug}`;
  return PRESETS.filter((p) => p.match.test(text)).flatMap((p) => p.presets);
}
