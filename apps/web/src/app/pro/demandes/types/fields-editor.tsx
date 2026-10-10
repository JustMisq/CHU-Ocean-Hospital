"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash } from "lucide-react";
import { FIELD_TYPES, type FieldType, type FormField } from "@/lib/form-fields";

type Row = FormField & { key: number; optionsText: string };
let nextKey = 0;
const toRow = (f: FormField): Row => ({ ...f, key: nextKey++, optionsText: (f.options ?? []).join("\n") });

/**
 * Éditeur d'un formulaire configurable : une ligne par champ (libellé, type, obligatoire, demi-largeur, choix).
 * Le résultat part en JSON dans un champ caché `name` ; le serveur le revalide (parseFields).
 */
export function FieldsEditor({ name, initial, empty }: { name: string; initial: FormField[]; empty: string }) {
  const [rows, setRows] = useState<Row[]>(() => initial.map(toRow));
  const update = (key: number, change: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...change } : r)));
  const move = (i: number, d: -1 | 1) =>
    setRows((rs) => {
      const next = [...rs];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });
  const value = JSON.stringify(
    rows.map((r) => ({
      name: r.name,
      label: r.label,
      type: r.type,
      required: r.required,
      half: r.half,
      hint: r.hint,
      options: r.optionsText.split("\n").map((o) => o.trim()).filter(Boolean),
    })),
  );

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={value} />
      {rows.length === 0 && <p className="text-sm text-muted">{empty}</p>}
      {rows.map((r, i) => (
        <div key={r.key} className="space-y-2 rounded-xl border border-line p-3">
          <div className="flex flex-wrap gap-2">
            <input value={r.label} onChange={(e) => update(r.key, { label: e.target.value })} maxLength={80} placeholder="Libellé du champ" className="input min-w-0 flex-1" />
            <select value={r.type} onChange={(e) => update(r.key, { type: e.target.value as FieldType })} className="input w-auto">
              {Object.entries(FIELD_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <div className="flex gap-1">
              <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="btn-secondary px-2" aria-label="Monter"><ArrowUp className="size-4" /></button>
              <button type="button" disabled={i === rows.length - 1} onClick={() => move(i, 1)} className="btn-secondary px-2" aria-label="Descendre"><ArrowDown className="size-4" /></button>
              <button type="button" onClick={() => setRows(rows.filter((x) => x.key !== r.key))} className="btn-secondary px-2" aria-label="Retirer"><Trash className="size-4" /></button>
            </div>
          </div>
          {(r.type === "select" || r.type === "multi") && (
            <textarea value={r.optionsText} onChange={(e) => update(r.key, { optionsText: e.target.value })} rows={3} placeholder="Un choix par ligne" className="input" />
          )}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            {r.type !== "checkbox" && (
              <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(r.required)} onChange={(e) => update(r.key, { required: e.target.checked })} className="size-4 accent-ocean-600" /> Obligatoire</label>
            )}
            <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(r.half)} onChange={(e) => update(r.key, { half: e.target.checked })} className="size-4 accent-ocean-600" /> Demi-largeur</label>
            <input value={r.hint ?? ""} onChange={(e) => update(r.key, { hint: e.target.value })} maxLength={160} placeholder="Aide (facultatif)" className="input min-w-0 flex-1 py-1 text-xs" />
          </div>
        </div>
      ))}
      <button type="button" onClick={() => setRows([...rows, toRow({ name: "", label: "", type: "text" })])} className="btn-secondary">
        <Plus className="size-4" /> Ajouter un champ
      </button>
    </div>
  );
}
