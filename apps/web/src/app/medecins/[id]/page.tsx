import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { prisma } from "@ocean/db";
import { Avatar } from "@/components/avatar";
import { GradeBadge } from "@/components/grade-badge";
import { ServiceIcon } from "@/components/service-icon";
import { bookableStaffWhere, getFreeSlots } from "@/lib/slots";
import { formatDay, formatTime } from "@/lib/time";

export default async function DoctorPage({ params }: PageProps<"/medecins/[id]">) {
  const { id } = await params;
  const staff = await prisma.staffProfile.findFirst({
    where: { id, ...bookableStaffWhere },
    include: {
      grade: true,
      services: { where: { isPublic: true }, orderBy: { order: "asc" } },
      specialties: { orderBy: { order: "asc" } },
      user: { select: { avatarUrl: true } },
    },
  });
  if (!staff) notFound();

  const days = [...(await getFreeSlots(staff.id)).entries()];

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 lg:grid-cols-[1fr_1.4fr]">
      <aside className="card h-fit p-6">
        <div className="flex items-center gap-4">
          <Avatar name={staff.displayName} src={staff.user.avatarUrl} size="lg" />
          <div>
            <h1 className="text-xl font-bold">{staff.displayName}</h1>
            <div className="mt-1"><GradeBadge grade={staff.grade} /></div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {staff.services.map((s) => (
            <Link key={s.id} href={`/medecins?service=${s.slug}`} className="inline-flex items-center gap-2 rounded-full bg-ocean-50 px-3 py-1.5 text-sm font-medium text-ocean-700">
              <ServiceIcon name={s.icon} className="size-4" /> {s.name}
            </Link>
          ))}
          {staff.specialties.map((s) => (
            <Link key={s.id} href={`/medecins?specialite=${s.slug}`} className="rounded-full border border-line px-3 py-1.5 text-sm font-medium text-muted">
              {s.name}
            </Link>
          ))}
        </div>
        {staff.bio && <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-muted">{staff.bio}</p>}
      </aside>

      <section className="card p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <CalendarDays className="size-5 text-ocean-600" /> Prendre rendez-vous
        </h2>
        <p className="mt-1 text-sm text-muted">Choisissez un créneau (heure du serveur).</p>

        {days.length === 0 ? (
          <p className="mt-6 rounded-xl bg-canvas p-6 text-center text-sm text-muted">
            Aucun créneau disponible pour le moment. Revenez plus tard !
          </p>
        ) : (
          <div className="mt-6 space-y-6">
            {days.map(([key, slots]) => (
              <div key={key}>
                <h3 className="mb-2 text-sm font-semibold">{formatDay(slots[0].start)}</h3>
                <div className="flex flex-wrap gap-2">
                  {slots.map((slot) => (
                    <Link
                      key={slot.start.toISOString()}
                      href={`/rdv/nouveau?soignant=${staff.id}&debut=${encodeURIComponent(slot.start.toISOString())}`}
                      className="rounded-lg bg-ocean-50 px-3 py-2 text-sm font-semibold text-ocean-700 transition hover:bg-ocean-600 hover:text-white"
                    >
                      {formatTime(slot.start)}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
