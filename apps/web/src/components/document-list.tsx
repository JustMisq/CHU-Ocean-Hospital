import Link from "next/link";
import { Download, FileText } from "lucide-react";
import type { MedicalDocument } from "@ocean/db";
import { ConfirmButton } from "@/components/forms";
import { revokeDocument } from "@/lib/actions/documents";
import { kindLabel, type DocumentSnapshot } from "@/lib/document-types";
import { formatDate } from "@/lib/time";

/**
 * Documents d'un ou plusieurs dossiers, avec ouverture / téléchargement du PDF.
 * `showPatient` : affiche le patient et un lien vers son dossier (zone Documents). `canRevoke` : bouton d'annulation.
 */
export function DocumentList({ documents, canRevoke, highlightId, showPatient = false, empty = "Aucun document pour l'instant." }: {
  documents: MedicalDocument[];
  canRevoke?: (d: MedicalDocument) => boolean;
  highlightId?: string;
  showPatient?: boolean;
  empty?: string;
}) {
  if (documents.length === 0) return <p className="card p-6 text-center text-sm text-muted">{empty}</p>;
  return (
    <ul className="space-y-2">
      {documents.map((d) => {
        const snap = d.snapshot as DocumentSnapshot;
        const url = `/api/documents/${d.id}`;
        return (
          <li key={d.id} className={`card p-4 text-sm ${d.id === highlightId ? "ring-2 ring-emerald-400" : ""}`}>
            <div className="flex flex-wrap items-start gap-3">
              <FileText className="mt-0.5 size-5 shrink-0 text-ocean-600" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {kindLabel(d.kind)} · {d.number}
                  {d.revokedAt && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">Annulé</span>}
                </p>
                <p className="text-muted">
                  {showPatient && (
                    <>
                      <Link href={`/pro/patients/${d.characterId}`} className="font-medium text-ink hover:underline">
                        {snap.patient.firstName} {snap.patient.lastName}
                      </Link>
                      {" · "}
                    </>
                  )}
                  {formatDate(d.createdAt)} · {snap.prescriber.name}{snap.service && ` · ${snap.service.name}`}
                </p>
                {d.revokedReason && <p className="mt-1 text-xs text-muted">Motif d&apos;annulation : {d.revokedReason}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={url} target="_blank" rel="noopener" className="btn-secondary">Voir</a>
                <a href={`${url}?dl=1`} className="btn-primary"><Download className="size-4" /> PDF</a>
                <a href={`${url}?format=png&dl=1`} className="btn-secondary" title="Image (à coller en jeu, sur un forum…)"><Download className="size-4" /> PNG</a>
              </div>
            </div>
            {!d.revokedAt && canRevoke?.(d) && (
              <form action={revokeDocument} className="mt-3 flex gap-2 border-t border-line pt-3">
                <input type="hidden" name="id" value={d.id} />
                <input name="reason" maxLength={300} placeholder="Motif d'annulation (erreur, remplacement…)" className="input" />
                <ConfirmButton message="Annuler ce document ? Il restera dans le dossier, barré « ANNULÉE ».">Annuler</ConfirmButton>
              </form>
            )}
          </li>
        );
      })}
    </ul>
  );
}
