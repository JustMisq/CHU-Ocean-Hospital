"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { LOGIN_PATTERN, generateTempPassword, hashPassword, logAction, normalizeLogin, prisma } from "@ocean/db";
import type { FormState } from "@/components/forms";
import { canAccessPatient, identitySchema, medicalInfoSchema, observationSchema } from "@/lib/characters";
import { deleteStoredImage, saveDataUrlImage } from "@/lib/images";
import { isPeer, requireStaff, type CurrentUser } from "@/lib/session";
import { isStaffBookable } from "@/lib/slots";
import { formatDateTime, parseLocal, shiftDate } from "@/lib/time";

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
  if (!isStaffBookable(user.staff) && !user.isAdmin) return { error: "Vous n'êtes pas autorisé(e) à recevoir des rendez-vous." };
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

/** RDV encore ouvert, du soignant assigné ou d'un membre ayant `appointments.manage_all`. */
async function loadManageableAppointment(id: string) {
  const user = await requireStaff();
  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: { character: { select: { firstName: true, lastName: true } }, staff: { select: { displayName: true } } },
  });
  if (!appointment || !["PENDING", "CONFIRMED"].includes(appointment.status)) return null;
  if (appointment.staffId !== user.staff.id && !user.can("appointments.manage_all")) return null;
  const isOthers = appointment.staffId !== user.staff.id;
  const label = `${appointment.character.firstName} ${appointment.character.lastName} (RDV de ${appointment.staff.displayName}, ${formatDateTime(appointment.start)})`;
  return { appointment, user, isOthers, label };
}

const reportSchema = z.object({ id: z.string(), report: z.string().trim().min(3, "Rédigez un compte rendu.").max(4000) });

export async function completeAppointment(_: FormState, data: FormData): Promise<FormState> {
  const parsed = reportSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const loaded = await loadManageableAppointment(parsed.data.id);
  if (!loaded) return { error: "Rendez-vous introuvable, déjà clôturé ou non autorisé." };
  const { appointment, user, isOthers, label } = loaded;
  if (appointment.start > new Date()) return { error: "La consultation n'a pas encore commencé." };

  await prisma.appointment.update({ where: { id: appointment.id }, data: { status: "COMPLETED", report: parsed.data.report } });
  if (isOthers) await logAction(user.id, "appointment.complete", `Clôture : ${label}`);
  revalidatePath(`/pro/rdv/${appointment.id}`);
  revalidatePath("/pro");
  return { ok: "Compte rendu enregistré." };
}

export async function markNoShow(data: FormData) {
  const loaded = await loadManageableAppointment(String(data.get("id")));
  if (!loaded || loaded.appointment.start > new Date()) return;
  const { appointment, user, isOthers, label } = loaded;
  await prisma.appointment.update({ where: { id: appointment.id }, data: { status: "NO_SHOW" } });
  if (isOthers) await logAction(user.id, "appointment.no_show", `Absence : ${label}`);
  revalidatePath(`/pro/rdv/${appointment.id}`);
  revalidatePath("/pro");
}

export async function cancelAppointmentAsStaff(_: FormState, data: FormData): Promise<FormState> {
  const loaded = await loadManageableAppointment(String(data.get("id")));
  if (!loaded) return { error: "Rendez-vous introuvable, déjà clôturé ou non autorisé." };
  const { appointment, user, label } = loaded;
  const reason = String(data.get("reason") ?? "").trim().slice(0, 300) || "Annulé par le soignant";

  await prisma.appointment.update({ where: { id: appointment.id }, data: { status: "CANCELLED", cancelReason: reason } });
  await logAction(user.id, "appointment.cancel", `Annulation : ${label} — « ${reason} »`);
  revalidatePath(`/pro/rdv/${appointment.id}`);
  revalidatePath("/pro");
  return { ok: "Rendez-vous annulé : le patient verra le motif dans son espace." };
}

