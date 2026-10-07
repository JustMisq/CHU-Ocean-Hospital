/**
 * Permissions attribuables aux grades depuis /pro/config/grades.
 * Tout membre ayant un grade a accès à son propre agenda et à son profil.
 */
export const PERMISSIONS = {
  "patients.history": "Dossiers patients : consulter l'historique et compléter les infos",
  "agenda.view_all": "Voir l'agenda de tout l'hôpital",
  "appointments.manage_all": "Gérer les rendez-vous de tous les soignants",
  "staff.manage": "Gérer le personnel (grades, services, spécialités)",
  "stats.view": "Voir les statistiques",
  "audit.view": "Consulter le journal (personnel, configuration, annulations)",
  "settings.manage": "Configurer le site (services, grades, spécialités, Discord)",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export function parsePermissions(value: string): Permission[] {
  return value.split(",").filter((p): p is Permission => p in PERMISSIONS);
}

/** "123, 456 789" → ["123", "456", "789"] */
export function parseRoleIds(value: string): string[] {
  return value.split(/[\s,;]+/).filter(Boolean);
}
