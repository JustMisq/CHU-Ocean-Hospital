"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logAction, normalizeLogin, prisma, type DocumentKind } from "@ocean/db";
import type { FormState } from "@/components/forms";
import { UNKNOWN_LAST_NAME, medicalInfoSchema, observationSchema } from "@/lib/characters";
import { DOCUMENT_KINDS, DOCUMENT_TYPES, readFields, type DocumentItem } from "@/lib/document-types";
import { buildSnapshot, canRevokeDocument, createWithNumber } from "@/lib/documents";
import { parseImaging } from "@/lib/imaging/catalog";
import { getSettings, requireStaff } from "@/lib/session";
import { parseLocal } from "@/lib/time";

const MAX_ITEMS = 15;

const documentSchema = z.object({
  characterId: z.string().min(1, "Choisissez un patient."),
  appointmentId: z.string().optional(),
  kind: z.enum(DOCUMENT_KINDS as [DocumentKind, ...DocumentKind[]]),
  serviceId: z.string().optional(),
  body: z.string().trim().max(3000).default(""),
  validityMonths: z.coerce.number().int().min(1, "Validité : 1 à 12 mois.").max(12, "Validité : 1 à 12 mois.").default(3),
  renewable: z.literal("on").optional(),
});

/** Lignes du formulaire (champs répétés itemName / itemInstructions / itemQuantity), lignes vides ignorées. */
function readItems(data: FormData): DocumentItem[] {
  const names = data.getAll("itemName").map(String);
  const instructions = data.getAll("itemInstructions").map(String);
  const quantities = data.getAll("itemQuantity").map(String);
  return names
    .map((name, i) => ({ name: name.trim().slice(0, 150), instructions: (instructions[i] ?? "").trim().slice(0, 600), quantity: (quantities[i] ?? "").trim().slice(0, 80) }))
    .filter((item) => item.name)
    .slice(0, MAX_ITEMS);
}

/**
 * Rédaction : il faut le droit « rédaction » sur ce type de document (réglé par grade).
 * On peut alors rédiger pour n'importe quel dossier (y compris sans compte), et on y a ensuite accès.
 */
export async function createDocument(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireStaff();
  const parsed = documentSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { characterId, kind, body, validityMonths } = parsed.data;
  const type = DOCUMENT_TYPES[kind];
  if (!user.canWriteDoc(kind)) return { error: `Votre grade ne permet pas de rédiger : ${type.label}.` };

  const character = await prisma.character.findUnique({ where: { id: characterId }, select: { id: true } });
  if (!character) return { error: "Dossier patient introuvable." };

  const items = type.items ? readItems(data) : [];
  if (type.items && items.length === 0) return { error: "Ajoutez au moins une ligne." };
  if (type.body.required && !body) return { error: `Champ requis : ${type.body.label}.` };
  // Imagerie : données de l'éditeur (carte, lésions, compte rendu), revalidées ici.
  let fields: { error: string } | { data: object };
  if (type.custom === "imaging") {
    let raw: unknown = null;
    try {
      raw = JSON.parse(String(data.get("imaging") ?? "null"));
    } catch {
      return { error: "Données d'imagerie illisibles." };
    }
    fields = parseImaging(raw);
  } else {
    fields = readFields(type, data);
  }
  if ("error" in fields) return fields;

  // Service : un de ceux du soignant (n'importe lequel pour un super-admin).
  const service = parsed.data.serviceId
    ? await prisma.service.findFirst({
        where: { id: parsed.data.serviceId, ...(!user.isAdmin && { staff: { some: { id: user.staff.id } } }) },
      })
    : null;
  const appointment = parsed.data.appointmentId
    ? await prisma.appointment.findFirst({ where: { id: parsed.data.appointmentId, characterId }, select: { id: true } })
    : null;

  const settings = await getSettings();
  const snapshot = await buildSnapshot({ characterId, staffId: user.staff.id, serviceId: service?.id ?? null, settings });
  const document = await createWithNumber((service?.code || type.prefix).toUpperCase(), {
    kind,
    characterId,
    staffId: user.staff.id,
    serviceId: service?.id,
    appointmentId: appointment?.id,
    items,
    body,
    data: fields.data as object,
    renewable: Boolean(type.renewable) && parsed.data.renewable === "on",
    validityMonths: type.validity ? validityMonths : 0,
    snapshot,
  });

  // Le certificat de décès marque le dossier (plus de prise de RDV possible).
  if (kind === "DECES") {
    const [date, time] = String((fields.data as Record<string, unknown>).deathAt).split("T");
    await prisma.character.update({ where: { id: characterId }, data: { deceasedAt: parseLocal(date, time) } });
  }

  const patientName = `${snapshot.patient.firstName} ${snapshot.patient.lastName}`;
  await logAction(user.id, "document.create", `${type.label} ${document.number} pour ${patientName}`);
  revalidatePath(`/pro/patients/${characterId}`);
  revalidatePath("/pro/documents");
  redirect(`/pro/patients/${characterId}?document=${document.id}`);
}

