import type { PrescriptionKind } from "@ocean/db";

/** Titre imprimé en haut du document. */
export const KIND_LABELS: Record<PrescriptionKind, string> = {
  ORDONNANCE: "Ordonnance",
  EXAMENS: "Prescription d'examens",
  CERTIFICAT: "Certificat médical",
};

/** Une ligne d'ordonnance : « CICALFATE+ crème » / « Appliquer… » / « QSP 3 mois ». */
export type PrescriptionItem = { name: string; instructions: string; quantity: string };

/** En-tête figé à l'émission : le PDF reste identique même si le dossier ou le profil changent ensuite. */
export type PrescriptionSnapshot = {
  hospitalName: string;
  hospitalCity: string;
  hospitalAddress: string;
  service: { name: string; head: { name: string; title: string | null } | null } | null;
  prescriber: { name: string; title: string | null; role: string | null; signatureUrl: string | null };
  patient: { firstName: string; lastName: string; birthDate: string | null; sex: string | null; number: string };
};
