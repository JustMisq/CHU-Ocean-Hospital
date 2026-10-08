import type { Metadata } from "next";
import { PERMISSIONS, parsePermissions, prisma, type Grade } from "@ocean/db";
import { ActionForm, SubmitButton } from "@/components/forms";
import { GradeBadge } from "@/components/grade-badge";
import { deleteGrade, saveGrade } from "@/lib/actions/config";
import { ConfigItem, DeleteButton } from "../shared";

export const metadata: Metadata = { title: "Grades" };

export default async function GradesConfigPage() {
  const grades = await prisma.grade.findMany({ orderBy: { order: "desc" }, include: { _count: { select: { staff: true } } } });

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div>
        <p className="mb-4 text-sm text-muted">
          Hiérarchie de l&apos;hôpital : plus l&apos;ordre est élevé, plus le grade est haut. Un membre ne peut gérer que des grades inférieurs au sien.
          Avoir un grade donne accès à l&apos;espace pro.
        </p>
        <ul className="space-y-2">
          {grades.map((g) => (
            <li key={g.id}>
              <ConfigItem
                title={<GradeBadge grade={g} />}
                subtitle={`Ordre ${g.order} · ${g._count.staff} membre(s) · ${parsePermissions(g.permissions).length} permission(s)${g.bookable ? "" : " · non réservable"}`}
              >
                <GradeForm grade={g} />
                <div className="mt-4 border-t border-line pt-4">
                  <DeleteButton action={deleteGrade} id={g.id} message={`Supprimer le grade « ${g.name} » ? Ses ${g._count.staff} membre(s) perdront l'accès pro.`} />
                </div>
              </ConfigItem>
            </li>
          ))}
        </ul>
      </div>

      <div className="card h-fit p-5">
        <h2 className="mb-4 font-bold">Nouveau grade</h2>
        <GradeForm />
      </div>
    </div>
  );
}

function GradeForm({ grade }: { grade?: Grade }) {
  const current = grade ? parsePermissions(grade.permissions) : [];
  return (
    <ActionForm action={saveGrade} className="space-y-4" resetOnSuccess={!grade}>
      {grade && <input type="hidden" name="id" value={grade.id} />}
      <div className="grid grid-cols-[1fr_90px_70px] gap-3">
        <div>
          <label className="label">Nom</label>
          <input name="name" required defaultValue={grade?.name} className="input" />
        </div>
        <div>
          <label className="label">Ordre</label>
          <input name="order" type="number" min={0} max={1000} required defaultValue={grade?.order ?? 10} className="input" />
        </div>
        <div>
          <label className="label">Couleur</label>
          <input name="color" type="color" defaultValue={grade?.color ?? "#0a6f98"} className="h-[42px] w-full cursor-pointer rounded-xl border border-line bg-white p-1" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="bookable" defaultChecked={grade?.bookable ?? true} className="size-4 accent-ocean-600" />
        Peut recevoir des rendez-vous (disponibilités + annuaire) — modifiable par membre dans Personnel
      </label>
      <fieldset>
        <legend className="label">Permissions</legend>
        <div className="space-y-1.5">
          {Object.entries(PERMISSIONS).map(([key, label]) => (
            <label key={key} className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="permissions" value={key} defaultChecked={current.includes(key as keyof typeof PERMISSIONS)} className="mt-0.5 size-4 accent-ocean-600" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <SubmitButton>{grade ? "Enregistrer" : "Créer le grade"}</SubmitButton>
    </ActionForm>
  );
}
