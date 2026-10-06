"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma, queueBotEvent } from "@ocean/db";
import type { FormState } from "@/components/forms";
import { getSettings, requireUser } from "@/lib/session";
import { bookableStaffWhere, bookingRules, findFreeSlot } from "@/lib/slots";

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

  const character = await prisma.character.findFirst({ where: { id: characterId, userId: user.id } });
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
  const service = staff.services.find((s) => s.id === serviceId) ?? staff.services[0] ?? null;

  // Revérification + création dans une transaction pour éviter les doubles réservations.
  const rules = await bookingRules();
  const appointment = await prisma.$transaction(async (tx) => {
    const slot = await findFreeSlot(staffId, new Date(parsed.data.start), tx, rules);
    if (!slot) return null;
    return tx.appointment.create({
      data: { characterId, staffId, serviceId: service?.id, start: slot.start, end: slot.end, reason, status: "CONFIRMED" },
    });
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
    where: { id, character: { userId: user.id }, status: { in: ["PENDING", "CONFIRMED"] }, start: { gt: new Date() } },
  });
  if (!appointment) return;

  await prisma.appointment.update({ where: { id }, data: { status: "CANCELLED", cancelReason: "Annulé par le patient" } });
  await queueBotEvent("appointment.cancelled", { appointmentId: id, by: "patient" });
  revalidatePath("/espace");
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
  if ((await prisma.character.count({ where: { userId: user.id } })) >= maxCharacters) {
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

export async function deleteCharacter(data: FormData) {
  const user = await requireUser("/espace/personnages");
  await prisma.character.deleteMany({ where: { id: String(data.get("id")), userId: user.id } });
  revalidatePath("/espace/personnages");
}
