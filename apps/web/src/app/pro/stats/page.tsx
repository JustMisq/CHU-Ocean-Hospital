import type { Metadata } from "next";
import { prisma } from "@ocean/db";
import { requireStaff } from "@/lib/session";
import { addMinutes } from "@/lib/time";

export const metadata: Metadata = { title: "Statistiques" };

export default async function StatsPage() {
  await requireStaff("stats.view");
  const now = new Date();
  const weekAgo = addMinutes(now, -7 * 24 * 60);
  const past = { start: { gte: weekAgo, lte: now } };

  const [booked, completed, noShow, cancelled, patients, perStaff] = await Promise.all([
    prisma.appointment.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.appointment.count({ where: { ...past, status: "COMPLETED" } }),
    prisma.appointment.count({ where: { ...past, status: "NO_SHOW" } }),
    prisma.appointment.count({ where: { ...past, status: "CANCELLED" } }),
    prisma.character.count(),
    prisma.staffProfile.findMany({
      where: { gradeId: { not: null } },
      select: { displayName: true, _count: { select: { appointments: { where: { ...past, status: "COMPLETED" } } } } },
    }),
  ]);

  const tiles = [
    ["RDV pris", booked],
    ["Consultations", completed],
    ["Absences", noShow],
    ["Annulations", cancelled],
    ["Patients enregistrés", patients],
  ] as const;
  const ranking = perStaff.filter((s) => s._count.appointments > 0).sort((a, b) => b._count.appointments - a._count.appointments);

  return (
    <div>
      <h1 className="text-2xl font-bold">Statistiques</h1>
      <p className="mt-1 text-sm text-muted">Sur les 7 derniers jours.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {tiles.map(([label, value]) => (
          <div key={label} className="card p-4">
            <p className="text-xs font-medium text-muted">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-lg font-bold">Consultations par soignant</h2>
      <ul className="card mt-3 divide-y divide-line">
        {ranking.map((s) => (
          <li key={s.displayName} className="flex justify-between p-3 text-sm">
            <span>{s.displayName}</span>
            <span className="font-semibold">{s._count.appointments}</span>
          </li>
        ))}
        {ranking.length === 0 && <li className="p-6 text-center text-sm text-muted">Aucune consultation cette semaine.</li>}
      </ul>
    </div>
  );
}
