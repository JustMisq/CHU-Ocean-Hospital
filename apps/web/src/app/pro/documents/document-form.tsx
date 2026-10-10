"use client";

import { useState } from "react";
import { Plus, Trash } from "lucide-react";
import type { DocumentKind } from "@ocean/db";
import { ActionForm, SubmitButton } from "@/components/forms";
import { createDocument } from "@/lib/actions/documents";
import { DOCUMENT_TYPES, type FieldDef } from "@/lib/document-types";

/** Exemples des lignes répétables, selon le type. */
const ITEM_HINTS = {
  medicaments: {
    legend: "Prescription",
    name: "Ex : CICALFATE+ crème réparatrice (Avène)",
    instructions: "Posologie : appliquer une noisette 2 fois par jour, matin et soir…",
    quantity: "Ex : QSP 3 mois",
    add: "Ajouter un médicament / soin",
  },
  examens: {
    legend: "Examens",
    name: "Ex : Radiographie du genou gauche, face + profil",
    instructions: "Indication / renseignements cliniques",
    quantity: "Ex : En urgence, à jeun…",
    add: "Ajouter un examen",
  },
};

let nextKey = 0;
const newRow = () => ({ key: nextKey++ });

function Field({ field }: { field: FieldDef }) {
  const id = `field-${field.name}`;
  if (field.type === "checkbox") {
    return (
      <label className={`flex items-center gap-2 text-sm ${field.half ? "" : "sm:col-span-2"} sm:pt-7`}>
        <input type="checkbox" name={field.name} className="size-4 accent-ocean-600" /> {field.label}
      </label>
    );
  }
  const common = { id, name: field.name, required: field.required, placeholder: field.placeholder, className: "input" };
  return (
    <div className={field.half ? "" : "sm:col-span-2"}>
      <label className="label" htmlFor={id}>{field.label}{field.required && " *"}</label>
      {field.type === "textarea" ? (
        <textarea {...common} rows={3} maxLength={2000} />
      ) : field.type === "select" ? (
        <select {...common} defaultValue="">
          <option value="" disabled>Choisir…</option>
          {field.options?.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      ) : (
        <input {...common} type={field.type === "datetime" ? "datetime-local" : field.type} maxLength={200} />
      )}
      {field.hint && <p className="mt-1 text-xs text-muted">{field.hint}</p>}
    </div>
  );
}

export function DocumentForm({ kind, characterId, appointmentId, services, defaultServiceId }: {
  kind: DocumentKind;
  characterId: string;
  appointmentId?: string;
  services: { id: string; name: string; code: string }[];
  defaultServiceId?: string;
}) {
  const type = DOCUMENT_TYPES[kind];
  const items = type.items ? ITEM_HINTS[type.items] : null;
  const [rows, setRows] = useState(() => [newRow()]);

  return (
    <ActionForm action={createDocument} className="space-y-5">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="characterId" value={characterId} />
      {appointmentId && <input type="hidden" name="appointmentId" value={appointmentId} />}

      <div>
        <label className="label" htmlFor="serviceId">Service (en-tête et numérotation)</label>
        <select id="serviceId" name="serviceId" defaultValue={defaultServiceId ?? services[0]?.id ?? ""} className="input sm:max-w-sm">
          <option value="">— Aucun —</option>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ""}</option>)}
        </select>
      </div>

      {type.fields && (
        <div className="grid gap-4 sm:grid-cols-2">
          {type.fields.map((f) => <Field key={f.name} field={f} />)}
        </div>
      )}

      {items && (
        <fieldset className="space-y-3">
          <legend className="label">{items.legend}</legend>
          {rows.map((row, i) => (
            <div key={row.key} className="space-y-2 rounded-xl border border-line p-3">
              <div className="flex gap-2">
                <input name="itemName" maxLength={150} required={i === 0} placeholder={items.name} className="input font-semibold" />
                {rows.length > 1 && (
                  <button type="button" onClick={() => setRows(rows.filter((r) => r.key !== row.key))} className="btn-secondary shrink-0" aria-label="Retirer la ligne">
                    <Trash className="size-4" />
                  </button>
                )}
              </div>
              <textarea name="itemInstructions" rows={2} maxLength={600} placeholder={items.instructions} className="input" />
              <input name="itemQuantity" maxLength={80} placeholder={items.quantity} className="input sm:max-w-xs" />
            </div>
          ))}
          {rows.length < 15 && (
            <button type="button" onClick={() => setRows([...rows, newRow()])} className="btn-secondary">
              <Plus className="size-4" /> {items.add}
            </button>
          )}
        </fieldset>
      )}

      <div>
        <label className="label" htmlFor="body">{type.body.label}{type.body.required && " *"}</label>
        <textarea
          id="body"
          name="body"
          rows={type.body.required ? 8 : 3}
          maxLength={3000}
          required={type.body.required}
          placeholder={type.body.placeholder}
          className="input"
        />
      </div>

      {(type.validity || type.renewable) && (
        <div className="flex flex-wrap items-end gap-4">
          {type.validity && (
            <div>
              <label className="label" htmlFor="validityMonths">Validité (mois)</label>
              <input id="validityMonths" name="validityMonths" type="number" min={1} max={12} defaultValue={3} className="input w-24" />
            </div>
          )}
          {type.renewable && (
            <label className="flex items-center gap-2 pb-2.5 text-sm">
              <input type="checkbox" name="renewable" className="size-4 accent-ocean-600" /> Renouvelable
            </label>
          )}
        </div>
      )}

      <p className="text-xs text-muted">
        Une fois émis, le document ne peut plus être modifié (seulement annulé). Il est rattaché au dossier du patient
        {kind === "DECES" && ", qui sera marqué décédé"}.
      </p>
      <SubmitButton pendingText="Génération…">Émettre le document</SubmitButton>
    </ActionForm>
  );
}
