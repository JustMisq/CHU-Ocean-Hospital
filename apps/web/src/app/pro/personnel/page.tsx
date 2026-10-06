import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import { parseRoleIds, prisma } from "@ocean/db";
import { Avatar } from "@/components/avatar";
import { DiscordPill } from "@/components/discord-pill";
import { ActionForm, SubmitButton } from "@/components/forms";
import { GradeBadge } from "@/components/grade-badge";
import { addStaffMember, updateStaffMember } from "@/lib/actions/pro";
import { requireStaff } from "@/lib/session";

export const metadata: Metadata = { title: "Personnel" };

const linked = (x: { discordRoleIds: string }) => parseRoleIds(x.discordRoleIds).length > 0;

export default async function StaffPage() {
  const user = await requireStaff("staff.manage");
  const [staff, grades, services, specialties] = await Promise.all([
    prisma.staffProfile.findMany({
      include: { user: true, grade: true, services: true, specialties: true },
      orderBy: [{ grade: { order: "desc" } }, { displayName: "asc" }],
    }),
    prisma.grade.findMany({ orderBy: { order: "desc" } }),
    prisma.service.findMany({ orderBy: { order: "asc" } }),
    prisma.specialty.findMany({ orderBy: { order: "asc" } }),
  ]);

  // Grades attribuables : strictement inférieurs au sien (sauf super-admin).
  const myOrder = user.staff.grade?.order ?? -Infinity;
  const assignable = grades.filter((g) => user.isAdmin || g.order < myOrder);
  const active = staff.filter((s) => s.grade);
  const former = staff.filter((s) => !s.grade);

  return (
    <div>
      <h1 className="text-2xl font-bold">Personnel</h1>
      <p className="mt-1 text-sm text-muted">
        Les éléments marqués <DiscordPill /> suivent automatiquement les rôles Discord à chaque connexion. Les autres s&apos;attribuent ici.
      </p>

      <ul className="mt-6 space-y-2">
        {active.map((s) => {
          const editable = user.isAdmin || (s.grade?.order ?? -1) < myOrder;
          return (
            <li key={s.id}>
              <details className="card group">
                <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                  <Avatar name={s.displayName} src={s.user.avatarUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {s.displayName} <GradeBadge grade={s.grade} /> {s.grade && linked(s.grade) && <DiscordPill />}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {[...s.services, ...s.specialties].map((x) => x.name).join(" · ") || "Aucun service"} · ID {s.user.discordId}
                    </p>
                  </div>
                  <ChevronRight className="size-4 text-muted transition group-open:rotate-90" />
                </summary>

                {editable ? (
                  <ActionForm action={updateStaffMember} className="space-y-4 border-t border-line p-4">
                    <input type="hidden" name="id" value={s.id} />
                    <div>
                      <label className="label">Grade</label>
                      <select name="gradeId" defaultValue={s.gradeId ?? ""} className="input sm:max-w-xs">
                        <option value="">— Retirer du personnel —</option>
                        {assignable.map((g) => (
                          <option key={g.id} value={g.id}>{g.name}{linked(g) ? " (Discord)" : ""}</option>
                        ))}
                      </select>
                      {s.grade && linked(s.grade) && (
                        <p className="mt-1 text-xs text-muted">Grade issu de Discord : il sera réappliqué à la prochaine connexion tant que le rôle est présent.</p>
                      )}
                    </div>
                    <CheckboxGroup label="Services" name="services" items={services} selected={s.services.map((x) => x.id)} />
                    <CheckboxGroup label="Spécialités" name="specialties" items={specialties} selected={s.specialties.map((x) => x.id)} />
                    <SubmitButton>Enregistrer</SubmitButton>
                  </ActionForm>
                ) : (
                  <p className="border-t border-line p-4 text-sm text-muted">Grade égal ou supérieur au vôtre : modification impossible.</p>
                )}
              </details>
            </li>
          );
        })}
      </ul>

      <ActionForm action={addStaffMember} className="card mt-8 space-y-4 p-5" resetOnSuccess>
        <h2 className="font-bold">Ajouter un membre manuellement</h2>
        <p className="text-sm text-muted">La personne doit s&apos;être connectée au moins une fois au site. Pratique pour les grades sans rôle Discord.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input name="discordId" required placeholder="ID Discord de la personne" className="input" />
          <select name="gradeId" required className="input sm:max-w-56">
            <option value="">Grade…</option>
            {assignable.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <SubmitButton className="btn-primary shrink-0">Ajouter</SubmitButton>
        </div>
      </ActionForm>

      {former.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm font-semibold text-muted">Anciens membres ({former.length})</summary>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {former.map((s) => <li key={s.id}>{s.displayName} · ID {s.user.discordId}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}

function CheckboxGroup({ label, name, items, selected }: {
  label: string;
  name: string;
  items: { id: string; name: string; discordRoleIds: string }[];
  selected: string[];
}) {
  if (items.length === 0) return null;
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const isLinked = linked(item);
          return (
            <label
              key={item.id}
              title={isLinked ? "Géré par un rôle Discord" : undefined}
              className={`flex items-center gap-2 rounded-xl border border-line px-3 py-1.5 text-sm has-checked:border-ocean-400 has-checked:bg-ocean-50 ${isLinked ? "opacity-70" : "cursor-pointer"}`}
            >
              <input type="checkbox" name={name} value={item.id} defaultChecked={selected.includes(item.id)} disabled={isLinked} className="accent-ocean-600" />
              {item.name}
              {isLinked && <DiscordPill />}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
