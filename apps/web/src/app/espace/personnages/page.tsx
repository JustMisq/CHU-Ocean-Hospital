import type { Metadata } from "next";
import { Droplet, Phone, Trash } from "lucide-react";
import { prisma } from "@ocean/db";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/forms";
import { createCharacter, deleteCharacter } from "@/lib/actions/patient";
import { requireUser } from "@/lib/session";
import { formatDate } from "@/lib/time";

export const metadata: Metadata = { title: "Mes personnages" };

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default async function CharactersPage({ searchParams }: PageProps<"/espace/personnages">) {
  const user = await requireUser("/espace/personnages");
  const { retour } = await searchParams;
  const characters = await prisma.character.findMany({ where: { userId: user.id, archivedAt: null }, orderBy: { createdAt: "asc" } });

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
      <section className="space-y-3">
        {characters.map((c) => (
          <div key={c.id} className="card flex items-start gap-3 p-5">
            <div className="flex-1">
              <p className="font-semibold">{c.firstName} {c.lastName}</p>
              <p className="text-sm text-muted">Né(e) le {formatDate(c.birthDate)}</p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
                {c.phone && <span className="flex items-center gap-1"><Phone className="size-3.5" />{c.phone}</span>}
                {c.bloodType && <span className="flex items-center gap-1"><Droplet className="size-3.5" />{c.bloodType}</span>}
              </div>
              {c.allergies && <p className="mt-2 text-xs"><span className="font-semibold">Allergies :</span> {c.allergies}</p>}
            </div>
            <form action={deleteCharacter}>
              <input type="hidden" name="id" value={c.id} />
              <ConfirmButton message="Supprimer ce personnage ? Ses rendez-vous à venir seront annulés. Son dossier reste consultable par les soignants." className="rounded-full p-2 text-muted hover:bg-red-50 hover:text-red-700">
                <Trash className="size-4" />
              </ConfirmButton>
            </form>
          </div>
        ))}
        {characters.length === 0 && <p className="card p-8 text-center text-sm text-muted">Aucun personnage pour l&apos;instant.</p>}
      </section>

      <ActionForm action={createCharacter} className="card h-fit space-y-4 p-6" resetOnSuccess>
        <h2 className="font-bold">Nouveau personnage</h2>
        {typeof retour === "string" && <input type="hidden" name="retour" value={retour} />}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="firstName">Prénom</label>
            <input id="firstName" name="firstName" required maxLength={40} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="lastName">Nom</label>
            <input id="lastName" name="lastName" required maxLength={40} className="input" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="birthDate">Date de naissance</label>
            <input id="birthDate" name="birthDate" type="date" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="phone">Téléphone (en jeu)</label>
            <input id="phone" name="phone" maxLength={20} className="input" placeholder="555-0123" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="bloodType">Groupe sanguin</label>
          <select id="bloodType" name="bloodType" className="input">
            <option value="">Inconnu</option>
            {BLOOD_TYPES.map((b) => <option key={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="allergies">Allergies / antécédents</label>
          <textarea id="allergies" name="allergies" rows={2} maxLength={300} className="input" />
        </div>
        <SubmitButton className="btn-primary w-full">Ajouter</SubmitButton>
      </ActionForm>
    </div>
  );
}
