"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseRoleIds, prisma, queueBotEvent } from "@ocean/db";
import type { FormState } from "@/components/forms";
import { requireStaff, type CurrentUser } from "@/lib/session";
import { parseLocal, shiftDate } from "@/lib/time";

const availabilitySchema = z
  .object({
    date: z.iso.date("Date invalide."),
    from: z.string().regex(/^\d{2}:\d{2}$/, "Heure de début invalide."),
    to: z.string().regex(/^\d{2}:\d{2}$/, "Heure de fin invalide."),
    slotMinutes: z.coerce.number().int().min(10).max(180),
    repeatDays: z.coerce.number().int().min(1).max(14).default(1),
  })
  .refine((v) => v.to > v.from, { message: "L'heure de fin doit être après l'heure de début." });

export async function addAvailability(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireStaff();
  if (!user.staff.grade?.bookable && !user.isAdmin) return { error: "Votre grade ne permet pas de recevoir des rendez-vous." };
  const parsed = availabilitySchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { date, from, to, slotMinutes, repeatDays } = parsed.data;

  if (parseLocal(date, to) < new Date()) return { error: "Cette plage est déjà passée." };

  // Chaque jour est recalculé en heure locale (sûr lors des changements d'heure).
  const blocks = Array.from({ length: repeatDays }, (_, i) => {
    const day = shiftDate(date, i);
    return { staffId: user.staff.id, start: parseLocal(day, from), end: parseLocal(day, to), slotMinutes };
  });

  for (const b of blocks) {
    const overlap = await prisma.availability.count({ where: { staffId: user.staff.id, start: { lt: b.end }, end: { gt: b.start } } });
    if (overlap) return { error: "Une de ces plages chevauche une disponibilité existante." };
  }
  await prisma.availability.createMany({ data: blocks });
  revalidatePath("/pro/disponibilites");
  return { ok: repeatDays > 1 ? `${repeatDays} plages ajoutées.` : "Plage ajoutée." };
}

export async function deleteAvailability(data: FormData) {
  const { staff } = await requireStaff();
  // Les RDV déjà pris dans la plage sont conservés.
  await prisma.availability.deleteMany({ where: { id: String(data.get("id")), staffId: staff.id } });
  revalidatePath("/pro/disponibilites");
}

/** Le soignant assigné, ou un membre ayant `appointments.manage_all`. */
async function loadManageableAppointment(id: string) {
  const user = await requireStaff();
  const appointment = await prisma.appointment.findUnique({ where: { id } });
  if (!appointment) return null;
  if (appointment.staffId !== user.staff.id && !user.can("appointments.manage_all")) return null;
  return appointment;
}

const reportSchema = z.object({ id: z.string(), report: z.string().trim().min(3, "Rédigez un compte rendu.").max(4000) });

export async function completeAppointment(_: FormState, data: FormData): Promise<FormState> {
  const parsed = reportSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const appointment = await loadManageableAppointment(parsed.data.id);
  if (!appointment) return { error: "Rendez-vous introuvable ou non autorisé." };

  await prisma.appointment.update({ where: { id: appointment.id }, data: { status: "COMPLETED", report: parsed.data.report } });
  await queueBotEvent("appointment.completed", { appointmentId: appointment.id });
  revalidatePath(`/pro/rdv/${appointment.id}`);
  revalidatePath("/pro");
  return { ok: "Compte rendu enregistré." };
}

export async function markNoShow(data: FormData) {
  const appointment = await loadManageableAppointment(String(data.get("id")));
  if (!appointment) return;
  await prisma.appointment.update({ where: { id: appointment.id }, data: { status: "NO_SHOW" } });
  revalidatePath(`/pro/rdv/${appointment.id}`);
  revalidatePath("/pro");
}

export async function cancelAppointmentAsStaff(_: FormState, data: FormData): Promise<FormState> {
  const appointment = await loadManageableAppointment(String(data.get("id")));
  if (!appointment) return { error: "Rendez-vous introuvable ou non autorisé." };
  const reason = String(data.get("reason") ?? "").trim() || "Annulé par le soignant";

  await prisma.appointment.update({ where: { id: appointment.id }, data: { status: "CANCELLED", cancelReason: reason } });
  await queueBotEvent("appointment.cancelled", { appointmentId: appointment.id, by: "staff", reason });
  revalidatePath(`/pro/rdv/${appointment.id}`);
  revalidatePath("/pro");
  return { ok: "Rendez-vous annulé, le patient sera prévenu." };
}

