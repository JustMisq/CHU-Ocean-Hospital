import type { FormField } from "@/lib/form-fields";

/** Champs d'un formulaire configurable (noms préfixés : « f- » demande, « a- » acceptation, « r- » réponse). */
export function DynamicFields({ fields, prefix = "f-" }: { fields: FormField[]; prefix?: string }) {
  if (!fields.length) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((f) => (
        <DynamicField key={f.name} field={f} prefix={prefix} />
      ))}
    </div>
  );
}

function DynamicField({ field: f, prefix }: { field: FormField; prefix: string }) {
  const id = `${prefix}${f.name}`;
  const wide = f.half ? "" : "sm:col-span-2";
  if (f.type === "checkbox") {
    return (
      <label className={`flex items-center gap-2 text-sm ${wide} ${f.half ? "sm:pt-7" : ""}`}>
        <input type="checkbox" name={id} className="size-4 accent-ocean-600" /> {f.label}
      </label>
    );
  }
  if (f.type === "multi") {
    return (
      <fieldset className={wide}>
        <legend className="label">{f.label}{f.required && " *"}</legend>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {f.options?.map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name={id} value={o} className="size-4 accent-ocean-600" /> {o}
            </label>
          ))}
        </div>
        {f.hint && <p className="mt-1 text-xs text-muted">{f.hint}</p>}
      </fieldset>
    );
  }
  const common = { id, name: id, required: f.required, className: "input" };
  return (
    <div className={wide}>
      <label className="label" htmlFor={id}>{f.label}{f.required && " *"}</label>
      {f.type === "textarea" ? (
        <textarea {...common} rows={3} maxLength={3000} />
      ) : f.type === "select" ? (
        <select {...common} defaultValue="">
          <option value="" disabled={f.required}>Choisir…</option>
          {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input {...common} type={f.type === "datetime" ? "datetime-local" : f.type === "number" ? "text" : f.type} inputMode={f.type === "number" ? "decimal" : undefined} maxLength={200} />
      )}
      {f.hint && <p className="mt-1 text-xs text-muted">{f.hint}</p>}
    </div>
  );
}

/** Réponses d'un formulaire, en liste libellé / valeur. */
export function ValuesList({ rows }: { rows: [string, string][] }) {
  if (!rows.length) return null;
  return (
    <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[minmax(0,14rem)_1fr]">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="font-medium text-muted">{label}</dt>
          <dd className="whitespace-pre-line">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
