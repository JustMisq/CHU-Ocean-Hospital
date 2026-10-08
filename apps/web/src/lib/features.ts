/** Connexion de démo sans mot de passe (comptes du seed). À couper en production. */
export const devLoginEnabled = process.env.AUTH_DEV_LOGIN === "true";

/** Identifiants des comptes de démo créés par le seed. */
export const DEMO_LOGIN_PREFIX = "demo-";
