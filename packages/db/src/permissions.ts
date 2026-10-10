import { DocumentKind } from "../generated/prisma/enums";

/**
 * Permissions attribuables aux grades depuis /pro/config/grades.
 * Tout membre ayant un grade a accès à son propre agenda et à son profil.
 */
export const PERMISSIONS = {
  "patients.history": "Dossiers patients : consulter l'historique et compléter les infos",
  "agenda.view_all": "Voir l'agenda de tout l'hôpital",
  "appointments.manage_all": "Gérer les rendez-vous de tous les soignants",
  "documents.view_all": "Zone Documents : voir les documents de tout l'hôpital (sinon seulement les siens)",
  "documents.revoke_all": "Annuler les documents rédigés par d'autres soignants",
  "requests.view_all": "Demandes et transferts : voir et traiter ceux de tout l'hôpital (sinon ceux de ses services)",
  "requests.configure": "Demandes : configurer les types de demandes de tous les services (un chef de service peut toujours le faire pour le sien)",
  "staff.manage": "Gérer le personnel (grades, services, spécialités)",
  "staff.manage_peers": "Gérer aussi son propre profil et ceux de même grade (services, spécialités, annuaire — pas le grade)",
  "stats.view": "Voir les statistiques",
  "audit.view": "Consulter le journal (personnel, configuration, annulations)",
  "settings.manage": "Configurer le site (services, grades, spécialités)",
} as const;

export const DOCUMENT_KINDS = Object.values(DocumentKind) as DocumentKind[];

/**
 * Accès par type de document : `doc.read.<TYPE>` (lire) et `doc.write.<TYPE>` (rédiger, ce qui inclut la lecture).
 * Le joueur voit toujours ses propres documents, et un soignant ceux qu'il a rédigés.
 */
export type DocAccess = "read" | "write";
export type DocPermission = `doc.${DocAccess}.${DocumentKind}`;
export const docPermission = (access: DocAccess, kind: DocumentKind): DocPermission => `doc.${access}.${kind}`;

export type Permission = keyof typeof PERMISSIONS | DocPermission;

const DOC_PERMISSIONS = DOCUMENT_KINDS.flatMap((k) => [docPermission("read", k), docPermission("write", k)]);
export const ALL_PERMISSIONS = [...(Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[]), ...DOC_PERMISSIONS] as Permission[];
const KNOWN = new Set<string>(ALL_PERMISSIONS);

export function parsePermissions(value: string): Permission[] {
  return value.split(",").filter((p): p is Permission => KNOWN.has(p));
}

/** Niveau d'accès d'un ensemble de permissions à un type de document. */
export function docAccess(permissions: readonly Permission[], kind: DocumentKind): DocAccess | null {
  if (permissions.includes(docPermission("write", kind))) return "write";
  if (permissions.includes(docPermission("read", kind))) return "read";
  return null;
}
