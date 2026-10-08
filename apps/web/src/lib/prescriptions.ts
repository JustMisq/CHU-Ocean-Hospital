import "server-only";
import { prisma, type Prisma } from "@ocean/db";
import { canAccessPatient } from "./characters";
import type { PrescriptionSnapshot } from "./prescription-types";
import type { CurrentUser } from "./session";
import { dayKey } from "./time";

const IMAGE_PREFIX = "/api/images/";

const isUniqueViolation = (e: unknown) => Boolean(e && typeof e === "object" && "code" in e && e.code === "P2002");

/** "2026-09-25" → "202609" */
const monthKey = (d: Date) => dayKey(d).slice(0, 7).replace("-", "");

/** Numéro patient imprimé sur les documents (PAT-202607-6436), attribué une fois pour toutes. */
export async function ensurePatientNumber(character: { id: string; createdAt: Date; patientNumber: string | null }) {
  if (character.patientNumber) return character.patientNumber;
  for (let attempt = 0; attempt < 10; attempt++) {
    const number = `PAT-${monthKey(character.createdAt)}-${String(Math.floor(Math.random() * 10_000)).padStart(4, "0")}`;
    try {
      // updateMany + patientNumber: null : si une autre requête l'a attribué entre-temps, on garde le sien.
      await prisma.character.updateMany({ where: { id: character.id, patientNumber: null }, data: { patientNumber: number } });
      const saved = await prisma.character.findUniqueOrThrow({ where: { id: character.id }, select: { patientNumber: true } });
      return saved.patientNumber!;
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
    }
  }
  throw new Error("Impossible d'attribuer un numéro patient.");
}

/** Copie la signature du soignant : la changer plus tard ne modifie pas les ordonnances déjà émises. */
async function copySignature(url: string | null) {
  if (!url?.startsWith(IMAGE_PREFIX)) return null;
  const image = await prisma.image.findUnique({ where: { id: url.slice(IMAGE_PREFIX.length) } });
  if (!image) return null;
  const copy = await prisma.image.create({ data: { mimeType: image.mimeType, data: image.data } });
  return IMAGE_PREFIX + copy.id;
}

/** Image stockée en base (signature figée d'une ordonnance), pour le PDF. */
export async function loadStoredImage(url: string | null) {
  if (!url?.startsWith(IMAGE_PREFIX)) return null;
  return prisma.image.findUnique({ where: { id: url.slice(IMAGE_PREFIX.length) } });
}

export async function buildSnapshot({ characterId, staffId, serviceId, settings }: {
  characterId: string;
  staffId: string;
  serviceId: string | null;
  settings: { hospitalName: string; hospitalCity: string; hospitalAddress: string };
}): Promise<PrescriptionSnapshot> {
  const [character, staff, service] = await Promise.all([
    prisma.character.findUniqueOrThrow({ where: { id: characterId } }),
    prisma.staffProfile.findUniqueOrThrow({ where: { id: staffId }, include: { grade: true } }),
    serviceId ? prisma.service.findUnique({ where: { id: serviceId }, include: { head: true } }) : null,
  ]);

  const isHead = service?.headId === staff.id;
  const role = isHead ? `Chef de service — ${service.name}` : [staff.grade?.name, service?.name].filter(Boolean).join(" — ") || null;

  return {
    hospitalName: settings.hospitalName,
    hospitalCity: settings.hospitalCity,
    hospitalAddress: settings.hospitalAddress,
    service: service && {
      name: service.name,
      head: service.head && { name: service.head.displayName, title: service.head.jobTitle },
    },
    prescriber: { name: staff.displayName, title: staff.jobTitle, role, signatureUrl: await copySignature(staff.signatureUrl) },
    patient: {
      firstName: character.firstName,
      lastName: character.lastName,
      birthDate: character.birthDate?.toISOString() ?? null,
      sex: character.sex,
      number: await ensurePatientNumber(character),
    },
  };
}

/**
 * Crée l'ordonnance avec le prochain numéro du mois pour ce préfixe (KINE-202609-0001…).
 * Deux créations simultanées peuvent viser le même numéro : la contrainte unique tranche, on réessaie.
 */
export async function createWithNumber(prefix: string, data: Omit<Prisma.PrescriptionUncheckedCreateInput, "number">) {
  const base = `${prefix}-${monthKey(new Date())}-`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const count = await prisma.prescription.count({ where: { number: { startsWith: base } } });
    try {
      return await prisma.prescription.create({ data: { ...data, number: base + String(count + 1 + attempt).padStart(4, "0") } });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
    }
  }
  throw new Error("Impossible d'attribuer un numéro d'ordonnance.");
}

/** Le patient (propriétaire du personnage) ou un soignant ayant accès à son dossier. */
export async function canViewPrescription(user: CurrentUser, prescription: { characterId: string; character: { userId: string } }) {
  if (prescription.character.userId === user.id) return true;
  return (user.isStaff || user.isAdmin) && (await canAccessPatient(user, prescription.characterId));
}
