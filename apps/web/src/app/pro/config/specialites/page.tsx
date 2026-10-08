import type { Metadata } from "next";
import { prisma, type Specialty } from "@ocean/db";
import { ActionForm, SubmitButton } from "@/components/forms";
import { deleteSpecialty, saveSpecialty } from "@/lib/actions/config";
import { ConfigItem, DeleteButton } from "../shared";

export const metadata: Metadata = { title: "Spécialités" };

export default async function SpecialtiesConfigPage() {
  const specialties = await prisma.specialty.findMany({ orderBy: { order: "asc" }, include: { _count: { select: { staff: true } } } });

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div>
        <p className="mb-4 text-sm text-muted">
          Compétences complémentaires affichées sur les fiches soignants et utilisables comme filtre de recherche (un membre peut en avoir plusieurs).
        </p>
        <ul className="space-y-2">
          {specialties.map((s) => (
            <li key={s.id}>
              <ConfigItem title={s.name} subtitle={`${s._count.staff} membre(s) · ordre ${s.order}`}>
                <SpecialtyForm specialty={s} />
                <div className="mt-4 border-t border-line pt-4">
                  <DeleteButton action={deleteSpecialty} id={s.id} message={`Supprimer la spécialité « ${s.name} » ?`} />
                </div>
              </ConfigItem>
            </li>
          ))}
          {specialties.length === 0 && <li className="card p-8 text-center text-sm text-muted">Aucune spécialité.</li>}
        </ul>
      </div>

      <div className="card h-fit p-5">
        <h2 className="mb-4 font-bold">Nouvelle spécialité</h2>
        <SpecialtyForm />
      </div>
    </div>
  );
}

function SpecialtyForm({ specialty }: { specialty?: Specialty }) {
  return (
    <ActionForm action={saveSpecialty} className="space-y-4" resetOnSuccess={!specialty}>
      {specialty && <input type="hidden" name="id" value={specialty.id} />}
      <div className="grid grid-cols-[1fr_100px] gap-3">
        <div>
          <label className="label">Nom</label>
          <input name="name" required defaultValue={specialty?.name} className="input" />
        </div>
        <div>
          <label className="label">Ordre</label>
          <input name="order" type="number" defaultValue={specialty?.order ?? 0} className="input" />
        </div>
      </div>
      <div>
        <label className="label">Description</label>
        <textarea name="description" rows={2} maxLength={300} defaultValue={specialty?.description} className="input" />
      </div>
      <SubmitButton>{specialty ? "Enregistrer" : "Créer la spécialité"}</SubmitButton>
    </ActionForm>
  );
}
