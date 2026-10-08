import Link from "next/link";
import type { Metadata } from "next";
import { CircleCheck } from "lucide-react";
import { prisma } from "@ocean/db";
import { ConfirmButton } from "@/components/forms";
import { StatusBadge } from "@/components/status-badge";
import { cancelAppointmentAsPatient } from "@/lib/actions/patient";
import { requireUser } from "@/lib/session";
import { bookingRules, canPatientCancel } from "@/lib/slots";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Mes rendez-vous" };

export default async function PatientAppointmentsPage({ searchParams }: PageProps<"/espace">) {
  const user = await requireUser();
  const { rdv, deplace } = await searchParams;
  const now = new Date();

  const [appointments, rules] = await Promise.all([
    prisma.appointment.findMany({
      where: { character: { userId: user.id } },
      include: { character: true, staff: true, service: true },
      orderBy: { start: "desc" },
      take: 50,
    }),
    bookingRules(),
  ]);
  const upcoming = appointments.filter((a) => a.start > now && ["PENDING", "CONFIRMED"].includes(a.status)).reverse();
  const past = appointments.filter((a) => !upcoming.includes(a));

  return (
    <div className="space-y-8">
      {rdv && upcoming.some((a) => a.id === rdv) && (
        <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          <CircleCheck className="size-5" /> Rendez-vous confirmé !
        </p>
      )}
      {deplace && upcoming.some((a) => a.id === deplace) && (
        <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          <CircleCheck className="size-5" /> Rendez-vous déplacé !
        </p>
      )}

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">À venir</h2>
          <Link href="/medecins" className="btn-primary">Prendre rendez-vous</Link>
        </div>
        <ul className="mt-4 space-y-3">
          {upcoming.map((a) => (
            <li key={a.id} className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
              <div className="flex-1">
                <p className="font-semibold">{formatDateTime(a.start)}</p>
                <p className="text-sm text-muted">
                  {a.staff.displayName}{a.service && ` · ${a.service.name}`} — pour {a.character.firstName} {a.character.lastName}
                </p>
                <p className="mt-1 text-sm">{a.reason}</p>
              </div>
              {canPatientCancel(a.start, rules) ? (
                <div className="flex gap-2">
                  <Link href={`/medecins/${a.staffId}?deplacer=${a.id}`} className="btn-secondary">Déplacer</Link>
                  <form action={cancelAppointmentAsPatient}>
                    <input type="hidden" name="id" value={a.id} />
                    <ConfirmButton message="Annuler ce rendez-vous ?">Annuler</ConfirmButton>
                  </form>
                </div>
              ) : (
                <p className="text-xs text-muted sm:max-w-44 sm:text-right">
                  Annulation ou déplacement en ligne impossible à moins de {rules.cancelNoticeHours} h du RDV : prévenez l&apos;hôpital en jeu.
                </p>
              )}
            </li>
          ))}
          {upcoming.length === 0 && <li className="card p-8 text-center text-sm text-muted">Aucun rendez-vous à venir.</li>}
        </ul>
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="text-lg font-bold">Historique</h2>
          <ul className="mt-4 space-y-3">
            {past.map((a) => (
              <li key={a.id} className="card p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{formatDateTime(a.start)}</p>
                  <StatusBadge status={a.status} />
                </div>
                <p className="text-sm text-muted">
                  {a.staff.displayName} — {a.character.firstName} {a.character.lastName}
                </p>
                {a.report && (
                  <div className="mt-3 rounded-xl bg-canvas p-3 text-sm">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Compte rendu</p>
                    <p className="whitespace-pre-line">{a.report}</p>
                  </div>
                )}
                {a.cancelReason && <p className="mt-2 text-xs text-muted">Motif d&apos;annulation : {a.cancelReason}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
