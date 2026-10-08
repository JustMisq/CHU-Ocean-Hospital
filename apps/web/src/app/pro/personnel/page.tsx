import type { Metadata } from "next";
import { ChevronRight, KeyRound, UserPlus, UserRoundCheck } from "lucide-react";
import type { ReactNode } from "react";
import { prisma } from "@ocean/db";
import { Avatar } from "@/components/avatar";
import { ActionForm, SubmitButton } from "@/components/forms";
import { GradeBadge } from "@/components/grade-badge";
import { addStaffMember, createStaffAccount, resetAccountPassword, updateStaffMember } from "@/lib/actions/pro";
import { isPeer, requireStaff } from "@/lib/session";
import { isStaffBookable } from "@/lib/slots";

export const metadata: Metadata = { title: "Personnel" };

export default async function StaffPage({ searchParams }: PageProps<"/pro/personnel">) {
  const user = await requireStaff("staff.manage");
  const { q: rawQ } = await searchParams;
  const query = typeof rawQ === "string" ? rawQ.trim() : "";
  const q = query.toLowerCase();
  const [staff, grades, services, specialties] = await Promise.all([
    prisma.staffProfile.findMany({
      include: { user: { omit: { passwordHash: true } }, grade: true, services: true, specialties: true },
      orderBy: [{ grade: { order: "desc" } }, { displayName: "asc" }],
    }),
    prisma.grade.findMany({ orderBy: { order: "desc" } }),
    prisma.service.findMany({ orderBy: { order: "asc" } }),
    prisma.specialty.findMany({ orderBy: { order: "asc" } }),
  ]);

  // Grades attribuables : strictement inférieurs au sien (sauf super-admin).
  const myOrder = user.staff.grade?.order ?? -Infinity;
  const assignable = grades.filter((g) => user.isAdmin || g.order < myOrder);
  const accountLabel = (u: { login: string | null }) => (u.login ? `@${u.login}` : "sans identifiant");
  // Recherche par nom, identifiant, grade, service ou spécialité.
  const matches = (s: (typeof staff)[number]) =>
    !q ||
    [s.displayName, s.user.username, s.user.login, s.grade?.name, ...s.services.map((x) => x.name), ...s.specialties.map((x) => x.name)]
      .some((v) => v?.toLowerCase().includes(q));
  const active = staff.filter((s) => s.grade && matches(s));
  const former = staff.filter((s) => !s.grade && matches(s));

  return (
    <div>
      <h1 className="text-2xl font-bold">Personnel</h1>

      <form className="mt-6 flex gap-2">
        <input name="q" defaultValue={query} placeholder="Nom, identifiant, grade, service…" className="input sm:max-w-sm" />
        <button className="btn-secondary">Rechercher</button>
      </form>
      <p className="mt-3 text-sm text-muted">{active.length} membre{active.length > 1 ? "s" : ""}{q && " trouvé" + (active.length > 1 ? "s" : "")}</p>

      <ul className="mt-3 space-y-2">
        {active.map((s) => {
          const peer = isPeer(user, s);
          const editable = user.isAdmin || (s.grade?.order ?? -1) < myOrder || peer;
          return (
            <li key={s.id}>
              <details className="card group">
                <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                  <Avatar name={s.displayName} src={s.photoUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {s.displayName} <GradeBadge grade={s.grade} />
                    </p>
                    <p className="truncate text-xs text-muted">
                      {[...s.services, ...s.specialties].map((x) => x.name).join(" · ") || "Aucun service"} · {accountLabel(s.user)}{!isStaffBookable(s) && " · hors annuaire"}
                    </p>
                  </div>
                  <ChevronRight className="size-4 text-muted transition group-open:rotate-90" />
                </summary>

                {editable ? (
                  <ActionForm action={updateStaffMember} className="space-y-4 border-t border-line p-4">
                    <input type="hidden" name="id" value={s.id} />
                    {peer ? (
                      <div>
                        <input type="hidden" name="gradeId" value={s.gradeId ?? ""} />
                        <p className="label">Grade</p>
                        <p className="text-sm text-muted">Même grade que vous : seule une personne de grade supérieur peut le modifier.</p>
                      </div>
                    ) : (
                      <div>
                        <label className="label">Grade</label>
                        <select name="gradeId" defaultValue={s.gradeId ?? ""} className="input sm:max-w-xs">
                          <option value="">— Retirer du personnel —</option>
                          {assignable.map((g) => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="label">Annuaire public & prise de RDV</label>
                      <select name="bookable" defaultValue={s.bookable === null ? "grade" : s.bookable ? "yes" : "no"} className="input sm:max-w-xs">
                        <option value="grade">Selon le grade ({s.grade?.bookable ? "affiché" : "masqué"})</option>
                        <option value="yes">Toujours affiché</option>
                        <option value="no">Jamais affiché</option>
                      </select>
                      <p className="mt-1 text-xs text-muted">Ex : un ambulancier n&apos;apparaît pas dans « Trouver un soignant » et ne publie pas de disponibilités.</p>
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

      <h2 className="mt-10 text-lg font-bold">Comptes</h2>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <AccountCard icon={<UserPlus className="size-5" />} title="Créer un compte soignant" text="Pour un nouvel EMS ou médecin. Un mot de passe temporaire s'affiche une seule fois : transmettez-le en jeu, il devra le changer à sa première connexion.">
          <ActionForm action={createStaffAccount} className="space-y-3" resetOnSuccess>
            <div className="grid gap-2 sm:grid-cols-2">
              <input name="login" required minLength={3} maxLength={32} autoCapitalize="none" placeholder="Identifiant (ex : j.reyes)" className="input" />
              <input name="displayName" required minLength={2} maxLength={60} placeholder="Nom affiché (ex : Dr. Reyes)" className="input" />
            </div>
            <div className="flex gap-2">
              <GradeSelect grades={assignable} />
              <SubmitButton className="btn-primary shrink-0">Créer</SubmitButton>
            </div>
          </ActionForm>
        </AccountCard>

        <AccountCard icon={<UserRoundCheck className="size-5" />} title="Promouvoir un compte existant" text="Pour un citoyen déjà inscrit sur le site, qui rejoint l'hôpital : il garde son compte et ses personnages.">
          <ActionForm action={addStaffMember} className="flex flex-col gap-2 sm:flex-row" resetOnSuccess>
            <input name="identifier" required autoCapitalize="none" placeholder="Identifiant du compte" className="input" />
            <GradeSelect grades={assignable} />
            <SubmitButton className="btn-primary shrink-0">Ajouter</SubmitButton>
          </ActionForm>
        </AccountCard>

        <AccountCard icon={<KeyRound className="size-5" />} title="Réinitialiser un mot de passe" text="Mot de passe oublié (patient ou soignant de grade inférieur au vôtre) : génère un mot de passe temporaire.">
          <ActionForm action={resetAccountPassword} className="flex gap-2" resetOnSuccess>
            <input name="identifier" required autoCapitalize="none" placeholder="Identifiant du compte" className="input" />
            <SubmitButton className="btn-secondary shrink-0">Réinitialiser</SubmitButton>
          </ActionForm>
        </AccountCard>
      </div>

      {former.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm font-semibold text-muted">Anciens membres ({former.length})</summary>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {former.map((s) => <li key={s.id}>{s.displayName} · {accountLabel(s.user)}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}

function AccountCard({ icon, title, text, children }: { icon: ReactNode; title: string; text: string; children: ReactNode }) {
  return (
    <section className="card space-y-3 p-5">
      <h3 className="flex items-center gap-2 font-bold"><span className="text-ocean-600">{icon}</span>{title}</h3>
      <p className="text-sm text-muted">{text}</p>
      {children}
    </section>
  );
}

function GradeSelect({ grades }: { grades: { id: string; name: string }[] }) {
  return (
    <select name="gradeId" required className="input sm:max-w-48">
      <option value="">Grade…</option>
      {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
    </select>
  );
}

function CheckboxGroup({ label, name, items, selected }: {
  label: string;
  name: string;
  items: { id: string; name: string }[];
  selected: string[];
}) {
  if (items.length === 0) return null;
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <label
            key={item.id}
            className="flex cursor-pointer items-center gap-2 rounded-xl border border-line px-3 py-1.5 text-sm has-checked:border-ocean-400 has-checked:bg-ocean-50"
          >
            <input type="checkbox" name={name} value={item.id} defaultChecked={selected.includes(item.id)} className="accent-ocean-600" />
            {item.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
