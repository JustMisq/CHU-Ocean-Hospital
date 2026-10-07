import type { PrismaClient } from "../generated/prisma/client";
import { parseRoleIds } from "./permissions";

export type DiscordMemberInput = {
  discordId: string;
  username: string;
  avatarUrl: string | null;
  /** Rôles Discord du membre, ou null s'il n'est pas sur le serveur / serveur non configuré. */
  roles: string[] | null;
};

type Linkable = { id: string; discordRoleIds: string };

const isLinked = (item: Linkable) => parseRoleIds(item.discordRoleIds).length > 0;
const matches = (item: Linkable, roles: string[]) => parseRoleIds(item.discordRoleIds).some((id) => roles.includes(id));

/**
 * Éléments liés à Discord → recalculés depuis les rôles.
 * Éléments sans ID Discord → conservés tels qu'attribués à la main.
 */
function mergeLinked<T extends Linkable>(all: T[], current: T[], roles: string[]) {
  const manual = current.filter((c) => !isLinked(c));
  const fromDiscord = all.filter((a) => isLinked(a) && matches(a, roles));
  return [...manual, ...fromDiscord].map((x) => ({ id: x.id }));
}

/**
 * Synchronise un membre Discord avec le site (utilisé à la connexion, et plus tard par le bot).
 * Le grade le plus élevé parmi les grades liés gagne. Sans grade, le membre est simple patient.
 */
export async function syncDiscordMember(db: PrismaClient, input: DiscordMemberInput) {
  const identity = { username: input.username, avatarUrl: input.avatarUrl };

  // Rôles inconnus (API Discord en erreur, serveur non configuré…) : on ne touche ni aux
  // grades ni aux services, sinon une simple panne Discord retirerait son accès au personnel.
  if (input.roles === null) {
    return db.user.upsert({
      where: { discordId: input.discordId },
      update: identity,
      create: { discordId: input.discordId, ...identity },
    });
  }

  const roles = input.roles;
  const synced = { ...identity, discordRoles: roles.join(","), lastSyncAt: new Date() };
  const user = await db.user.upsert({
    where: { discordId: input.discordId },
    update: synced,
    create: { discordId: input.discordId, ...synced },
  });

  const [grades, services, specialties, staff] = await Promise.all([
    db.grade.findMany({ orderBy: { order: "desc" } }),
    db.service.findMany(),
    db.specialty.findMany(),
    db.staffProfile.findUnique({ where: { userId: user.id }, include: { grade: true, services: true, specialties: true } }),
  ]);

  const discordGrade = grades.find((g) => isLinked(g) && matches(g, roles));
  let gradeId: string | null;
  if (discordGrade) gradeId = discordGrade.id;
  else if (staff?.grade && !isLinked(staff.grade)) gradeId = staff.grade.id; // grade manuel conservé
  else gradeId = null;

  const serviceIds = mergeLinked(services, staff?.services ?? [], roles);
  const specialtyIds = mergeLinked(specialties, staff?.specialties ?? [], roles);

  if (!staff) {
    if (!gradeId) return user;
    await db.staffProfile.create({
      data: {
        userId: user.id,
        displayName: input.username,
        gradeId,
        services: { connect: serviceIds },
        specialties: { connect: specialtyIds },
      },
    });
  } else {
    await db.staffProfile.update({
      where: { id: staff.id },
      data: { gradeId, services: { set: serviceIds }, specialties: { set: specialtyIds } },
    });
  }
  return user;
}
