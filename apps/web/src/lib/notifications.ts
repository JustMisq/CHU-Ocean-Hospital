import "server-only";
import { prisma } from "@ocean/db";

export const unreadCount = (userId: string) => prisma.notification.count({ where: { userId, readAt: null } });

/** Marque comme lues les notifications d'une demande quand on l'ouvre. */
export const markRequestRead = (userId: string, requestId: string) =>
  prisma.notification.updateMany({ where: { userId, requestId, readAt: null }, data: { readAt: new Date() } });
