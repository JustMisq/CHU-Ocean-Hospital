import type { Metadata } from "next";
import { Droplet, Pencil, Phone, Trash } from "lucide-react";
import { prisma } from "@ocean/db";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/forms";
import { MedicalFields } from "@/components/medical-fields";
import { createCharacter, deleteCharacter, updateCharacter } from "@/lib/actions/patient";
import { missingInfo } from "@/lib/characters";
import { requireUser } from "@/lib/session";
import { formatDate } from "@/lib/time";

export const metadata: Metadata = { title: "Mes personnages" };

export default async function CharactersPage({ searchParams }: PageProps<"/espace/personnages">) {
  const user = await requireUser("/espace/personnages");
  const { retour } = await searchParams;
  const characters = await prisma.character.findMany({ where: { userId: user.id, archivedAt: null }, orderBy: { createdAt: "asc" } });

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
      <section className="space-y-3">
        {characters.map((c) => {
          const missing = missingInfo(c);
          return (
            <details key={c.id} className="card group" open={missing.length > 0}>
              <summary className="flex cursor-pointer list-none items-start gap-3 p-5">
                <div className="flex-1">
                  <p className="font-semibold">{c.firstName} {c.lastName}</p>
                  <p className="text-sm text-muted">{c.birthDate ? `Né(e) le ${formatDate(c.birthDate)}` : "Date de naissance non renseignée"}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
                    {c.phone && <span className="flex items-center gap-1"><Phone className="size-3.5" />{c.phone}</span>}
                    {c.bloodType && <span className="flex items-center gap-1"><Droplet className="size-3.5" />{c.bloodType}</span>}
                  </div>
                  {c.allergies && <p className="mt-2 text-xs"><span className="font-semibold">Allergies :</span> {c.allergies}</p>}
                  {missing.length > 0 && <p className="mt-2 text-xs font-medium text-amber-700">À compléter : {missing.join(", ")}</p>}
                </div>
                <span className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-ocean-600 group-open:hidden"><Pencil className="size-3.5" /> Modifier</span>
              </summary>

              <div className="border-t border-line p-5">
                <ActionForm action={updateCharacter} className="space-y-4">
                  <input type="hidden" name="id" value={c.id} />
                  <IdentityFields firstName={c.firstName} lastName={c.lastName} idPrefix={`${c.id}-`} />
                  <MedicalFields character={c} idPrefix={`${c.id}-`} />
                  <SubmitButton className="btn-primary w-full">Enregistrer</SubmitButton>
                </ActionForm>
                {characters.length > 1 && (
                  <form action={deleteCharacter} className="mt-3 text-right">
                    <input type="hidden" name="id" value={c.id} />
                    <ConfirmButton
                      message="Supprimer ce personnage ? Ses rendez-vous à venir seront annulés. Son dossier reste consultable par les soignants."
                      className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-red-700"
                    >
                      <Trash className="size-3.5" /> Supprimer ce personnage
                    </ConfirmButton>
                  </form>
                )}
              </div>
            </details>
          );
        })}
      </section>

      <details className="card h-fit" open={typeof retour === "string"}>
        <summary className="cursor-pointer p-5 font-bold">+ Ajouter un autre personnage</summary>
        <ActionForm action={createCharacter} className="space-y-4 border-t border-line p-5" resetOnSuccess>
          {typeof retour === "string" && <input type="hidden" name="retour" value={retour} />}
          <IdentityFields />
          <MedicalFields idPrefix="new-" />
          <SubmitButton className="btn-primary w-full">Ajouter</SubmitButton>
        </ActionForm>
      </details>
    </div>
  );
}

function IdentityFields({ firstName, lastName, idPrefix = "new-" }: { firstName?: string; lastName?: string; idPrefix?: string }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="label" htmlFor={`${idPrefix}firstName`}>Prénom</label>
        <input id={`${idPrefix}firstName`} name="firstName" required maxLength={40} defaultValue={firstName} className="input" />
      </div>
      <div>
        <label className="label" htmlFor={`${idPrefix}lastName`}>Nom</label>
        <input id={`${idPrefix}lastName`} name="lastName" required maxLength={40} defaultValue={lastName} className="input" />
      </div>
    </div>
  );
}
