"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logAction, prisma } from "@ocean/db";
import type { FormState } from "@/components/forms";
import { canAccessPatient } from "@/lib/characters";
import { KIND_LABELS, type PrescriptionItem } from "@/lib/prescription-types";
import { buildSnapshot, createWithNumber } from "@/lib/prescriptions";
import { getSettings, requireStaff } from "@/lib/session";

const MAX_ITEMS = 15;

const prescriptionSchema = z.object({
  characterId: z.string().min(1),
  appointmentId: z.string().optional(),
  kind: z.enum(["ORDONNANCE", "EXAMENS", "CERTIFICAT"]),
  serviceId: z.string().optional(),
  body: z.string().trim().max(3000).default(""),
  validityMonths: z.coerce.number().int().min(1, "Validité : 1 à 12 mois.").max(12, "Validité : 1 à 12 mois.").default(3),
  renewable: z.literal("on").optional(),
});

/** Lignes du formulaire (champs répétés itemName / itemInstructions / itemQuantity), lignes vides ignorées. */
function readItems(data: FormData): PrescriptionItem[] {
  const names = data.getAll("itemName").map(String);
  const instructions = data.getAll("itemInstructions").map(String);
  const quantities = data.getAll("itemQuantity").map(String);
  return names
    .map((name, i) => ({ name: name.trim().slice(0, 150), instructions: (instructions[i] ?? "").trim().slice(0, 600), quantity: (quantities[i] ?? "").trim().slice(0, 80) }))
    .filter((item) => item.name)
    .slice(0, MAX_ITEMS);
}

export async function createPrescription(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireStaff("prescriptions.write");
  const parsed = prescriptionSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { characterId, kind, body, validityMonths } = parsed.data;
  if (!(await canAccessPatient(user, characterId))) return { error: "Accès au dossier non autorisé." };

  const items = kind === "CERTIFICAT" ? [] : readItems(data);
  if (kind !== "CERTIFICAT" && items.length === 0) return { error: "Ajoutez au moins une ligne." };
  if (kind === "CERTIFICAT" && !body) return { error: "Rédigez le contenu du certificat." };

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
  const prefix = (service?.code || "ORD").toUpperCase();
  const prescription = await createWithNumber(prefix, {
    kind,
    characterId,
    staffId: user.staff.id,
    serviceId: service?.id,
    appointmentId: appointment?.id,
    items,
    body,
    renewable: parsed.data.renewable === "on",
    validityMonths,
    snapshot,
  });

  const patientName = `${snapshot.patient.firstName} ${snapshot.patient.lastName}`;
  await logAction(user.id, "prescription.create", `${KIND_LABELS[kind]} ${prescription.number} pour ${patientName}`);
  revalidatePath(`/pro/patients/${characterId}`);
  redirect(`/pro/patients/${characterId}?ordonnance=${prescription.id}`);
}

/** Une ordonnance émise n'est jamais modifiée ni supprimée : on peut seulement l'annuler (auteur ou super-admin). */
export async function revokePrescription(data: FormData) {
  const user = await requireStaff();
  const prescription = await prisma.prescription.findUnique({ where: { id: String(data.get("id")) } });
  if (!prescription || prescription.revokedAt) return;
  if (prescription.staffId !== user.staff.id && !user.isAdmin) return;

  const reason = String(data.get("reason") ?? "").trim().slice(0, 300) || null;
  await prisma.prescription.update({ where: { id: prescription.id }, data: { revokedAt: new Date(), revokedReason: reason } });
  await logAction(user.id, "prescription.revoke", `${KIND_LABELS[prescription.kind]} ${prescription.number} annulée${reason ? ` — « ${reason} »` : ""}`);
  revalidatePath(`/pro/patients/${prescription.characterId}`);
}
