import { isUnidentified } from "@/lib/characters";
import { formatDate } from "@/lib/time";

/** Pastilles d'état d'un dossier patient : non identifié, sans compte, décédé, archivé. */
export function DossierBadges({ dossier }: { dossier: { lastName: string; userId: string | null; deceasedAt: Date | null; archivedAt: Date | null } }) {
  return (
    <>
      {isUnidentified(dossier) && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">Non identifié</span>}
      {!dossier.userId &&<span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">Sans compte</span>}
      {dossier.deceasedAt && (
        <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs font-medium text-white">Décédé(e) le {formatDate(dossier.deceasedAt)}</span>
      )}
      {dossier.archivedAt && <span className="rounded-full bg-canvas px-2 py-0.5 text-xs font-medium text-muted">Archivé</span>}
    </>
  );
}
