import { randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;
const KEY_LENGTH = 64;

/** Hachage scrypt (natif Node, aucune dépendance) : "scrypt$<sel>$<hash>" en base64. */
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algo, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scryptAsync(password, Buffer.from(salt, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

/** Mot de passe temporaire facile à dicter en jeu : sans caractères ambigus (0/O, 1/l…). */
export function generateTempPassword(length = 10) {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length }, () => alphabet[randomInt(alphabet.length)]).join("");
}

/** Identifiant de connexion : 3 à 32 caractères, lettres, chiffres, point, tiret, underscore. */
export const LOGIN_PATTERN = /^[a-z0-9._-]{3,32}$/;
export const normalizeLogin = (login: string) => login.trim().toLowerCase();
