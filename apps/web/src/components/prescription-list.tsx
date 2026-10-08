import { Download, FileText } from "lucide-react";
import type { Prescription } from "@ocean/db";
import { ConfirmButton } from "@/components/forms";
import { revokePrescription } from "@/lib/actions/prescriptions";
import { KIND_LABELS, type PrescriptionSnapshot } from "@/lib/prescription-types";
import { formatDate } from "@/lib/time";

/** Ordonnances d'un dossier, avec ouverture / téléchargement du PDF (et annulation si `canRevoke`). */
export function PrescriptionList({ prescriptions, canRevoke, highlightId }: {
  prescriptions: Prescription[];
  canRevoke?: (p: Prescription) => boolean;
  highlightId?: string;
}) {
  if (prescriptions.length === 0) return <p className="card p-6 text-center text-sm text-muted">Aucune ordonnance pour l&apos;instant.</p>;
  return (
    <ul className="space-y-2">
      {prescriptions.map((p) => {
        const snap = p.snapshot as PrescriptionSnapshot;
        const url = `/api/ordonnances/${p.id}`;
        return (
          <li key={p.id} className={`card p-4 text-sm ${p.id === highlightId ? "ring-2 ring-emerald-400" : ""}`}>
            <div className="flex flex-wrap items-start gap-3">
              <FileText className="mt-0.5 size-5 shrink-0 text-ocean-600" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {KIND_LABELS[p.kind]} · {p.number}
                  {p.revokedAt && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">Annulée</span>}
                </p>
                <p className="text-muted">
                  {formatDate(p.createdAt)} · {snap.prescriber.name}{snap.service && ` · ${snap.service.name}`}
                </p>
                {p.revokedReason && <p className="mt-1 text-xs text-muted">Motif d&apos;annulation : {p.revokedReason}</p>}
              </div>
              <div className="flex gap-2">
                <a href={url} target="_blank" rel="noopener" className="btn-secondary">Voir</a>
                <a href={`${url}?dl=1`} className="btn-primary"><Download className="size-4" /> PDF</a>
              </div>
            </div>
            {!p.revokedAt && canRevoke?.(p) && (
              <form action={revokePrescription} className="mt-3 flex gap-2 border-t border-line pt-3">
                <input type="hidden" name="id" value={p.id} />
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
