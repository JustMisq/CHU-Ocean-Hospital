"use client";

import { useState } from "react";
import { Plus, Trash } from "lucide-react";
import type { PrescriptionKind } from "@ocean/db";
import { ActionForm, SubmitButton } from "@/components/forms";
import { createPrescription } from "@/lib/actions/prescriptions";
import { KIND_LABELS } from "@/lib/prescription-types";

/** Libellés et exemples adaptés au type de document. */
const KIND_FIELDS: Record<Exclude<PrescriptionKind, "CERTIFICAT">, { name: string; instructions: string; quantity: string; add: string }> = {
  ORDONNANCE: {
    name: "Ex : CICALFATE+ crème réparatrice (Avène)",
    instructions: "Posologie : appliquer une noisette 2 fois par jour, matin et soir…",
    quantity: "Ex : QSP 3 mois",
    add: "Ajouter un médicament / soin",
  },
  EXAMENS: {
    name: "Ex : Radiographie du genou gauche, face + profil",
    instructions: "Indication / renseignements cliniques",
    quantity: "Ex : En urgence, à jeun…",
    add: "Ajouter un examen",
  },
};

let nextKey = 0;
const newRow = () => ({ key: nextKey++ });

export function PrescriptionForm({ characterId, appointmentId, services, defaultServiceId }: {
  characterId: string;
  appointmentId?: string;
  services: { id: string; name: string; code: string }[];
  defaultServiceId?: string;
}) {
  const [kind, setKind] = useState<PrescriptionKind>("ORDONNANCE");
  const [rows, setRows] = useState(() => [newRow()]);
  const fields = kind === "CERTIFICAT" ? null : KIND_FIELDS[kind];

  return (
    <ActionForm action={createPrescription} className="space-y-5">
      <input type="hidden" name="characterId" value={characterId} />
      {appointmentId && <input type="hidden" name="appointmentId" value={appointmentId} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="kind">Document</label>
          <select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as PrescriptionKind)} className="input">
            {Object.entries(KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="serviceId">Service (en-tête et numérotation)</label>
          <select id="serviceId" name="serviceId" defaultValue={defaultServiceId ?? services[0]?.id ?? ""} className="input">
            <option value="">— Aucun —</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ""}</option>)}
          </select>
        </div>
      </div>

      {fields && (
        <fieldset className="space-y-3">
          <legend className="label">{kind === "EXAMENS" ? "Examens" : "Prescription"}</legend>
          {rows.map((row, i) => (
            <div key={row.key} className="space-y-2 rounded-xl border border-line p-3">
              <div className="flex gap-2">
                <input name="itemName" maxLength={150} required={i === 0} placeholder={fields.name} className="input font-semibold" />
                {rows.length > 1 && (
                  <button type="button" onClick={() => setRows(rows.filter((r) => r.key !== row.key))} className="btn-secondary shrink-0" aria-label="Retirer la ligne">
                    <Trash className="size-4" />
                  </button>
                )}
              </div>
              <textarea name="itemInstructions" rows={2} maxLength={600} placeholder={fields.instructions} className="input" />
              <input name="itemQuantity" maxLength={80} placeholder={fields.quantity} className="input sm:max-w-xs" />
            </div>
          ))}
          {rows.length < 15 && (
            <button type="button" onClick={() => setRows([...rows, newRow()])} className="btn-secondary">
              <Plus className="size-4" /> {fields.add}
            </button>
          )}
        </fieldset>
      )}

      <div>
        <label className="label" htmlFor="body">{kind === "CERTIFICAT" ? "Contenu du certificat" : "Remarques (facultatif)"}</label>
        <textarea
          id="body"
          name="body"
          rows={kind === "CERTIFICAT" ? 8 : 3}
          maxLength={3000}
          required={kind === "CERTIFICAT"}
          placeholder={kind === "CERTIFICAT" ? "Je soussigné(e), certifie avoir examiné ce jour…" : ""}
          className="input"
        />
      </div>

      {kind !== "CERTIFICAT" && (
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="label" htmlFor="validityMonths">Validité (mois)</label>
            <input id="validityMonths" name="validityMonths" type="number" min={1} max={12} defaultValue={3} className="input w-24" />
          </div>
          <label className="flex items-center gap-2 pb-2.5 text-sm">
            <input type="checkbox" name="renewable" className="size-4 accent-ocean-600" /> Renouvelable
          </label>
        </div>
      )}

      <p className="text-xs text-muted">
        Une fois émis, le document ne peut plus être modifié (seulement annulé). Il est rattaché au dossier du patient, qui peut aussi le télécharger.
      </p>
      <SubmitButton pendingText="Génération…">Émettre le document</SubmitButton>
    </ActionForm>
  );
}
