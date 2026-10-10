import type { RequestKind, RequestPriority, RequestStatus } from "@ocean/db";
import type { FormField } from "./form-fields";

/** Libellés et formulaires intégrés des demandes (partagés navigateur / serveur). */

export const STATUS_LABELS: Record<RequestStatus, string> = {
  PENDING: "En attente",
  ACCEPTED: "Acceptée",
  REFUSED: "Refusée",
  COMPLETED: "Terminée",
  CANCELLED: "Annulée",
};
/** Pour un transfert, « acceptée » veut dire que le service a pris le patient en charge. */
export const statusLabel = (kind: RequestKind, status: RequestStatus) =>
  kind === "TRANSFERT" && status === "ACCEPTED" ? "Pris en charge" : STATUS_LABELS[status];

export const STATUS_STYLES: Record<RequestStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  ACCEPTED: "bg-sky-100 text-sky-800",
  REFUSED: "bg-red-100 text-red-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-slate-100 text-slate-600",
};

export const PRIORITY_LABELS: Record<RequestPriority, string> = { NORMAL: "Normale", URGENT: "Urgente", VITAL: "Urgence vitale" };
export const PRIORITY_STYLES: Record<RequestPriority, string> = {
  NORMAL: "",
  URGENT: "bg-orange-100 text-orange-800",
  VITAL: "bg-red-600 text-white",
};

/** Ce qui est figé à l'envoi : le type et ses formulaires (la configuration peut changer ensuite). */
export type TypeSnapshot = {
  name: string;
  fields: FormField[];
  acceptFields: FormField[];
  responseFields: FormField[];
  responseDocument: string | null;
};

/** Demande libre, toujours possible vers n'importe quel service (en plus des types configurés). */
export const GENERIC_REQUEST: TypeSnapshot = {
  name: "Demande d'avis / de prise en charge",
  fields: [{ name: "question", label: "Question / demande", type: "textarea", required: true }],
  acceptFields: [],
  responseFields: [{ name: "reponse", label: "Réponse", type: "textarea", required: true }],
  responseDocument: null,
};

/** Transfert de patient vers un service : il le prend en charge en acceptant. */
export const TRANSFER: TypeSnapshot = {
  name: "Transfert de patient",
  fields: [
    { name: "etat", label: "État du patient", type: "select", required: true, half: true, options: ["Stable", "Instable", "Critique"] },
    { name: "mode", label: "Mode de transfert", type: "select", half: true, options: ["Brancard", "Fauteuil", "À pied", "Ambulance (inter-sites)", "Hélicoptère"] },
    { name: "diagnostic", label: "Diagnostic / lésions", type: "textarea", required: true },
    { name: "soins", label: "Soins et traitements en cours", type: "textarea" },
    { name: "constantes", label: "Dernières constantes", type: "text", hint: "Ex : TA 12/8, FC 95, SpO2 97 %, GCS 15" },
  ],
  acceptFields: [{ name: "lieu", label: "Chambre / box d'accueil", type: "text" }],
  responseFields: [],
  responseDocument: null,
};

export const requestTitle = (r: { kind: RequestKind; typeSnapshot: unknown }) =>
  r.kind === "TRANSFERT" ? TRANSFER.name : ((r.typeSnapshot as Partial<TypeSnapshot>)?.name ?? GENERIC_REQUEST.name);

/** Formulaires figés d'une demande (anciens envois ou type supprimé : formulaire générique). */
export function snapshotOf(r: { kind: RequestKind; typeSnapshot: unknown }): TypeSnapshot {
  if (r.kind === "TRANSFERT") return TRANSFER;
  const s = r.typeSnapshot as Partial<TypeSnapshot> | null;
  if (!s?.name) return GENERIC_REQUEST;
  return { name: s.name, fields: s.fields ?? [], acceptFields: s.acceptFields ?? [], responseFields: s.responseFields ?? [], responseDocument: s.responseDocument ?? null };
}
