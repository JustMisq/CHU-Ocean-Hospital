import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { prisma, type RequestType } from "@ocean/db";
import { ActionForm, SubmitButton } from "@/components/forms";
import { addPresetType, deleteRequestType, saveRequestType } from "@/lib/actions/requests";
import { DOCUMENT_KINDS, DOCUMENT_TYPES } from "@/lib/document-types";
import { parseFields } from "@/lib/form-fields";
import { presetsFor } from "@/lib/request-presets";
import { requireStaff } from "@/lib/session";
import { ConfigItem, DeleteButton } from "../../config/shared";
import { FieldsEditor } from "./fields-editor";

export const metadata: Metadata = { title: "Types de demandes" };

type TypeOption = { id: string; name: string; service: string };

export default async function RequestTypesPage({ searchParams }: PageProps<"/pro/demandes/types">) {
  const user = await requireStaff();
  const all = user.isAdmin || user.can("requests.configure") || user.can("settings.manage");
  const services = await prisma.service.findMany({
    where: all ? {} : { headId: user.staff.id },
    orderBy: { order: "asc" },
    include: { requestTypes: { orderBy: [{ order: "asc" }, { name: "asc" }] } },
  });
  if (!services.length) redirect("/pro/demandes");
  const { service: chosen } = await searchParams;
  const current = services.find((s) => s.id === chosen) ?? services[0];
  // Prérequis possibles : tous les types de l'hôpital (ex : consultation d'anesthésie avant une intervention).
  const allTypes: TypeOption[] = (await prisma.requestType.findMany({ include: { service: { select: { name: true } } }, orderBy: { name: "asc" } }))
    .map((t) => ({ id: t.id, name: t.name, service: t.service.name }));
  const presets = presetsFor(current).filter((p) => !current.requestTypes.some((t) => t.name === p.name));

  return (
    <div className="space-y-6">
      <Link href="/pro/demandes" className="text-sm font-medium text-ocean-600 hover:underline">← Demandes</Link>
      <div>
        <h1 className="text-2xl font-bold">Types de demandes</h1>
        <p className="mt-1 text-sm text-muted">
          Ce que chaque service accepte de recevoir, et comment : formulaire du demandeur, ce que le service remplit pour accepter
          et pour répondre, documents ou demandes obligatoires avant. Une « demande d&apos;avis » libre reste toujours possible.
        </p>
      </div>

      <nav className="flex flex-wrap gap-1.5">
        {services.map((s) => (
          <Link key={s.id} href={`/pro/demandes/types?service=${s.id}`} className={`rounded-full border px-3 py-1 text-sm ${s.id === current.id ? "border-ocean-500 bg-ocean-50 font-semibold text-ocean-700" : "border-line text-muted hover:bg-canvas"}`}>
            {s.name} <span className="text-xs">({s.requestTypes.length})</span>
          </Link>
        ))}
      </nav>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <ul className="space-y-2">
          {current.requestTypes.map((t) => (
            <li key={t.id}>
              <ConfigItem
                title={<>{t.name} {!t.active && <span className="text-xs font-normal text-muted">(désactivé)</span>}</>}
                subtitle={summary(t, allTypes)}
              >
                <TypeForm serviceId={current.id} type={t} allTypes={allTypes} />
                <div className="mt-4 border-t border-line pt-4">
                  <DeleteButton action={deleteRequestType} id={t.id} message={`Supprimer « ${t.name} » ? Les demandes déjà envoyées restent consultables.`} />
                </div>
              </ConfigItem>
            </li>
          ))}
          {current.requestTypes.length === 0 && (
            <li className="card p-6 text-sm text-muted">Aucun type configuré : ce service ne reçoit que des demandes d&apos;avis libres et des transferts.</li>
          )}
        </ul>

        <div className="space-y-4">
          {presets.length > 0 && (
            <section className="card p-5">
              <h2 className="font-bold">Modèles proposés</h2>
              <p className="mt-1 text-xs text-muted">Adaptés à « {current.name} ». Ajoutez-les puis modifiez-les à votre façon.</p>
              <ul className="mt-3 space-y-2">
                {presets.map((p) => (
                  <li key={p.name}>
                    <form action={addPresetType} className="flex items-start gap-2 rounded-xl border border-line p-3">
                      <input type="hidden" name="serviceId" value={current.id} />
                      <input type="hidden" name="preset" value={p.name} />
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="block font-semibold">{p.name}</span>
                        <span className="block text-xs text-muted">{p.description}</span>
                      </span>
                      <button className="btn-secondary shrink-0 px-2" aria-label={`Ajouter ${p.name}`}><Plus className="size-4" /></button>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="card p-5">
            <h2 className="mb-4 font-bold">Nouveau type de demande</h2>
            <TypeForm serviceId={current.id} allTypes={allTypes} />
          </section>
        </div>
      </div>
    </div>
  );
}

function summary(t: RequestType, allTypes: TypeOption[]) {
  const docs = t.requiredDocuments.split(",").filter(Boolean).map((k) => DOCUMENT_TYPES[k as keyof typeof DOCUMENT_TYPES]?.label).filter(Boolean);
  const prereq = t.requiredTypes.split(",").filter(Boolean).map((id) => allTypes.find((x) => x.id === id)?.name).filter(Boolean);
  return [
    `${parseFields(t.fields).length} champ(s)`,
    parseFields(t.acceptFields).length > 0 && "formulaire pour accepter",
    t.responseDocument && `répond par : ${DOCUMENT_TYPES[t.responseDocument].label}`,
    docs.length > 0 && `exige : ${docs.join(", ")}`,
    prereq.length > 0 && `après : ${prereq.join(", ")}`,
  ].filter(Boolean).join(" · ");
}

function TypeForm({ serviceId, type, allTypes }: { serviceId: string; type?: RequestType; allTypes: TypeOption[] }) {
  const requiredDocs = type?.requiredDocuments.split(",") ?? [];
  const requiredTypes = type?.requiredTypes.split(",") ?? [];
  return (
    <ActionForm action={saveRequestType} className="space-y-5" resetOnSuccess={!type}>
      {type && <input type="hidden" name="id" value={type.id} />}
      <input type="hidden" name="serviceId" value={serviceId} />
      <div className="grid gap-3 sm:grid-cols-[1fr_6rem]">
        <div>
          <label className="label">Nom</label>
          <input name="name" required maxLength={80} defaultValue={type?.name} placeholder="Ex : Analyse de biologie" className="input" />
        </div>
        <div>
          <label className="label">Ordre</label>
          <input name="order" type="number" defaultValue={type?.order ?? 0} className="input" />
        </div>
      </div>
      <div>
        <label className="label">Description (vue par le demandeur)</label>
        <input name="description" maxLength={300} defaultValue={type?.description} className="input" />
      </div>

      <Section title="1. Formulaire du demandeur" hint="Ce que le soignant qui envoie la demande doit remplir.">
        <FieldsEditor name="fields" initial={type ? parseFields(type.fields) : []} empty="Aucun champ : seul le message libre." />
      </Section>
      <Section title="2. Pour accepter" hint="Ce que votre service remplit pour accepter (réquisition, date prévue…). Vide : un clic suffit.">
        <FieldsEditor name="acceptFields" initial={type ? parseFields(type.acceptFields) : []} empty="Acceptation en un clic." />
      </Section>
      <Section title="3. Pour répondre" hint="Ce que votre service remplit en clôturant la demande (résultats, avis…).">
        <FieldsEditor name="responseFields" initial={type ? parseFields(type.responseFields) : []} empty="Réponse en texte libre." />
        <div className="mt-3">
          <label className="label">Document à rédiger en réponse</label>
          <select name="responseDocument" defaultValue={type?.responseDocument ?? ""} className="input sm:max-w-sm">
            <option value="">— Aucun —</option>
            {DOCUMENT_KINDS.map((k) => <option key={k} value={k}>{DOCUMENT_TYPES[k].label}</option>)}
          </select>
          <p className="mt-1 text-xs text-muted">S&apos;il est choisi, la demande ne se clôture qu&apos;une fois ce document rédigé depuis elle.</p>
        </div>
      </Section>
      <Section title="Avant d'envoyer" hint="Ce que le patient doit déjà avoir, sinon la demande est bloquée.">
        <p className="label">Documents obligatoires</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {DOCUMENT_KINDS.map((k) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="requiredDocuments" value={k} defaultChecked={requiredDocs.includes(k)} className="size-4 accent-ocean-600" /> {DOCUMENT_TYPES[k].label}
            </label>
          ))}
        </div>
        {allTypes.filter((t) => t.id !== type?.id).length > 0 && (
          <>
            <p className="label mt-3">Demandes déjà traitées pour ce patient</p>
            <div className="grid max-h-48 gap-1.5 overflow-y-auto sm:grid-cols-2">
              {allTypes.filter((t) => t.id !== type?.id).map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="requiredTypes" value={t.id} defaultChecked={requiredTypes.includes(t.id)} className="size-4 accent-ocean-600" />
                  <span>{t.name} <span className="text-xs text-muted">({t.service})</span></span>
                </label>
              ))}
            </div>
          </>
        )}
      </Section>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={type?.active ?? true} className="size-4 accent-ocean-600" /> Proposé aux demandeurs
      </label>
      <SubmitButton>{type ? "Enregistrer" : "Créer le type"}</SubmitButton>
    </ActionForm>
  );
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-2 rounded-xl bg-canvas p-4">
      <legend className="sr-only">{title}</legend>
      <p className="font-semibold">{title}</p>
      <p className="text-xs text-muted">{hint}</p>
      {children}
    </fieldset>
  );
}
