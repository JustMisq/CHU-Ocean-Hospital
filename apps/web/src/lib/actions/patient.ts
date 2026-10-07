"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logAction, prisma, queueBotEvent } from "@ocean/db";
import type { FormState } from "@/components/forms";
import { getSettings, requireUser } from "@/lib/session";
import { bookableStaffWhere, bookingRules, canPatientCancel, findFreeSlot } from "@/lib/slots";
import { formatDateTime } from "@/lib/time";

const bookingSchema = z.object({
  staffId: z.string().min(1),
  start: z.iso.datetime(),
  characterId: z.string().min(1, "Choisissez un personnage."),
  serviceId: z.string().optional(),
  reason: z.string().trim().min(3, "Indiquez le motif du rendez-vous.").max(500),
});

export async function bookAppointment(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = bookingSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { staffId, characterId, serviceId, reason } = parsed.data;

  const character = await prisma.character.findFirst({ where: { id: characterId, userId: user.id, archivedAt: null } });
  if (!character) return { error: "Personnage introuvable." };

  // Limite configurable pour éviter le spam de réservations.
  const maxUpcoming = Number((await getSettings()).maxUpcomingPerCharacter) || 3;
  const upcoming = await prisma.appointment.count({
    where: { characterId, start: { gt: new Date() }, status: { in: ["PENDING", "CONFIRMED"] } },
  });
  if (upcoming >= maxUpcoming) {
    return { error: `Ce personnage a déjà ${maxUpcoming} rendez-vous à venir.` };
  }

  const staff = await prisma.staffProfile.findFirst({
    where: { id: staffId, ...bookableStaffWhere },
    include: { services: { where: { isPublic: true } } },
  });
  if (!staff) return { error: "Ce soignant n'est plus disponible." };
  if (staff.userId === user.id) return { error: "Vous ne pouvez pas prendre rendez-vous avec vous-même." };
  const service = staff.services.find((s) => s.id === serviceId) ?? staff.services[0] ?? null;

  // Revérification + création dans une transaction sérialisable : deux réservations
  // simultanées du même créneau ne peuvent pas passer toutes les deux.
  const rules = await bookingRules();
  const appointment = await prisma
    .$transaction(
      async (tx) => {
        const slot = await findFreeSlot(staffId, new Date(parsed.data.start), tx, rules);
        if (!slot) return null;
        return tx.appointment.create({
          data: { characterId, staffId, serviceId: service?.id, start: slot.start, end: slot.end, reason, status: "CONFIRMED" },
        });
      },
      { isolationLevel: "Serializable" },
    )
    .catch((e: unknown) => {
      // P2034 : conflit d'écriture avec une autre réservation, le créneau est donc pris.
      if (e && typeof e === "object" && "code" in e && e.code === "P2034") return null;
      throw e;
    });
  if (!appointment) return { error: "Ce créneau vient d'être pris. Choisissez-en un autre." };

  await queueBotEvent("appointment.created", { appointmentId: appointment.id });
  revalidatePath("/espace");
  redirect(`/espace?rdv=${appointment.id}`);
}

export async function cancelAppointmentAsPatient(data: FormData) {
  const user = await requireUser();
  const id = String(data.get("id"));
  const appointment = await prisma.appointment.findFirst({
    where: { id, character: { userId: user.id }, status: { in: ["PENDING", "CONFIRMED"] } },
    include: { character: { select: { firstName: true, lastName: true } }, staff: { select: { displayName: true } } },
  });
  if (!appointment || !canPatientCancel(appointment.start, await bookingRules())) return;

  await prisma.appointment.update({ where: { id }, data: { status: "CANCELLED", cancelReason: "Annulé par le patient" } });
  await queueBotEvent("appointment.cancelled", { appointmentId: id, by: "patient" });
  const { character, staff } = appointment;
  await logAction(user.id, "appointment.cancel_patient", `Annulation par le patient : ${character.firstName} ${character.lastName} (RDV de ${staff.displayName}, ${formatDateTime(appointment.start)})`);
  revalidatePath("/espace");
  revalidatePath("/pro");
}

const characterSchema = z.object({
  firstName: z.string().trim().min(1, "Prénom requis.").max(40),
  lastName: z.string().trim().min(1, "Nom requis.").max(40),
  birthDate: z.iso.date("Date de naissance invalide."),
  phone: z.string().trim().max(20).optional(),
  bloodType: z.enum(["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]).optional(),
  allergies: z.string().trim().max(300).optional(),
});

export async function createCharacter(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser("/espace/personnages");
  const parsed = characterSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const maxCharacters = Number((await getSettings()).maxCharactersPerUser) || 5;
  if ((await prisma.character.count({ where: { userId: user.id, archivedAt: null } })) >= maxCharacters) {
    return { error: `Maximum ${maxCharacters} personnages par compte.` };
  }

  const { birthDate, phone, bloodType, allergies, ...rest } = parsed.data;
  await prisma.character.create({
    data: {
      ...rest,
      userId: user.id,
      birthDate: new Date(birthDate),
      phone: phone || null,
      bloodType: bloodType || null,
      allergies: allergies || null,
    },
  });

  const back = data.get("retour");
  if (typeof back === "string" && back.startsWith("/") && !back.startsWith("//")) redirect(back);
  revalidatePath("/espace/personnages");
  return { ok: "Personnage ajouté." };
}

/**
 * Sans rendez-vous : suppression réelle. Sinon le personnage est archivé : il disparaît
 * de l'espace du joueur mais son dossier reste consultable par les soignants.
 */
export async function deleteCharacter(data: FormData) {
  const user = await requireUser("/espace/personnages");
  const character = await prisma.character.findFirst({
    where: { id: String(data.get("id")), userId: user.id, archivedAt: null },
    include: { _count: { select: { appointments: true } } },
  });
  if (!character) return;

  if (character._count.appointments === 0) {
    await prisma.character.delete({ where: { id: character.id } });
  } else {
    const upcoming = await prisma.appointment.findMany({
      where: { characterId: character.id, status: { in: ["PENDING", "CONFIRMED"] }, start: { gt: new Date() } },
      select: { id: true },
    });
    await prisma.$transaction([
      prisma.appointment.updateMany({
        where: { id: { in: upcoming.map((a) => a.id) } },
        data: { status: "CANCELLED", cancelReason: "Personnage supprimé par le joueur" },
      }),
      prisma.character.update({ where: { id: character.id }, data: { archivedAt: new Date() } }),
    ]);
    for (const a of upcoming) await queueBotEvent("appointment.cancelled", { appointmentId: a.id, by: "patient" });
  }
  revalidatePath("/espace");
  revalidatePath("/espace/personnages");
}