/** Un document émis n'est jamais modifié ni supprimé : on peut seulement l'annuler (voir canRevokeDocument). */
export async function revokeDocument(data: FormData) {
  const user = await requireStaff();
  const document = await prisma.medicalDocument.findUnique({ where: { id: String(data.get("id")) } });
  if (!document || document.revokedAt) return;
  if (!canRevokeDocument(user, document)) return;

  const reason = String(data.get("reason") ?? "").trim().slice(0, 300) || null;
  await prisma.medicalDocument.update({ where: { id: document.id }, data: { revokedAt: new Date(), revokedReason: reason } });
  // Certificat de décès annulé (erreur, réanimation RP…) : le dossier n'est plus marqué décédé s'il n'en reste aucun valide.
  if (document.kind === "DECES") {
    const remaining = await prisma.medicalDocument.count({ where: { characterId: document.characterId, kind: "DECES", revokedAt: null } });
    if (!remaining) await prisma.character.update({ where: { id: document.characterId }, data: { deceasedAt: null } });
  }
  await logAction(user.id, "document.revoke", `${DOCUMENT_TYPES[document.kind].label} ${document.number} annulé(e)${reason ? ` — « ${reason} »` : ""}`);
  revalidatePath(`/pro/patients/${document.characterId}`);
  revalidatePath("/pro/documents");
}

// ─── Dossiers sans compte ────────────────────────────────────────────────────

const dossierSchema = z
  .object({
    firstName: z.string().trim().max(40).default(""),
    lastName: z.string().trim().max(40).default(""),
  })
  .extend(medicalInfoSchema.shape)
  .extend(observationSchema.shape);

/**
 * Dossier pour quelqu'un qui n'a pas de compte sur le site : rattaché plus tard à son compte.
 * Nom inconnu : « INCONNU X-0003 » (numéro suivant), avec ce qu'on observe (âge apparent, signes distinctifs…).
 */
export async function createDossier(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireStaff();
  if (user.writableKinds.length === 0) return { error: "Votre grade ne permet de rédiger aucun document." };
  const parsed = dossierSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const kind = String(data.get("kind") ?? "");
  const { firstName, lastName, ...rest } = parsed.data;

  let identity = { firstName, lastName };
  if (!firstName && !lastName) {
    const count = await prisma.character.count({ where: { lastName: UNKNOWN_LAST_NAME } });
    identity = { firstName: `X-${String(count + 1).padStart(4, "0")}`, lastName: UNKNOWN_LAST_NAME };
  } else if (!firstName || !lastName) {
    // Un seul des deux connu (« Tony », surnom…) : l'autre reste à compléter.
    identity = { firstName: firstName || "?", lastName: lastName || "?" };
  }

  const dossier = await prisma.character.create({ data: { ...rest, ...identity, userId: null } });
  await logAction(user.id, "dossier.create", `Dossier sans compte créé : ${dossier.firstName} ${dossier.lastName}`);
  const params = new URLSearchParams({ patient: dossier.id, ...(DOCUMENT_KINDS.includes(kind as DocumentKind) && { type: kind }) });
  redirect(`/pro/documents/nouveau?${params}`);
}

/**
 * Rattache un dossier sans compte au compte du joueur :
 * - `target` = "new" : il devient un de ses personnages ;
 * - `target` = id d'un de ses personnages : fusion (RDV et documents déplacés, infos manquantes complétées, dossier supprimé).
 */
export async function linkDossier(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireStaff("patients.history");
  const dossier = await prisma.character.findFirst({ where: { id: String(data.get("id")), userId: null } });
  if (!dossier) return { error: "Ce dossier est déjà rattaché à un compte." };
  const account = await prisma.user.findUnique({ where: { login: normalizeLogin(String(data.get("login") ?? "")) } });
  if (!account) return { error: "Aucun compte avec cet identifiant." };
  const target = String(data.get("target") ?? "");
  const dossierName = `${dossier.firstName} ${dossier.lastName}`;

  if (target === "new") {
    await prisma.character.update({ where: { id: dossier.id }, data: { userId: account.id } });
    await logAction(user.id, "dossier.link", `Dossier ${dossierName} rattaché au compte ${account.login}`);
    revalidatePath(`/pro/patients/${dossier.id}`);
    return { ok: `Dossier rattaché au compte ${account.login} : le joueur le retrouve dans ses personnages.` };
  }

  const into = await prisma.character.findFirst({ where: { id: target, userId: account.id } });
  if (!into) return { error: "Choisissez un personnage de ce compte." };

  // Infos du dossier provisoire reprises seulement si le personnage ne les a pas déjà.
  const fill = {
    birthDate: into.birthDate ?? dossier.birthDate,
    sex: into.sex ?? dossier.sex,
    phone: into.phone ?? dossier.phone,
    bloodType: into.bloodType ?? dossier.bloodType,
    allergies: into.allergies ?? dossier.allergies,
    deceasedAt: into.deceasedAt ?? dossier.deceasedAt,
  };
  const moveNumber = !into.patientNumber && dossier.patientNumber;
  await prisma.$transaction([
    prisma.appointment.updateMany({ where: { characterId: dossier.id }, data: { characterId: into.id } }),
    prisma.medicalDocument.updateMany({ where: { characterId: dossier.id }, data: { characterId: into.id } }),
    // Le n° patient est unique : on le libère avant de le reporter.
    prisma.character.delete({ where: { id: dossier.id } }),
    prisma.character.update({ where: { id: into.id }, data: { ...fill, ...(moveNumber && { patientNumber: dossier.patientNumber }) } }),
  ]);
  await logAction(user.id, "dossier.merge", `Dossier ${dossierName} fusionné avec ${into.firstName} ${into.lastName} (compte ${account.login})`);
  redirect(`/pro/patients/${into.id}`);
}
