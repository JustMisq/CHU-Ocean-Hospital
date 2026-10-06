import { TZDate } from "@date-fns/tz";

/** Fuseau du serveur RP. Le serveur Vercel tourne en UTC : on formate toujours explicitement. */
export const TZ = process.env.NEXT_PUBLIC_TZ ?? "Europe/Paris";

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, ...opts });

const timeFmt = fmt({ hour: "2-digit", minute: "2-digit" });
const dayFmt = fmt({ weekday: "long", day: "numeric", month: "long" });
const shortDayFmt = fmt({ weekday: "short", day: "numeric", month: "short" });
const dateFmt = fmt({ day: "2-digit", month: "2-digit", year: "numeric" });
const keyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

export const formatTime = (d: Date) => timeFmt.format(d);
const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Mardi 6 octobre" */
export const formatDay = (d: Date) => upperFirst(dayFmt.format(d));
export const formatShortDay = (d: Date) => shortDayFmt.format(d);
export const formatDate = (d: Date) => dateFmt.format(d);
export const formatDateTime = (d: Date) => `${formatDay(d)} à ${formatTime(d)}`;

/** Clé de jour "YYYY-MM-DD" dans le fuseau du serveur. */
export const dayKey = (d: Date) => keyFmt.format(d);

/** "2026-10-06" + "20:30" (heure de Paris) → instant réel. */
export function parseLocal(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return new Date(new TZDate(y, m - 1, d, h, min, TZ).getTime());
}

/** "2026-10-06" + 3 jours → "2026-10-09". */
export function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addMinutes(d: Date, minutes: number) {
  return new Date(d.getTime() + minutes * 60_000);
}
