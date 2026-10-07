import Link from "next/link";
import type { Metadata } from "next";
import { CalendarDays, ChevronRight } from "lucide-react";
import { prisma } from "@ocean/db";
import { Avatar } from "@/components/avatar";
import { GradeBadge } from "@/components/grade-badge";
import { bookableStaffWhere, getFreeSlots } from "@/lib/slots";
import { formatShortDay, formatTime } from "@/lib/time";

export const metadata: Metadata = { title: "Trouver un soignant" };

export default async function DoctorsPage({ searchParams }: PageProps<"/medecins">) {
  const params = await searchParams;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const q = str(params.q);
  const service = str(params.service);
  const specialite = str(params.specialite);

  const [services, specialties, staff] = await Promise.all([
    prisma.service.findMany({ where: { isPublic: true }, orderBy: { order: "asc" } }),
    prisma.specialty.findMany({ orderBy: { order: "asc" } }),
    prisma.staffProfile.findMany({
      where: {
        ...bookableStaffWhere,
        ...(q && { displayName: { contains: q, mode: "insensitive" } }),
        ...(service && { services: { some: { slug: service } } }),
        ...(specialite && { specialties: { some: { slug: specialite } } }),
      },
      include: {
        grade: true,
        services: { where: { isPublic: true }, orderBy: { order: "asc" } },
        specialties: { orderBy: { order: "asc" } },
        user: { select: { avatarUrl: true } },
      },
      orderBy: [{ grade: { order: "desc" } }, { displayName: "asc" }],
    }),
  ]);

  // Prochain créneau libre pour chaque soignant.
  const nextSlots = await Promise.all(
    staff.map(async (s) => [...(await getFreeSlots(s.id)).values()][0]?.[0] ?? null),
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">Trouver un soignant</h1>

      <form className="mt-6 flex flex-col gap-2 sm:flex-row">
        <input name="q" defaultValue={q} placeholder="Nom du soignant…" className="input sm:max-w-xs" />
        <select name="service" defaultValue={service} className="input sm:max-w-56">
          <option value="">Tous les services</option>
          {services.map((s) => <option key={s.id} value={s.slug}>{s.name}</option>)}
        </select>
        {specialties.length > 0 && (
          <select name="specialite" defaultValue={specialite} className="input sm:max-w-56">
            <option value="">Toutes les spécialités</option>
            {specialties.map((s) => <option key={s.id} value={s.slug}>{s.name}</option>)}
          </select>
        )}
        <button className="btn-primary">Filtrer</button>
      </form>

      <p className="mt-6 text-sm text-muted">{staff.length} résultat{staff.length > 1 ? "s" : ""}</p>

      <ul className="mt-3 grid gap-3">
        {staff.map((s, i) => {
          const next = nextSlots[i];
          return (
            <li key={s.id}>
              <Link href={`/medecins/${s.id}`} className="card flex items-center gap-4 p-4 transition hover:border-ocean-300 hover:shadow-md">
                <Avatar name={s.displayName} src={s.photoUrl ?? s.user.avatarUrl} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">{s.displayName} <GradeBadge grade={s.grade} /></p>
                  <p className="truncate text-sm text-muted">
                    {[...s.services.map((x) => x.name), ...s.specialties.map((x) => x.name)].join(" · ")}
                  </p>
                </div>
                <div className="hidden text-right text-sm sm:block">
                  {next ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-ocean-50 px-3 py-1 font-medium text-ocean-700">
                      <CalendarDays className="size-4" />
                      {formatShortDay(next.start)} · {formatTime(next.start)}
                    </span>
                  ) : (
                    <span className="text-muted">Aucune disponibilité</span>
                  )}
                </div>
                <ChevronRight className="size-5 text-muted" />
              </Link>
            </li>
          );
        })}
        {staff.length === 0 && <li className="card p-8 text-center text-muted">Aucun soignant ne correspond à votre recherche.</li>}
      </ul>
    </div>
  );
}