const moveSchema = z.object({
  id: z.string(),
  date: z.iso.date("Date invalide."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Heure invalide."),
});

/** Déplace un RDV à une date libre choisie par le soignant (même durée), hors de ses disponibilités si besoin. */
export async function moveAppointmentAsStaff(_: FormState, data: FormData): Promise<FormState> {
  const parsed = moveSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const loaded = await loadManageableAppointment(parsed.data.id);
  if (!loaded) return { error: "Rendez-vous introuvable, déjà clôturé ou non autorisé." };
  const { appointment, user, label } = loaded;

  const start = parseLocal(parsed.data.date, parsed.data.time);
  if (start <= new Date()) return { error: "Choisissez une date à venir." };
  if (start.getTime() === appointment.start.getTime()) return { error: "C'est déjà l'horaire du rendez-vous." };
  const end = new Date(start.getTime() + (appointment.end.getTime() - appointment.start.getTime()));

  const clash = await prisma.appointment.count({
    where: { staffId: appointment.staffId, id: { not: appointment.id }, status: { not: "CANCELLED" }, start: { lt: end }, end: { gt: start } },
  });
  if (clash) return { error: "Ce soignant a déjà un rendez-vous sur cet horaire." };

  await prisma.appointment.update({ where: { id: appointment.id }, data: { start, end } });
  await logAction(user.id, "appointment.move", `Déplacement : ${label} → ${formatDateTime(start)}`);
  revalidatePath(`/pro/rdv/${appointment.id}`);
  revalidatePath("/pro");
  return { ok: `Rendez-vous déplacé au ${formatDateTime(start)}. Le patient voit le nouvel horaire dans son espace.` };
}

/** Un soignant complète le dossier d'un patient (infos médicales, pas l'identité). */
export async function updatePatientInfo(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireStaff();
  const id = String(data.get("id") ?? "");
  const parsed = medicalInfoSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!(await canAccessPatient(user, id))) return { error: "Accès au dossier non autorisé." };

  const before = await prisma.character.findUniqueOrThrow({ where: { id } });
  // Dossier sans compte : le soignant peut aussi corriger l'identité (personne d'autre ne le peut).
  let identity = {};
  if (!before.userId) {
    const parsedIdentity = identitySchema.extend(observationSchema.shape).safeParse(Object.fromEntries(data));
    if (!parsedIdentity.success) return { error: parsedIdentity.error.issues[0].message };
    identity = parsedIdentity.data;
  }
  const after = await prisma.character.update({ where: { id }, data: { ...parsed.data, ...identity } });
  const labels = {
    firstName: "prénom",
    lastName: "nom",
    apparentAge: "âge apparent",
    description: "signes distinctifs",
    birthDate: "date de naissance",
    sex: "sexe",
    phone: "téléphone",
    bloodType: "groupe sanguin",
    allergies: "allergies",
  } as const;
  const changed = (Object.keys(labels) as (keyof typeof labels)[]).filter((k) => String(before[k] ?? "") !== String(after[k] ?? ""));
  if (changed.length) {
    await logAction(user.id, "patient.update", `Dossier de ${after.firstName} ${after.lastName} complété : ${changed.map((k) => labels[k]).join(", ")}`);
  }
  revalidatePath(`/pro/patients/${id}`);
  revalidatePath("/pro/rdv", "layout");
  return { ok: "Dossier mis à jour." };
}

/** Champ image du profil : "" = inchangée, "remove" = retirée, sinon data URL de la nouvelle image. */
const imageField = z.string().max(1_000_000, "Image trop lourde.").default("");

const profileSchema = z.object({
  displayName: z.string().trim().min(2, "Nom trop court.").max(60),
  bio: z.string().trim().max(1000).optional(),
  jobTitle: z.string().trim().max(80).optional(),
  photo: imageField,
  banner: imageField,
  signature: imageField.refine((v) => !v || v === "remove" || v.startsWith("data:image/png;"), "Signature invalide."),
  isPublic: z.literal("on").optional(),
});

/** Applique un champ image : renvoie la nouvelle URL (undefined = inchangée) et supprime l'ancienne image. */
async function applyImage(value: string, current: string | null): Promise<{ url?: string | null } | { error: string }> {
  if (!value) return {};
  if (value === "remove") {
    await deleteStoredImage(current);
    return { url: null };
  }
  const saved = await saveDataUrlImage(value);
  if ("error" in saved) return saved;
  await deleteStoredImage(current);
  return saved;
}

