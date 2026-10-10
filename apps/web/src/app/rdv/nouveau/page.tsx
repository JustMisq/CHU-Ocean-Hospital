import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays, Clock, TriangleAlert } from "lucide-react";
import { prisma } from "@ocean/db";
import { Avatar } from "@/components/avatar";
import { ActionForm, SubmitButton } from "@/components/forms";
import { bookAppointment, moveAppointmentAsPatient } from "@/lib/actions/patient";
import { ensureCharacter } from "@/lib/characters";
import { requireUser } from "@/lib/session";
import { bookableStaffWhere, bookingRules, findFreeSlot } from "@/lib/slots";
import { formatDateTime, formatDay, formatTime } from "@/lib/time";

export const metadata: Metadata = { title: "Confirmer le rendez-vous" };

export default async function NewAppointmentPage({ searchParams }: PageProps<"/rdv/nouveau">) {
  const params = await searchParams;
  const staffId = typeof params.soignant === "string" ? params.soignant : "";
  const startIso = typeof params.debut === "string" ? params.debut : "";
  const moveId = typeof params.deplacer === "string" ? params.deplacer : "";
  const moveParam = moveId ? `?deplacer=${moveId}` : "";
  const here = `/rdv/nouveau?soignant=${staffId}&debut=${encodeURIComponent(startIso)}${moveId ? `&deplacer=${moveId}` : ""}`;

  const user = await requireUser(here);
  const staff = await prisma.staffProfile.findFirst({
    where: { id: staffId, ...bookableStaffWhere },
    include: { grade: true, services: { where: { isPublic: true }, orderBy: { order: "asc" } } },
  });
  if (!staff) notFound();

  const [slot, rules] = await Promise.all([findFreeSlot(staff.id, new Date(startIso)), bookingRules()]);
  await ensureCharacter(user);
  const [characters, moving] = await Promise.all([
    prisma.character.findMany({ where: { userId: user.id, archivedAt: null, deceasedAt: null }, orderBy: { createdAt: "asc" } }),
    moveId
      ? prisma.appointment.findFirst({
          where: { id: moveId, staffId: staff.id, character: { userId: user.id }, status: { in: ["PENDING", "CONFIRMED"] } },
          include: { character: true },
        })
      : null,
  ]);

  const noShowWarning = (
    <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      <span>
        Si vous ne venez pas sans prévenir, le rendez-vous est noté <strong>absent</strong> dans votre dossier. Après plusieurs absences,
        le praticien peut refuser de vous prendre en rendez-vous. Empêché ? Annulez ou déplacez depuis votre espace, jusqu&apos;à{" "}
        {rules.cancelNoticeHours} h avant.
      </span>
    </p>
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href={`/medecins/${staff.id}${moveParam}`} className="text-sm font-medium text-ocean-600 hover:underline">← Changer de créneau</Link>
      <h1 className="mt-3 text-2xl font-bold">{moveId ? "Déplacer le rendez-vous" : "Confirmer le rendez-vous"}</h1>

      <div className="card mt-6 flex items-center gap-4 p-5">
        <Avatar name={staff.displayName} src={staff.photoUrl} size="md" />
        <div className="flex-1">
          <p className="font-semibold">{staff.displayName}</p>
          <p className="text-sm text-muted">{[staff.grade?.name, ...staff.services.map((s) => s.name)].filter(Boolean).join(" · ")}</p>
        </div>
        {slot && (
          <div className="text-right text-sm">
            <p className="flex items-center justify-end gap-1.5 font-semibold"><CalendarDays className="size-4 text-ocean-600" />{formatDay(slot.start)}</p>
            <p className="flex items-center justify-end gap-1.5 text-muted"><Clock className="size-4" />{formatTime(slot.start)} – {formatTime(slot.end)}</p>
          </div>
        )}
      </div>

      {staff.userId === user.id ? (
        <div className="card mt-4 p-6 text-center">
          <p className="text-muted">C&apos;est votre propre fiche : vous ne pouvez pas prendre rendez-vous avec vous-même.</p>
          <Link href="/medecins" className="btn-primary mt-4">Voir les autres soignants</Link>
        </div>
      ) : !slot ? (
        <div className="card mt-4 p-6 text-center">
          <p className="text-muted">Ce créneau n&apos;est plus disponible.</p>
          <Link href={`/medecins/${staff.id}${moveParam}`} className="btn-primary mt-4">Voir les autres créneaux</Link>
        </div>
      ) : moveId && !moving ? (
        <div className="card mt-4 p-6 text-center">
          <p className="text-muted">Ce rendez-vous n&apos;existe plus ou ne peut plus être déplacé.</p>
          <Link href="/espace" className="btn-primary mt-4">Mes rendez-vous</Link>
        </div>
      ) : moving ? (
        <ActionForm action={moveAppointmentAsPatient} className="card mt-4 space-y-5 p-6">
          <input type="hidden" name="id" value={moving.id} />
          <input type="hidden" name="start" value={slot.start.toISOString()} />
          <div className="text-sm">
            <p className="text-muted">Pour {moving.character.firstName} {moving.character.lastName} — {moving.reason}</p>
            <p className="mt-2">
              <span className="text-muted line-through">{formatDateTime(moving.start)}</span>
              {" → "}
              <strong>{formatDateTime(slot.start)}</strong>
            </p>
          </div>
          {noShowWarning}
          <SubmitButton className="btn-primary w-full py-3" pendingText="Déplacement…">Confirmer le déplacement</SubmitButton>
        </ActionForm>
      ) : (
        <ActionForm action={bookAppointment} className="card mt-4 space-y-5 p-6">
          <input type="hidden" name="staffId" value={staff.id} />
          <input type="hidden" name="start" value={slot.start.toISOString()} />

          <fieldset>
            <legend className="label">Pour quel personnage ?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {characters.map((c, i) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line p-3 has-checked:border-ocean-500 has-checked:bg-ocean-50">
                  <input type="radio" name="characterId" value={c.id} defaultChecked={i === 0} className="accent-ocean-600" />
                  <span className="text-sm font-medium">{c.firstName} {c.lastName}</span>
                </label>
              ))}
            </div>
            <Link href={`/espace/personnages?retour=${encodeURIComponent(here)}`} className="mt-2 inline-block text-xs font-medium text-ocean-600 hover:underline">
              + Ajouter un personnage
            </Link>
          </fieldset>

          {staff.services.length > 1 ? (
            <div>
              <label htmlFor="serviceId" className="label">Service</label>
              <select id="serviceId" name="serviceId" className="input">
                {staff.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          ) : (
            staff.services[0] && <input type="hidden" name="serviceId" value={staff.services[0].id} />
          )}

          <div>
            <label htmlFor="reason" className="label">Motif de la consultation</label>
            <textarea id="reason" name="reason" rows={3} required minLength={3} maxLength={500} className="input" placeholder="Ex : douleur à l'épaule suite à une chute, visite médicale pour le permis…" />
          </div>

          {noShowWarning}
          <SubmitButton className="btn-primary w-full py-3" pendingText="Réservation…">Confirmer le rendez-vous</SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}
