import type { Metadata } from "next";
import { Trash } from "lucide-react";
import { prisma } from "@ocean/db";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/forms";
import { addAvailability, deleteAvailability } from "@/lib/actions/pro";
import { requireStaff } from "@/lib/session";
import { dayKey, formatDay, formatTime } from "@/lib/time";

export const metadata: Metadata = { title: "Disponibilités" };

export default async function AvailabilityPage() {
  const { staff } = await requireStaff();
  const blocks = await prisma.availability.findMany({
    where: { staffId: staff.id, end: { gt: new Date() } },
    orderBy: { start: "asc" },
  });
  const booked = await prisma.appointment.findMany({
    where: { staffId: staff.id, end: { gt: new Date() }, status: { not: "CANCELLED" } },
    select: { start: true },
  });
  const bookedIn = (b: (typeof blocks)[number]) => booked.filter((a) => a.start >= b.start && a.start < b.end).length;

  return (
    <div>
      <h1 className="text-2xl font-bold">Disponibilités</h1>
      <p className="mt-1 text-sm text-muted">Publiez les plages pendant lesquelles les patients peuvent réserver (heure du serveur).</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <ul className="space-y-2">
          {blocks.map((b) => {
            const total = Math.floor((b.end.getTime() - b.start.getTime()) / 60_000 / b.slotMinutes);
            const taken = bookedIn(b);
            return (
              <li key={b.id} className="card flex items-center gap-4 p-4">
                <div className="flex-1">
                  <p className="font-semibold">{formatDay(b.start)}</p>
                  <p className="text-sm text-muted">
                    {formatTime(b.start)} – {formatTime(b.end)} · créneaux de {b.slotMinutes} min
                  </p>
                </div>
                <span className="text-sm font-medium text-ocean-700">{taken}/{total} réservés</span>
                <form action={deleteAvailability}>
                  <input type="hidden" name="id" value={b.id} />
                  <ConfirmButton
                    message={taken ? "Des RDV sont déjà pris : ils seront conservés. Supprimer la plage ?" : "Supprimer cette plage ?"}
                    className="rounded-full p-2 text-muted hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash className="size-4" />
                  </ConfirmButton>
                </form>
              </li>
            );
          })}
          {blocks.length === 0 && <li className="card p-8 text-center text-sm text-muted">Aucune disponibilité à venir.</li>}
        </ul>

        <ActionForm action={addAvailability} className="card h-fit space-y-4 p-5">
          <h2 className="font-bold">Ajouter une plage</h2>
          <div>
            <label className="label" htmlFor="date">Date</label>
            <input id="date" name="date" type="date" required defaultValue={dayKey(new Date())} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="from">De</label>
              <input id="from" name="from" type="time" required defaultValue="20:00" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="to">À</label>
              <input id="to" name="to" type="time" required defaultValue="23:00" className="input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="slotMinutes">Durée créneau</label>
              <select id="slotMinutes" name="slotMinutes" defaultValue="30" className="input">
                {[15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="repeatDays">Répéter</label>
              <select id="repeatDays" name="repeatDays" defaultValue="1" className="input">
                <option value="1">Une fois</option>
                <option value="3">3 jours</option>
                <option value="7">7 jours</option>
                <option value="14">14 jours</option>
              </select>
            </div>
          </div>
          <SubmitButton className="btn-primary w-full">Ajouter</SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}