export async function updateOwnProfile(_: FormState, data: FormData): Promise<FormState> {
  const { staff, id: userId } = await requireStaff();
  const parsed = profileSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { displayName, bio, jobTitle, photo, banner, signature, isPublic } = parsed.data;

  const photoResult = await applyImage(photo, staff.photoUrl);
  if ("error" in photoResult) return photoResult;
  const bannerResult = await applyImage(banner, staff.bannerUrl);
  if ("error" in bannerResult) return bannerResult;
  // Les ordonnances déjà émises gardent leur propre copie de la signature (voir buildSnapshot).
  const signatureResult = await applyImage(signature, staff.signatureUrl);
  if ("error" in signatureResult) return signatureResult;

  // Un seul nom pour un soignant : celui de sa fiche est aussi celui de son compte (en-tête, journal…).
  await prisma.$transaction([
    prisma.staffProfile.update({
      where: { id: staff.id },
      data: {
        displayName,
        bio: bio || null,
        jobTitle: jobTitle || null,
        photoUrl: photoResult.url,
        bannerUrl: bannerResult.url,
        signatureUrl: signatureResult.url,
        isPublic: isPublic === "on",
      },
    }),
    prisma.user.update({ where: { id: userId }, data: { username: displayName } }),
  ]);
  revalidatePath("/", "layout");
  return { ok: "Profil mis à jour." };
}

// ─── Gestion du personnel (permission staff.manage) ──────────────────────────

/** Rang maximum attribuable : strictement inférieur au sien (sauf super-admin). */
function canAssignGrade(user: CurrentUser, gradeOrder: number) {
  return user.isAdmin || gradeOrder < (user.staff?.grade?.order ?? -Infinity);
}

const BOOKABLE_CHOICES = { grade: null, yes: true, no: false } as const;

const staffSchema = z.object({
  id: z.string(),
  gradeId: z.string().optional(),
  bookable: z.enum(["grade", "yes", "no"]).default("grade").transform((v) => BOOKABLE_CHOICES[v]),
});

const bookableLabel = (v: boolean | null) => (v === null ? "selon le grade" : v ? "affiché" : "masqué");

export async function updateStaffMember(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireStaff("staff.manage");
  const parsed = staffSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: "Formulaire invalide." };

  const member = await prisma.staffProfile.findUnique({ where: { id: parsed.data.id }, include: { grade: true } });
  if (!member) return { error: "Membre introuvable." };
  const peer = isPeer(user, member);
  if (member.grade && !canAssignGrade(user, member.grade.order) && !peer) {
    return { error: "Vous ne pouvez pas modifier un membre de grade égal ou supérieur au vôtre." };
  }

  const grade = parsed.data.gradeId ? await prisma.grade.findUnique({ where: { id: parsed.data.gradeId } }) : null;
  if (peer) {
    if (grade?.id !== member.gradeId) return { error: "Le grade d'un membre de même grade que vous ne peut pas être modifié ici." };
  } else if (grade && !canAssignGrade(user, grade.order)) {
    return { error: "Vous ne pouvez pas attribuer ce grade." };
  }

  const [services, specialties] = await Promise.all([prisma.service.findMany(), prisma.specialty.findMany()]);
  const checked = (all: { id: string }[], field: string) =>
    all.filter((x) => data.getAll(field).includes(x.id)).map((x) => ({ id: x.id }));

  const current = await prisma.staffProfile.findUniqueOrThrow({ where: { id: member.id }, select: { services: true, specialties: true } });
  const updated = await prisma.staffProfile.update({
    where: { id: member.id },
    data: {
      gradeId: grade?.id ?? null,
      bookable: parsed.data.bookable,
      services: { set: checked(services, "services") },
      specialties: { set: checked(specialties, "specialties") },
    },
    select: { services: { select: { name: true } }, specialties: { select: { name: true } } },
  });

  const names = (xs: { name: string }[]) => xs.map((x) => x.name).sort().join(", ") || "aucun";
  const changes = [
    member.gradeId !== (grade?.id ?? null) && `grade ${member.grade?.name ?? "aucun"} → ${grade?.name ?? "retiré du personnel"}`,
    member.bookable !== parsed.data.bookable && `annuaire & RDV : ${bookableLabel(parsed.data.bookable)}`,
    names(current.services) !== names(updated.services) && `services : ${names(updated.services)}`,
    names(current.specialties) !== names(updated.specialties) && `spécialités : ${names(updated.specialties)}`,
  ].filter(Boolean);
  if (changes.length) await logAction(user.id, "staff.update", `${member.displayName} — ${changes.join(" ; ")}`);
  revalidatePath("/pro/personnel");
  return { ok: "Enregistré." };
}

/** Compte par identifiant de connexion. */
function findAccount(identifier: string) {
  const login = normalizeLogin(identifier);
  if (!login) return null;
  return prisma.user.findUnique({ where: { login }, include: { staff: { include: { grade: true } } } });
}

