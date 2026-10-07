import Link from "next/link";
import { notFound } from "next/navigation";
import { Droplet, Phone, TriangleAlert } from "lucide-react";
import { prisma } from "@ocean/db";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/forms";
import { StatusBadge } from "@/components/status-badge";
import { cancelAppointmentAsStaff, completeAppointment, markNoShow } from "@/lib/actions/pro";
import { requireStaff } from "@/lib/session";
import { formatDate, formatDateTime, formatTime } from "@/lib/time";

export default async function AppointmentDetailPage({ params }: PageProps<"/pro/rdv/[id]">) {
  const { id } = await params;
  const user = await requireStaff();
  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: { character: { include: { user: true } }, staff: true, service: true },
  });
  if (!appointment) notFound();

  const isMine = appointment.staffId === user.staff.id;
  if (!isMine && !user.can("agenda.view_all") && !user.can("appointments.manage_all")) notFound();

  const canManage = isMine || user.can("appointments.manage_all");
  const canSeeHistory = user.can("patients.history");
  const isOpen = appointment.status === "CONFIRMED" || appointment.status === "PENDING";
  const hasStarted = appointment.start <= new Date();
  const { character } = appointment;

  // Dossier : consultations précédentes du personnage à l'hôpital.
  const history = canSeeHistory
    ? await prisma.appointment.findMany({
        where: { characterId: character.id, id: { not: appointment.id }, status: "COMPLETED" },
        include: { staff: true },
        orderBy: { start: "desc" },
        take: 20,
      })
    : [];

  return (
    <div className="space-y-6">
      <Link href="/pro" className="text-sm font-medium text-ocean-600 hover:underline">← Agenda</Link>

      <div className="card p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold">{formatDateTime(appointment.start)}</h1>
          <StatusBadge status={appointment.status} />
        </div>
        <p className="mt-1 text-sm text-muted">
          {formatTime(appointment.start)} – {formatTime(appointment.end)} · {appointment.staff.displayName}
          {appointment.service && ` · ${appointment.service.name}`}
        </p>
        <div className="mt-4 rounded-xl bg-canvas p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Motif</p>
          <p className="mt-1 whitespace-pre-line">{appointment.reason}</p>
        </div>
        {appointment.cancelReason && <p className="mt-3 text-sm text-muted">Annulation : {appointment.cancelReason}</p>}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="font-bold">Patient</h2>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-lg font-semibold">
            {character.firstName} {character.lastName}
            {character.archivedAt && <span className="rounded-full bg-canvas px-2 py-0.5 text-xs font-medium text-muted">Personnage archivé</span>}
          </p>
          <p className="text-sm text-muted">Né(e) le {formatDate(character.birthDate)} · Joueur : {character.user.username}</p>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            {character.phone && <span className="flex items-center gap-1.5"><Phone className="size-4 text-muted" />{character.phone}</span>}
            <span className="flex items-center gap-1.5"><Droplet className="size-4 text-red-500" />{character.bloodType ?? "Groupe inconnu"}</span>
          </div>
          {character.allergies && (
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-900">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {character.allergies}
            </p>
          )}

          {canSeeHistory && <>
          <h3 className="mt-6 text-sm font-bold">Historique ({history.length})</h3>
          <ul className="mt-2 space-y-2">
            {history.map((h) => (
              <li key={h.id} className="rounded-xl border border-line p-3 text-sm">
                <p className="font-medium">{formatDate(h.start)} · {h.staff.displayName}</p>
                <p className="mt-1 whitespace-pre-line text-muted">{h.report}</p>
              </li>
            ))}
            {history.length === 0 && <li className="text-sm text-muted">Première consultation.</li>}
          </ul>
          </>}
        </section>

        <section className="card h-fit p-6">
          <h2 className="font-bold">Compte rendu</h2>
          {appointment.status === "COMPLETED" ? (
            <p className="mt-3 whitespace-pre-line text-sm">{appointment.report}</p>
          ) : canManage && isOpen ? (
            <>
              {hasStarted ? (
                <ActionForm action={completeAppointment} className="mt-3 space-y-3">
                  <input type="hidden" name="id" value={appointment.id} />
                  <textarea name="report" rows={7} required maxLength={4000} className="input" placeholder="Examen, diagnostic, soins prodigués, traitement, arrêt / certificat…" />
                  <p className="text-xs text-muted">Le compte rendu sera visible par le patient.</p>
                  <SubmitButton pendingText="Enregistrement…">Clôturer la consultation</SubmitButton>
                </ActionForm>
              ) : (
                <p className="mt-3 rounded-xl bg-canvas p-4 text-sm text-muted">
                  Le compte rendu pourra être rédigé à partir de {formatTime(appointment.start)}, le {formatDate(appointment.start)}.
                </p>
              )}

              <div className="mt-6 border-t border-line pt-5">
                {hasStarted && (
                  <form action={markNoShow} className="mb-3">
                    <input type="hidden" name="id" value={appointment.id} />
                    <ConfirmButton message="Marquer le patient comme absent ?" className="btn-secondary w-full">Patient absent</ConfirmButton>
                  </form>
                )}
                <ActionForm action={cancelAppointmentAsStaff} className="flex gap-2">
                  <input type="hidden" name="id" value={appointment.id} />
                  <input name="reason" maxLength={300} placeholder="Motif d'annulation" className="input" />
                  <ConfirmButton message="Annuler ce rendez-vous ? Le patient sera prévenu.">Annuler</ConfirmButton>
                </ActionForm>
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted">Aucun compte rendu.</p>
          )}
        </section>
      </div>
    </div>
  );
}
