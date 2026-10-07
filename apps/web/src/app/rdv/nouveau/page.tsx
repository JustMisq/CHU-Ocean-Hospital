import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays, Clock } from "lucide-react";
import { prisma } from "@ocean/db";
import { Avatar } from "@/components/avatar";
import { ActionForm, SubmitButton } from "@/components/forms";
import { bookAppointment } from "@/lib/actions/patient";
import { ensureCharacter } from "@/lib/characters";
import { requireUser } from "@/lib/session";
import { bookableStaffWhere, findFreeSlot } from "@/lib/slots";
import { formatDay, formatTime } from "@/lib/time";

export const metadata: Metadata = { title: "Confirmer le rendez-vous" };

export default async function NewAppointmentPage({ searchParams }: PageProps<"/rdv/nouveau">) {
  const params = await searchParams;
  const staffId = typeof params.soignant === "string" ? params.soignant : "";
  const startIso = typeof params.debut === "string" ? params.debut : "";
  const here = `/rdv/nouveau?soignant=${staffId}&debut=${encodeURIComponent(startIso)}`;

  const user = await requireUser(here);
  const staff = await prisma.staffProfile.findFirst({
    where: { id: staffId, ...bookableStaffWhere },
    include: { grade: true, services: { where: { isPublic: true }, orderBy: { order: "asc" } }, user: { select: { avatarUrl: true } } },
  });
  if (!staff) notFound();

  const slot = await findFreeSlot(staff.id, new Date(startIso));
  await ensureCharacter(user);
  const characters = await prisma.character.findMany({ where: { userId: user.id, archivedAt: null }, orderBy: { createdAt: "asc" } });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href={`/medecins/${staff.id}`} className="text-sm font-medium text-ocean-600 hover:underline">← Changer de créneau</Link>
      <h1 className="mt-3 text-2xl font-bold">Confirmer le rendez-vous</h1>

      <div className="card mt-6 flex items-center gap-4 p-5">
        <Avatar name={staff.displayName} src={staff.photoUrl ?? staff.user.avatarUrl} size="md" />
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
          <Link href={`/medecins/${staff.id}`} className="btn-primary mt-4">Voir les autres créneaux</Link>
        </div>
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

          <SubmitButton className="btn-primary w-full py-3" pendingText="Réservation…">Confirmer le rendez-vous</SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}
