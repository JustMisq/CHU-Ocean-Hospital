import Link from "next/link";
import { ChevronRight, Search, UserPlus } from "lucide-react";
import { prisma } from "@ocean/db";
import { createDossier } from "@/lib/actions/documents";
import { dossierSearch } from "@/lib/documents";
import { formatDate } from "@/lib/time";
import { DossierBadges } from "./dossier-badges";
import { ActionForm, SubmitButton } from "./forms";
import { MedicalFields, ObservationFields } from "./medical-fields";

/**
 * Choix du patient d'un assistant (document, demande) : recherche, derniers dossiers sans compte, ou création d'un dossier
 * sans compte (patient inconnu compris). `keep` : paramètres de l'assistant à conserver ; `next` : où revenir après création.
 */
export async function PatientPicker({ q, keep, hrefFor, next }: {
  q: string;
  keep: Record<string, string>;
  hrefFor: (patientId: string) => string;
  next: "document" | "demande";
}) {
  // Sans recherche : les derniers dossiers sans compte (souvent ceux qu'on vient de créer sur intervention).
  const results = await prisma.character.findMany({
    where: q ? dossierSearch(q) : { userId: null },
    orderBy: q ? [{ lastName: "asc" }, { firstName: "asc" }] : { createdAt: "desc" },
    take: q ? 20 : 8,
  });

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <form className="flex gap-2">
          {Object.entries(keep).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <input name="q" defaultValue={q} autoFocus placeholder="Prénom, nom ou n° patient (PAT-…)" className="input" />
          <button className="btn-primary shrink-0"><Search className="size-4" /> Rechercher</button>
        </form>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">{q ? "Résultats" : "Derniers dossiers sans compte"}</p>
        <ul className="mt-2 divide-y divide-line">
          {results.map((c) => (
            <li key={c.id}>
              <Link href={hrefFor(c.id)} className="flex items-center gap-3 py-3 hover:bg-ocean-50/50">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 font-medium">
                    {c.firstName} {c.lastName}
                    <DossierBadges dossier={c} />
                  </span>
                  <span className="block text-sm text-muted">
                    {[c.patientNumber, c.birthDate && `né(e) le ${formatDate(c.birthDate)}`].filter(Boolean).join(" · ") || "Infos non renseignées"}
                  </span>
                </span>
                <ChevronRight className="size-4 text-muted" />
              </Link>
            </li>
          ))}
          {results.length === 0 && <li className="py-4 text-sm text-muted">{q ? "Aucun dossier trouvé." : "Aucun dossier sans compte pour l'instant."}</li>}
        </ul>
      </section>

      <details className="card" open={Boolean(q) && results.length === 0}>
        <summary className="flex cursor-pointer items-center gap-2 p-5 font-semibold">
          <UserPlus className="size-5 text-ocean-600" /> Créer un dossier sans compte
        </summary>
        <ActionForm action={createDossier} className="space-y-4 border-t border-line p-5">
          <p className="text-sm text-muted">
            Pour quelqu&apos;un qui n&apos;a pas encore de compte sur le site. Tout est facultatif : on remplit ce qu&apos;on sait, le reste se
            complète plus tard depuis le dossier, qui pourra aussi être rattaché au compte du joueur.
          </p>
          <input type="hidden" name="next" value={next} />
          {Object.entries(keep).map(([k, v]) => <input key={k} type="hidden" name={`keep-${k}`} value={v} />)}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="firstName">Prénom</label>
              <input id="firstName" name="firstName" maxLength={40} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="lastName">Nom</label>
              <input id="lastName" name="lastName" maxLength={40} className="input" />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted">Identité inconnue ? Laissez vide : le dossier sera nommé « INCONNU X-0001 », « X-0002 »…</p>
          <ObservationFields />
          <MedicalFields />
          <SubmitButton pendingText="Création…">Créer le dossier et continuer</SubmitButton>
        </ActionForm>
      </details>
    </div>
  );
}
