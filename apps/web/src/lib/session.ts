import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { ALL_PERMISSIONS, loadSettings, parsePermissions, prisma, type Permission } from "@ocean/db";
import { auth } from "@/auth";

export const getSettings = cache(() => loadSettings(prisma));

/** Utilisateur connecté, relu en base à chaque requête (grade et permissions à jour). */
export const getCurrentUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    omit: { passwordHash: true },
    include: { staff: { include: { grade: true } } },
  });
  if (!user) return null;

  /** Super-admin : créé avec `npm run admin`. */
  const isAdmin = user.isSuperAdmin;
  const grade = user.staff?.grade ?? null;
  const permissions: Permission[] = isAdmin ? ALL_PERMISSIONS : grade ? parsePermissions(grade.permissions) : [];
  /** Accès à l'espace pro : avoir un grade (ou être super-admin). */
  const isStaff = Boolean(user.staff && (grade || isAdmin));

  return { ...user, isAdmin, isStaff, permissions, can: (p: Permission) => permissions.includes(p) };
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** Membre de même grade (soi compris) : modifiable avec `staff.manage_peers`, mais pas son grade. */
export function isPeer(user: CurrentUser, member: { grade: { order: number } | null }) {
  return !user.isAdmin && user.can("staff.manage_peers") && member.grade !== null && member.grade.order === user.staff?.grade?.order;
}

export async function requireUser(callbackUrl = "/espace") {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  // Mot de passe temporaire donné par la direction : à changer avant toute autre chose.
  if (user.mustChangePassword) redirect("/compte/mot-de-passe");
  return user;
}

/** Membre du personnel, avec éventuellement une permission requise. Crée la fiche d'un super-admin si besoin. */
export async function requireStaff(permission?: Permission) {
  const user = await requireUser("/pro");
  if (!user.isStaff) {
    if (!user.isAdmin) redirect("/espace");
    // Le layout et la page de /pro passent ici en parallèle : un upsert créerait la fiche deux fois.
    // skipDuplicates = INSERT … ON CONFLICT DO NOTHING, atomique côté base.
    await prisma.staffProfile.createMany({
      data: [{ userId: user.id, displayName: user.username, isPublic: false }],
      skipDuplicates: true,
    });
    redirect("/pro");
  }
  if (permission && !user.can(permission)) redirect("/pro");
  return { ...user, staff: user.staff! };
}
