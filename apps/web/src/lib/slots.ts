import "server-only";
import { prisma, type Prisma } from "@ocean/db";
import { getSettings } from "./session";
import { addMinutes, dayKey } from "./time";

export type Slot = { start: Date; end: Date };

/** Seul un RDV annulé libère son créneau (un RDV terminé ou manqué l'occupe toujours). */
const OCCUPYING = { not: "CANCELLED" } as const;

/** Peut recevoir des RDV : choix de la direction pour ce membre, sinon celui de son grade. */
export function isStaffBookable(staff: { bookable: boolean | null; grade: { bookable: boolean } | null }) {
  return Boolean(staff.grade) && (staff.bookable ?? staff.grade!.bookable);
}

/** Soignants visibles et réservables publiquement (même règle que `isStaffBookable`, plus le choix du soignant). */
export const bookableStaffWhere = {
  isPublic: true,
  gradeId: { not: null },
  OR: [{ bookable: true }, { bookable: null, grade: { bookable: true } }],
} satisfies Prisma.StaffProfileWhereInput;

export type BookingRules = { windowDays: number; noticeMinutes: number; cancelNoticeHours: number };

export async function bookingRules(): Promise<BookingRules> {
  const s = await getSettings();
  const cancelNoticeHours = Number(s.cancelNoticeHours);
  return {
    windowDays: Number(s.bookingWindowDays) || 14,
    noticeMinutes: Number(s.minNoticeMinutes) || 0,
    cancelNoticeHours: Number.isFinite(cancelNoticeHours) ? cancelNoticeHours : 2,
  };
}

/** Un patient peut annuler en ligne jusqu'à `cancelNoticeHours` avant le RDV. */
export function canPatientCancel(start: Date, { cancelNoticeHours }: BookingRules) {
  return start > addMinutes(new Date(), cancelNoticeHours * 60);
}

/** Créneaux libres d'un soignant, groupés par jour (clé YYYY-MM-DD). */
export async function getFreeSlots(staffId: string) {
  const { windowDays, noticeMinutes } = await bookingRules();
  const from = addMinutes(new Date(), noticeMinutes);
  const to = addMinutes(from, windowDays * 24 * 60);

  const [availabilities, booked] = await Promise.all([
    prisma.availability.findMany({
      where: { staffId, end: { gt: from }, start: { lt: to } },
      orderBy: { start: "asc" },
    }),
    prisma.appointment.findMany({
      where: { staffId, start: { lt: to }, end: { gt: from }, status: OCCUPYING },
      select: { start: true, end: true },
    }),
  ]);

  const byDay = new Map<string, Slot[]>();
  for (const a of availabilities) {
    for (let s = a.start; addMinutes(s, a.slotMinutes) <= a.end; s = addMinutes(s, a.slotMinutes)) {
      const e = addMinutes(s, a.slotMinutes);
      if (s < from || s >= to) continue;
      if (booked.some((b) => b.start < e && b.end > s)) continue;
      const key = dayKey(s);
      byDay.set(key, [...(byDay.get(key) ?? []), { start: s, end: e }]);
    }
  }
  return byDay;
}

/**
 * Vérifie qu'un créneau précis est bien proposé et libre.
 * Dans une transaction, passer `db` = tx ET `rules` (chargées avant) : une requête
 * hors transaction pendant celle-ci ne verrait pas ses écritures.
 */
export async function findFreeSlot(
  staffId: string,
  start: Date,
  db: Prisma.TransactionClient = prisma,
  rules?: BookingRules,
): Promise<Slot | null> {
  const { windowDays, noticeMinutes } = rules ?? (await bookingRules());
  const from = addMinutes(new Date(), noticeMinutes);
  if (Number.isNaN(start.getTime()) || start < from || start > addMinutes(from, windowDays * 24 * 60)) return null;

  const availability = await db.availability.findFirst({
    where: { staffId, start: { lte: start }, end: { gt: start } },
  });
  if (!availability) return null;

  const offset = (start.getTime() - availability.start.getTime()) / 60_000;
  if (offset % availability.slotMinutes !== 0) return null;
  const end = addMinutes(start, availability.slotMinutes);
  if (end > availability.end) return null;

  const clash = await db.appointment.count({
    where: { staffId, start: { lt: end }, end: { gt: start }, status: OCCUPYING },
  });
  return clash ? null : { start, end };
}