/** On ne gère que les comptes de grade strictement inférieur au sien (les patients sont toujours gérables). */
function canManageAccount(user: CurrentUser, target: { isSuperAdmin: boolean; staff: { grade: { order: number } | null } | null }) {
  if (user.isAdmin) return true;
  if (target.isSuperAdmin) return false;
  return !target.staff?.grade || canAssignGrade(user, target.staff.grade.order);
}

/** Passe un compte existant (ex : un citoyen inscrit) dans le personnel. */
export async function addStaffMember(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireStaff("staff.manage");
  const identifier = String(data.get("identifier") ?? "");
  const gradeId = String(data.get("gradeId") ?? "");

  const target = await findAccount(identifier);
  if (!target) return { error: "Aucun compte avec cet identifiant." };
  if (!canManageAccount(user, target)) return { error: "Ce compte a un grade égal ou supérieur au vôtre." };
  const grade = await prisma.grade.findUnique({ where: { id: gradeId } });
  if (!grade) return { error: "Choisissez un grade." };
  if (!canAssignGrade(user, grade.order)) return { error: "Vous ne pouvez pas attribuer ce grade." };

  await prisma.staffProfile.upsert({
    where: { userId: target.id },
    update: { gradeId: grade.id },
    create: { userId: target.id, displayName: target.username, gradeId: grade.id },
  });
  await logAction(user.id, "staff.add", `${target.username} ajouté(e) au personnel — ${grade.name}`);
  revalidatePath("/pro/personnel");
  return { ok: `${target.username} ajouté(e) au personnel.` };
}

const newStaffSchema = z.object({
  login: z
    .string()
    .transform(normalizeLogin)
    .refine((v) => LOGIN_PATTERN.test(v), "Identifiant : 3 à 32 caractères (lettres, chiffres, . _ -)."),
  displayName: z.string().trim().min(2, "Nom affiché trop court.").max(60),
  gradeId: z.string().min(1, "Choisissez un grade."),
});

/** Crée directement le compte d'un soignant, avec un mot de passe temporaire à lui transmettre en jeu. */
export async function createStaffAccount(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireStaff("staff.manage");
  const parsed = newStaffSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { login, displayName, gradeId } = parsed.data;

  const grade = await prisma.grade.findUnique({ where: { id: gradeId } });
  if (!grade) return { error: "Choisissez un grade." };
  if (!canAssignGrade(user, grade.order)) return { error: "Vous ne pouvez pas attribuer ce grade." };
  if (await prisma.user.findUnique({ where: { login }, select: { id: true } })) {
    return { error: "Cet identifiant existe déjà. Pour un citoyen déjà inscrit, utilisez « Promouvoir un compte existant »." };
  }

  const tempPassword = generateTempPassword();
  await prisma.user.create({
    data: {
      login,
      username: displayName,
      passwordHash: await hashPassword(tempPassword),
      mustChangePassword: true,
      staff: { create: { displayName, gradeId: grade.id } },
    },
  });
  await logAction(user.id, "staff.create", `Compte créé : ${displayName} (${login}) — ${grade.name}`);
  revalidatePath("/pro/personnel");
  return { ok: `Compte créé. Identifiant : ${login} · Mot de passe temporaire : ${tempPassword} — à transmettre en jeu, il ne sera plus affiché.` };
}

/** Nouveau mot de passe temporaire (mot de passe oublié). */
export async function resetAccountPassword(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireStaff("staff.manage");
  const target = await findAccount(String(data.get("identifier") ?? ""));
  if (!target?.login) return { error: "Aucun compte avec cet identifiant." };
  if (target.id === user.id) return { error: "Pour votre propre compte, utilisez la page « Mot de passe »." };
  if (!canManageAccount(user, target)) return { error: "Ce compte a un grade égal ou supérieur au vôtre." };

  const tempPassword = generateTempPassword();
  await prisma.user.update({
    where: { id: target.id },
    data: { passwordHash: await hashPassword(tempPassword), mustChangePassword: true, failedLogins: 0, lockedUntil: null },
  });
  await logAction(user.id, "staff.password_reset", `Mot de passe réinitialisé : ${target.username} (${target.login})`);
  return { ok: `Mot de passe temporaire de ${target.username} : ${tempPassword} — à transmettre en jeu, il ne sera plus affiché.` };
}
