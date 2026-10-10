import "server-only";
import { z } from "zod";
import { prisma, type AppointmentStatus, type Character, type Permission } from "@ocean/db";

export const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export const SEXES = { M: "Homme", F: "Femme", X: "Autre" } as const;

/** Infos complémentaires d'un dossier : toutes facultatives, complétées par le joueur ou un soignant. */
export const medicalInfoSchema = z.object({
  birthDate: z.union([z.literal(""), z.iso.date("Date de naissance invalide.")]).optional().transform((v) => (v ? new Date(v) : null)),
  phone: z.string().trim().max(20).optional().transform((v) => v || null),
  bloodType: z.enum(["", ...BLOOD_TYPES]).optional().transform((v) => v || null),
  sex: z.enum(["", "M", "F", "X"]).optional().transform((v) => v || null),
  allergies: z.string().trim().max(300).optional().transform((v) => v || null),
});

/** Ce qu'on observe chez un patient non identifié (ou sans compte), à la place de l'état civil. */
export const observationSchema = z.object({
  apparentAge: z.string().trim().max(30).optional().transform((v) => v || null),
  description: z.string().trim().max(600).optional().transform((v) => v || null),
});

/** Nom de famille des patients non identifiés : « INCONNU X-0003 ». */
export const UNKNOWN_LAST_NAME = "INCONNU";
export const isUnidentified = (c: { lastName: string }) => c.lastName === UNKNOWN_LAST_NAME;

export const identitySchema = z.object({
  firstName: z.string().trim().min(1, "Prénom requis.").max(40),
  lastName: z.string().trim().min(1, "Nom requis.").max(40),
});

/**
 * Dossier patient : permission « dossiers patients », ou soignant ayant déjà eu ce patient en RDV,
 * ou lui ayant rédigé un document (ex : certificat sur intervention pour quelqu'un sans compte),
 * ou concerné par une demande / un transfert à son sujet (envoyée par lui, ou reçue par un de ses services).
 */
export async function canAccessPatient(user: { staff: { id: string } | null; can: (p: Permission) => boolean }, characterId: string) {
  if (user.can("patients.history")) return true;
  if (!user.staff) return false;
  const staffId = user.staff.id;
  const inService = { OR: [{ staff: { some: { id: staffId } } }, { headId: staffId }] };
  const [appointments, documents, requests] = await Promise.all([
    prisma.appointment.count({ where: { characterId, staffId } }),
    prisma.medicalDocument.count({ where: { characterId, staffId } }),
    prisma.serviceRequest.count({
      where: { characterId, OR: [{ authorId: staffId }, { recipientId: staffId }, { assigneeId: staffId }, { toService: inService }] },
    }),
  ]);
  return appointments + documents + requests > 0;
}

/** Ce qui manque au dossier pour être exploitable par un soignant (rien à réclamer pour un inconnu). */
export function missingInfo(c: Pick<Character, "birthDate" | "bloodType"> & { lastName?: string }) {
  if (c.lastName && isUnidentified({ lastName: c.lastName })) return [];
  return [!c.birthDate && "date de naissance", !c.bloodType && "groupe sanguin"].filter((x): x is string => Boolean(x));
}

/** Assiduité d'un patient : RDV pris (hors annulés), honorés et manqués (« patient absent »). */
export type Attendance = { total: number; completed: number; noShow: number };

export function attendanceOf(statuses: AppointmentStatus[]): Attendance {
  return {
    total: statuses.filter((s) => s !== "CANCELLED").length,
    completed: statuses.filter((s) => s === "COMPLETED").length,
    noShow: statuses.filter((s) => s === "NO_SHOW").length,
  };
}

export async function getAttendance(characterId: string) {
  const rows = await prisma.appointment.findMany({ where: { characterId }, select: { status: true } });
  return attendanceOf(rows.map((r) => r.status));
}

/** "Pr. Antoine Leclerc" → { firstName: "Antoine", lastName: "Leclerc" } (titres retirés). */
export function splitName(fullName: string) {
  const parts = fullName
    .replace(/^((dr|pr|prof|docteur|professeur|mme|mlle|mr|m)\.?\s+)+/i, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return { firstName: (parts[0] ?? "Sans").slice(0, 40), lastName: (parts.slice(1).join(" ") || "Nom").slice(0, 40) };
}

/**
 * Tout compte a au moins un personnage : s'il n'en a aucun (compte créé par la direction, ancien compte…),
 * on en crée un à partir de son nom. Le joueur ou un soignant complète ensuite les infos.
 */
export async function ensureCharacter(user: { id: string; username: string }) {
  if (await prisma.character.count({ where: { userId: user.id, archivedAt: null } })) return;
  await prisma.character.create({ data: { userId: user.id, ...splitName(user.username) } });
}
