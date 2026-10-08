"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ALL_PERMISSIONS, logAction, prisma, saveSettings, type Permission } from "@ocean/db";
import type { FormState } from "@/components/forms";
import { requireStaff } from "@/lib/session";

const requireConfig = () => requireStaff("settings.manage");

const checkbox = z.literal("on").optional().transform((v) => v === "on");

function slugify(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function uniqueSlug(model: "service" | "specialty", name: string, excludeId?: string) {
  const base = slugify(name) || "element";
  for (let i = 0; ; i++) {
    const slug = i ? `${base}-${i + 1}` : base;
    const where = { slug, ...(excludeId && { id: { not: excludeId } }) };
    const taken = model === "service" ? await prisma.service.count({ where }) : await prisma.specialty.count({ where });
    if (!taken) return slug;
  }
}

function revalidateAll() {
  revalidatePath("/", "layout");
}

// ─── Réglages généraux ───────────────────────────────────────────────────────

const generalSchema = z.object({
  hospitalName: z.string().trim().min(2, "Nom requis.").max(60),
  tagline: z.string().trim().min(2).max(120),
  emergencyNote: z.string().trim().max(160).default(""),
  allowSignup: checkbox,
  bookingWindowDays: z.coerce.number().int().min(1, "Fenêtre de réservation : 1 à 60 jours.").max(60),
  minNoticeMinutes: z.coerce.number().int().min(0).max(24 * 60),
  cancelNoticeHours: z.coerce.number().int().min(0, "Délai d'annulation : 0 à 72 heures.").max(72, "Délai d'annulation : 0 à 72 heures."),
  maxUpcomingPerCharacter: z.coerce.number().int().min(1).max(20),
  maxCharactersPerUser: z.coerce.number().int().min(1).max(20),
});

export async function saveGeneralSettings(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireConfig();
  const parsed = generalSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  await saveSettings(prisma, {
    ...v,
    allowSignup: String(v.allowSignup),
    bookingWindowDays: String(v.bookingWindowDays),
    minNoticeMinutes: String(v.minNoticeMinutes),
    cancelNoticeHours: String(v.cancelNoticeHours),
    maxUpcomingPerCharacter: String(v.maxUpcomingPerCharacter),
    maxCharactersPerUser: String(v.maxCharactersPerUser),
  });
  await logAction(user.id, "settings.update", "Réglages généraux modifiés");
  revalidateAll();
  return { ok: "Réglages enregistrés." };
}

// ─── Services ────────────────────────────────────────────────────────────────

const serviceSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Nom requis.").max(60),
  description: z.string().trim().max(300).default(""),
  icon: z.string().default("stethoscope"),
  order: z.coerce.number().int().default(0),
  isPublic: checkbox,
});

export async function saveService(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireConfig();
  const parsed = serviceSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, ...v } = parsed.data;

  const slug = await uniqueSlug("service", v.name, id);
  if (id) await prisma.service.update({ where: { id }, data: { ...v, slug } });
  else await prisma.service.create({ data: { ...v, slug } });
  await logAction(user.id, id ? "service.update" : "service.create", `Service ${id ? "modifié" : "créé"} : ${v.name}`);
  revalidateAll();
  return { ok: id ? "Service mis à jour." : "Service créé." };
}

export async function deleteService(data: FormData) {
  const user = await requireConfig();
  const service = await prisma.service.delete({ where: { id: String(data.get("id")) } });
  await logAction(user.id, "service.delete", `Service supprimé : ${service.name}`);
  revalidateAll();
}

// ─── Spécialités ─────────────────────────────────────────────────────────────

const specialtySchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Nom requis.").max(60),
  description: z.string().trim().max(300).default(""),
  order: z.coerce.number().int().default(0),
});

export async function saveSpecialty(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireConfig();
  const parsed = specialtySchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, ...v } = parsed.data;

  const slug = await uniqueSlug("specialty", v.name, id);
  if (id) await prisma.specialty.update({ where: { id }, data: { ...v, slug } });
  else await prisma.specialty.create({ data: { ...v, slug } });
  await logAction(user.id, id ? "specialty.update" : "specialty.create", `Spécialité ${id ? "modifiée" : "créée"} : ${v.name}`);
  revalidateAll();
  return { ok: id ? "Spécialité mise à jour." : "Spécialité créée." };
}

export async function deleteSpecialty(data: FormData) {
  const user = await requireConfig();
  const specialty = await prisma.specialty.delete({ where: { id: String(data.get("id")) } });
  await logAction(user.id, "specialty.delete", `Spécialité supprimée : ${specialty.name}`);
  revalidateAll();
}

// ─── Grades ──────────────────────────────────────────────────────────────────

const gradeSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Nom requis.").max(40),
  order: z.coerce.number().int().min(0).max(1000),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide.").default("#0a6f98"),
  bookable: checkbox,
});

export async function saveGrade(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireConfig();
  const parsed = gradeSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, ...v } = parsed.data;
  const permissions = data.getAll("permissions").filter((p): p is Permission => ALL_PERMISSIONS.includes(p as Permission));

  // Garde-fou : on ne peut pas retirer à son propre grade la permission de configuration.
  if (id && id === user.staff.gradeId && !user.isAdmin && !permissions.includes("settings.manage")) {
    return { error: "Vous ne pouvez pas retirer la permission « Configurer le site » de votre propre grade." };
  }

  const payload = { ...v, permissions: permissions.join(",") };
  if (id) await prisma.grade.update({ where: { id }, data: payload });
  else await prisma.grade.create({ data: payload });
  await logAction(user.id, id ? "grade.update" : "grade.create", `Grade ${id ? "modifié" : "créé"} : ${v.name} (${permissions.join(", ") || "aucune permission"})`);
  revalidateAll();
  return { ok: id ? "Grade mis à jour." : "Grade créé." };
}

export async function deleteGrade(data: FormData) {
  const user = await requireConfig();
  const id = String(data.get("id"));
  if (id === user.staff.gradeId && !user.isAdmin) return;
  // Les membres de ce grade perdent leur accès pro (grade = null).
  const grade = await prisma.grade.delete({ where: { id } });
  await logAction(user.id, "grade.delete", `Grade supprimé : ${grade.name}`);
  revalidateAll();
}