const profileSchema = z.object({
  displayName: z.string().trim().min(2, "Nom trop court.").max(60),
  bio: z.string().trim().max(1000).optional(),
  isPublic: z.literal("on").optional(),
});

export async function updateOwnProfile(_: FormState, data: FormData): Promise<FormState> {
  const { staff } = await requireStaff();
  const parsed = profileSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { displayName, bio, isPublic } = parsed.data;

  await prisma.staffProfile.update({
    where: { id: staff.id },
    data: { displayName, bio: bio || null, isPublic: isPublic === "on" },
  });
  revalidatePath("/pro/profil");
  return { ok: "Profil mis à jour." };
}

// ─── Gestion du personnel (permission staff.manage) ──────────────────────────

/** Rang maximum attribuable : strictement inférieur au sien (sauf super-admin). */
function canAssignGrade(user: CurrentUser, gradeOrder: number) {
  return user.isAdmin || gradeOrder < (user.staff?.grade?.order ?? -Infinity);
}

const staffSchema = z.object({
  id: z.string(),
  gradeId: z.string().optional(),
});

export async function updateStaffMember(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireStaff("staff.manage");
  const parsed = staffSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: "Formulaire invalide." };

  const member = await prisma.staffProfile.findUnique({ where: { id: parsed.data.id }, include: { grade: true } });
  if (!member) return { error: "Membre introuvable." };
  if (member.grade && !canAssignGrade(user, member.grade.order)) {
    return { error: "Vous ne pouvez pas modifier un membre de grade égal ou supérieur au vôtre." };
  }

  const grade = parsed.data.gradeId ? await prisma.grade.findUnique({ where: { id: parsed.data.gradeId } }) : null;
  if (grade && !canAssignGrade(user, grade.order)) return { error: "Vous ne pouvez pas attribuer ce grade." };

  // Seuls les services / spécialités sans lien Discord sont attribués à la main.
  const [services, specialties] = await Promise.all([prisma.service.findMany(), prisma.specialty.findMany()]);
  const manual = <T extends { id: string; discordRoleIds: string }>(all: T[], field: string) =>
    all.filter((x) => parseRoleIds(x.discordRoleIds).length === 0 && data.getAll(field).includes(x.id)).map((x) => ({ id: x.id }));
  const linked = <T extends { id: string; discordRoleIds: string }>(all: T[], current: { id: string }[]) =>
    current.filter((c) => all.some((a) => a.id === c.id && parseRoleIds(a.discordRoleIds).length > 0));

  const current = await prisma.staffProfile.findUniqueOrThrow({ where: { id: member.id }, select: { services: true, specialties: true } });
  await prisma.staffProfile.update({
    where: { id: member.id },
    data: {
      gradeId: grade?.id ?? null,
      services: { set: [...linked(services, current.services).map((s) => ({ id: s.id })), ...manual(services, "services")] },
      specialties: { set: [...linked(specialties, current.specialties).map((s) => ({ id: s.id })), ...manual(specialties, "specialties")] },
    },
  });
  revalidatePath("/pro/personnel");
  return { ok: "Enregistré." };
}

export async function addStaffMember(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireStaff("staff.manage");
  const discordId = String(data.get("discordId") ?? "").trim();
  const gradeId = String(data.get("gradeId") ?? "");

  const target = await prisma.user.findUnique({ where: { discordId } });
  if (!target) return { error: "Aucun compte avec cet ID Discord. La personne doit s'être connectée au moins une fois au site." };
  const grade = await prisma.grade.findUnique({ where: { id: gradeId } });
  if (!grade) return { error: "Choisissez un grade." };
  if (!canAssignGrade(user, grade.order)) return { error: "Vous ne pouvez pas attribuer ce grade." };

  await prisma.staffProfile.upsert({
    where: { userId: target.id },
    update: { gradeId: grade.id },
    create: { userId: target.id, displayName: target.username, gradeId: grade.id },
  });
  revalidatePath("/pro/personnel");
  return { ok: `${target.username} ajouté(e) au personnel.` };
}
