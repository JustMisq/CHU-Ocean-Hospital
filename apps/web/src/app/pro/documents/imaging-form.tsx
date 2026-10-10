"use client";

import { ActionForm, SubmitButton } from "@/components/forms";
import { ImagingEditor } from "@/components/imaging/imaging-editor";
import { createDocument } from "@/lib/actions/documents";

/** Formulaire du compte rendu d'imagerie : l'éditeur écrit ses données dans le champ caché `imaging`. */
export function ImagingForm({ characterId, appointmentId, requestId, services, defaultServiceId }: {
  characterId: string;
  appointmentId?: string;
  /** Demande à laquelle le document répond (rattaché à elle à l'émission). */
  requestId?: string;
  services: { id: string; name: string; code: string }[];
  defaultServiceId?: string;
}) {
  return (
    <ActionForm action={createDocument} className="space-y-6">
      <input type="hidden" name="kind" value="IMAGERIE" />
      <input type="hidden" name="characterId" value={characterId} />
      {appointmentId && <input type="hidden" name="appointmentId" value={appointmentId} />}
      {requestId && <input type="hidden" name="requestId" value={requestId} />}
      <div>
        <label className="label" htmlFor="serviceId">Service (en-tête et numérotation)</label>
        <select id="serviceId" name="serviceId" defaultValue={defaultServiceId ?? services[0]?.id ?? ""} className="input sm:max-w-sm">
          <option value="">— Aucun —</option>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ""}</option>)}
        </select>
      </div>
      <ImagingEditor />
      <p className="text-xs text-muted">Une fois émis, le compte rendu ne peut plus être modifié (seulement annulé). Il est rattaché au dossier du patient.</p>
      <SubmitButton pendingText="Génération…">Émettre le compte rendu</SubmitButton>
    </ActionForm>
  );
}
