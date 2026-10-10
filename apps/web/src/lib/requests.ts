import "server-only";
import { prisma, type Prisma, type ServiceRequest } from "@ocean/db";
import type { CurrentUser } from "./session";
import { dayKey } from "./time";

/**
 * Demandes entre services et transferts : qui voit quoi, qui traite, qui est prévenu.
 * - le demandeur voit sa demande (et peut l'annuler tant qu'elle attend) ;
 * - les membres du service destinataire la voient et la traitent ;
 * - `requests.view_all` (ou super-admin) : toutes.
 */

type Staff = CurrentUser & { staff: { id: string } };

/** Services dont le soignant est membre ou chef. */
export async function myServiceIds(staffId: string) {
  const services = await prisma.service.findMany({
    where: { OR: [{ staff: { some: { id: staffId } } }, { headId: staffId }] },
    select: { id: true },
  });
  return services.map((s) => s.id);
}

/** Filtre des demandes visibles par ce soignant. */
export async function visibleRequestsWhere(user: Staff): Promise<Prisma.ServiceRequestWhereInput> {
  if (user.isAdmin || user.can("requests.view_all")) return {};
  const services = await myServiceIds(user.staff.id);
  return {
    OR: [
      { authorId: user.staff.id },
      { recipientId: user.staff.id },
      { assigneeId: user.staff.id },
      { toServiceId: { in: services } },
      { fromServiceId: { in: services } },
    ],
  };
}

/** Peut traiter (accepter, refuser, clôturer) : membre du service destinataire, destinataire nommé, ou `requests.view_all`. */
export async function canHandleRequest(user: Staff, request: Pick<ServiceRequest, "toServiceId" | "recipientId">) {
  if (user.isAdmin || user.can("requests.view_all")) return true;
  if (request.recipientId === user.staff.id) return true;
  return (await myServiceIds(user.staff.id)).includes(request.toServiceId);
}

export async function canViewRequest(user: Staff, request: Pick<ServiceRequest, "id">) {
  return (await prisma.serviceRequest.count({ where: { id: request.id, ...(await visibleRequestsWhere(user)) } })) > 0;
}

/** Comptes à prévenir pour un service : destinataire nommé, sinon membres et chef du service. */
export async function serviceRecipients(serviceId: string, recipientId: string | null) {
  if (recipientId) {
    const s = await prisma.staffProfile.findUnique({ where: { id: recipientId }, select: { userId: true } });
    return s ? [s.userId] : [];
  }
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: { staff: { where: { gradeId: { not: null } }, select: { userId: true } }, head: { select: { userId: true } } },
  });
  if (!service) return [];
  return [...new Set([...service.staff.map((s) => s.userId), ...(service.head ? [service.head.userId] : [])])];
}

/** Crée une notification pour chaque compte (sans doublon, sans se notifier soi-même). */
export async function notify(userIds: (string | null | undefined)[], n: { title: string; body?: string; link: string; requestId?: string }, exceptUserId?: string) {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id) && id !== exceptUserId))];
  if (!ids.length) return;
  await prisma.notification.createMany({ data: ids.map((userId) => ({ userId, title: n.title.slice(0, 160), body: (n.body ?? "").slice(0, 300), link: n.link, requestId: n.requestId })) });
}

const isUniqueViolation = (e: unknown) => Boolean(e && typeof e === "object" && "code" in e && e.code === "P2002");

/** Crée la demande avec le prochain numéro du mois (DEM-202610-0001, TRF-…). */
export async function createRequestWithNumber(prefix: string, data: Omit<Prisma.ServiceRequestUncheckedCreateInput, "number">) {
  const base = `${prefix}-${dayKey(new Date()).slice(0, 7).replace("-", "")}-`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const count = await prisma.serviceRequest.count({ where: { number: { startsWith: base } } });
    try {
      return await prisma.serviceRequest.create({ data: { ...data, number: base + String(count + 1 + attempt).padStart(4, "0") } });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
    }
  }
  throw new Error("Impossible d'attribuer un numéro de demande.");
}

/** Service où se trouve le patient : le dernier transfert pris en charge. */
export async function currentServiceOf(characterId: string) {
  const last = await prisma.serviceRequest.findFirst({
    where: { characterId, kind: "TRANSFERT", status: "ACCEPTED" },
    orderBy: { acceptedAt: "desc" },
    select: { acceptedAt: true, toService: { select: { name: true } } },
  });
  return last && { name: last.toService.name, since: last.acceptedAt };
}

/** Nombre de demandes en attente pour ce soignant (badge du menu). */
export async function pendingRequestCount(user: Staff) {
  const services = await myServiceIds(user.staff.id);
  return prisma.serviceRequest.count({
    where: { status: { in: ["PENDING", "ACCEPTED"] }, OR: [{ toServiceId: { in: services }, recipientId: null }, { recipientId: user.staff.id }] },
  });
}
