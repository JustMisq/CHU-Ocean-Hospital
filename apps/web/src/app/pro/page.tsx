import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import { prisma } from "@ocean/db";
import { StatusBadge } from "@/components/status-badge";
import { requireStaff } from "@/lib/session";
import { addMinutes, dayKey, formatDay, formatTime } from "@/lib/time";

export const metadata: Metadata = { title: "Agenda" };

export default async function AgendaPage({ searchParams }: PageProps<"/pro">) {
  const user = await requireStaff();
  const canViewAll = user.can("agenda.view_all");
  const showAll = (await searchParams).vue === "hopital" && canViewAll;

  // Depuis 12h en arrière, pour garder les RDV du jour à clôturer.
  const from = addMinutes(new Date(), -12 * 60);
  const appointments = await prisma.appointment.findMany({
    where: {
      start: { gte: from, lte: addMinutes(from, 15 * 24 * 60) },
      status: { not: "CANCELLED" },
      ...(!showAll && { staffId: user.staff.id }),
    },
    include: { character: true, staff: true },
    orderBy: { start: "asc" },
  });

  const toClose = appointments.filter((a) => a.end < new Date() && a.status === "CONFIRMED").length;
  const byDay = Map.groupBy(appointments, (a) => dayKey(a.start));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Agenda</h1>
        {canViewAll && (
          <div className="flex rounded-full border border-line bg-white p-1 text-sm font-medium">
            <Link href="/pro" className={`rounded-full px-3 py-1 ${!showAll ? "bg-ocean-600 text-white" : "text-muted"}`}>Mes RDV</Link>
            <Link href="/pro?vue=hopital" className={`rounded-full px-3 py-1 ${showAll ? "bg-ocean-600 text-white" : "text-muted"}`}>Tout l&apos;hôpital</Link>
          </div>
        )}
      </div>

      {toClose > 0 && (
        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          {toClose} rendez-vous passé{toClose > 1 ? "s" : ""} à clôturer (compte rendu ou absence).
        </p>
      )}

      <div className="mt-6 space-y-6">
        {[...byDay.entries()].map(([key, items]) => (
          <section key={key}>
            <h2 className="mb-2 text-sm font-semibold text-muted">{formatDay(items[0].start)}</h2>
            <ul className="card divide-y divide-line">
              {items.map((a) => (
                <li key={a.id}>
                  <Link href={`/pro/rdv/${a.id}`} className="flex items-center gap-4 p-4 hover:bg-ocean-50/50">
                    <span className="w-14 shrink-0 font-mono text-sm font-semibold text-ocean-700">{formatTime(a.start)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{a.character.firstName} {a.character.lastName}</span>
                      <span className="block truncate text-sm text-muted">
                        {showAll && `${a.staff.displayName} · `}{a.reason}
                      </span>
                    </span>
                    <StatusBadge status={a.status} />
                    <ChevronRight className="size-4 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {appointments.length === 0 && (
          <div className="card p-10 text-center text-sm text-muted">
            Aucun rendez-vous prévu. <Link href="/pro/disponibilites" className="font-medium text-ocean-600 hover:underline">Ajoutez des disponibilités</Link> pour être réservable.
          </div>
        )}
      </div>
    </div>
  );
}
