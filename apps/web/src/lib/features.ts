import { parseRoleIds } from "@ocean/db";

/**
 * Discord est optionnel : connexion Discord, synchro des rôles et réglages associés
 * n'apparaissent que si l'application Discord est configurée dans les variables d'environnement.
 * Sans elles, le site fonctionne uniquement avec identifiant + mot de passe.
 */
export const discordEnabled = Boolean(process.env.AUTH_DISCORD_ID && process.env.AUTH_DISCORD_SECRET);

/** Élément (grade, service, spécialité) piloté par un rôle Discord. Toujours faux si Discord est désactivé. */
export const isDiscordLinked = (x: { discordRoleIds: string }) => discordEnabled && parseRoleIds(x.discordRoleIds).length > 0;

/** Connexion de démo sans mot de passe (comptes du seed). À couper en production. */
export const devLoginEnabled = process.env.AUTH_DEV_LOGIN === "true";
