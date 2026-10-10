import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowRightLeft, ChevronRight, Inbox, TriangleAlert } from "lucide-react";
import { DOCUMENT_KINDS, prisma, type DocumentKind } from "@ocean/db";
import { DynamicFields } from "@/components/dynamic-fields";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PatientPicker } from "@/components/patient-picker";
import { ServiceIcon } from "@/components/service-icon";
import { createRequest } from "@/lib/actions/requests";
import { DOCUMENT_TYPES } from "@/lib/document-types";
import { parseFields } from "@/lib/form-fields";
import { GENERIC_REQUEST, PRIORITY_LABELS, TRANSFER } from "@/lib/request-labels";
import { currentServiceOf, myServiceIds } from "@/lib/requests";
import { requireStaff } from "@/lib/session";

export const metadata: Metadata = { title: "Nouvelle demande" };

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Assistant : patient → service (et type de demande, ou transfert) → formulaire. */
export default async function NewRequestPage({ searchParams }: PageProps<"/pro/demandes/nouvelle">) {
  const user = await requireStaff();
  const params = await searchParams;
  const kind = str(params.kind) === "TRANSFERT" ? "TRANSFERT" : "DEMANDE";
  const patientId = str(params.patient);
  const serviceId = str(params.service);
  // « generique » = demande d'avis libre ; sinon id d'un type configuré.
  const typeId = str(params.type);
  const q = str(params.q).trim();

  const href = (change: Record<string, string | null>) => {
    const next = new URLSearchParams();
    const current = { kind, patient: patientId || null, service: serviceId || null, type: typeId || null, ...change };
    for (const [k, v] of Object.entries(current)) if (v) next.set(k, v);
    return `/pro/demandes/nouvelle?${next}`;
  };

  const [patient, service] = await Promise.all([
    patientId ? prisma.character.findUnique({ where: { id: patientId } }) : null,
    serviceId ? prisma.service.findUnique({ where: { id: serviceId }, include: { requestTypes: { where: { active: true }, orderBy: [{ order: "asc" }, { name: "asc" }] } } }) : null,
  ]);
  if ((patientId && !patient) || (serviceId && !service)) notFound();
  const type = service && typeId && typeId !== "generique" ? service.requestTypes.find((t) => t.id === typeId) ?? null : null;
  const ready = Boolean(patient && service && (kind === "TRANSFERT" || typeId === "generique" || type));

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/pro/demandes" className="text-sm font-medium text-ocean-600 hover:underline">← Demandes</Link>
      <h1 className="text-2xl font-bold">{kind === "TRANSFERT" ? "Transférer un patient" : "Nouvelle demande"}</h1>

      <div className="flex rounded-full border border-line bg-white p-1 text-sm font-medium sm:w-fit">
        <Link href={href({ kind: "DEMANDE", type: null })} className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1 ${kind === "DEMANDE" ? "bg-ocean-600 text-white" : "text-muted"}`}>
          <Inbox className="size-4" /> Demande à un service
        </Link>
        <Link href={href({ kind: "TRANSFERT", type: null })} className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1 ${kind === "TRANSFERT" ? "bg-ocean-600 text-white" : "text-muted"}`}>
          <ArrowRightLeft className="size-4" /> Transfert de patient
        </Link>
      </div>

      <ol className="flex flex-wrap items-center gap-2 text-sm">
        <Step n={1} label={patient ? `${patient.firstName} ${patient.lastName}` : "Patient"} done={Boolean(patient)} href={patient ? href({ patient: null }) : undefined} />
        <ChevronRight className="size-4 text-muted" />
        <Step n={2} label={service ? `${service.name}${kind === "DEMANDE" && (type || typeId === "generique") ? ` · ${type?.name ?? GENERIC_REQUEST.name}` : ""}` : "Service"} done={Boolean(service && (kind === "TRANSFERT" || type || typeId))} href={service ? href({ service: null, type: null }) : undefined} />
        <ChevronRight className="size-4 text-muted" />
        <Step n={3} label="Formulaire" done={false} />
      </ol>

      {!patient ? (
        <PatientPicker q={q} keep={Object.fromEntries(Object.entries({ kind, service: serviceId, type: typeId }).filter(([, v]) => v))} hrefFor={(id) => href({ patient: id })} next="demande" />
      ) : !service ? (
        <ServicePicker kind={kind} href={href} characterId={patient.id} />
      ) : kind === "DEMANDE" && !type && typeId !== "generique" ? (
        <TypePicker service={service} href={href} />
      ) : ready ? (
        <Compose
          kind={kind}
          patient={patient}
          service={service}
          type={type}
          userStaffId={user.staff.id}
          isAdmin={user.isAdmin}
        />
      ) : null}
    </div>
  );
}

function Step({ n, label, done, href }: { n: number; label: string; done: boolean; href?: string }) {
  const content = (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-medium ${done ? "bg-ocean-50 text-ocean-700" : "bg-canvas text-muted"}`}>
      <span className="text-xs">{n}</span> {label}
    </span>
  );
  return <li>{href ? <Link href={href} title="Modifier">{content}</Link> : content}</li>;
}

async function ServicePicker({ kind, href, characterId }: { kind: string; href: (c: Record<string, string | null>) => string; characterId: string }) {
  const [services, current] = await Promise.all([
    prisma.service.findMany({
      orderBy: { order: "asc" },
      select: { id: true, name: true, icon: true, _count: { select: { requestTypes: { where: { active: true } }, staff: true } } },
    }),
    currentServiceOf(characterId),
  ]);
  return (
    <div className="space-y-3">
      {current && kind === "TRANSFERT" && <p className="rounded-xl bg-canvas p-3 text-sm text-muted">Le patient est actuellement en <strong>{current.name}</strong>.</p>}
      <ul className="grid gap-2 sm:grid-cols-2">
        {services.map((s) => (
          <li key={s.id}>
            <Link href={href({ service: s.id, type: null })} className="card flex h-full items-center gap-3 p-4 hover:ring-2 hover:ring-ocean-200">
              <ServiceIcon name={s.icon} className="size-5 shrink-0 text-ocean-600" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{s.name}</span>
                <span className="block text-xs text-muted">
                  {s._count.staff === 0 ? "Aucun membre : personne ne sera prévenu" : kind === "DEMANDE" && s._count.requestTypes > 0 ? `${s._count.requestTypes} type(s) de demande` : `${s._count.staff} membre(s)`}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TypePicker({ service, href }: {
  service: { name: string; requestTypes: { id: string; name: string; description: string; requiredDocuments: string }[] };
  href: (c: Record<string, string | null>) => string;
}) {
  const options = [...service.requestTypes, { id: "generique", name: GENERIC_REQUEST.name, description: "Question libre au service, sans formulaire particulier.", requiredDocuments: "" }];
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {options.map((t) => (
        <li key={t.id}>
          <Link href={href({ type: t.id })} className="card flex h-full items-start gap-3 p-4 hover:ring-2 hover:ring-ocean-200">
            <Inbox className="mt-0.5 size-5 shrink-0 text-ocean-600" />
            <span>
              <span className="block font-semibold">{t.name}</span>
              <span className="block text-sm text-muted">{t.description}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function Compose({ kind, patient, service, type, userStaffId, isAdmin }: {
  kind: "DEMANDE" | "TRANSFERT";
  patient: { id: string; firstName: string; lastName: string; deceasedAt: Date | null };
  service: { id: string; name: string };
  type: { id: string; name: string; description: string; fields: unknown; requiredDocuments: string; requiredTypes: string } | null;
  userStaffId: string;
  isAdmin: boolean;
}) {
  const fields = kind === "TRANSFERT" ? TRANSFER.fields : type ? parseFields(type.fields) : GENERIC_REQUEST.fields;
  const mine = await myServiceIds(userStaffId);
  const [fromServices, members, missingDocs, missingTypes] = await Promise.all([
    prisma.service.findMany({ where: isAdmin ? {} : { id: { in: mine } }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
    prisma.staffProfile.findMany({
      where: { gradeId: { not: null }, OR: [{ services: { some: { id: service.id } } }, { headOf: { some: { id: service.id } } }] },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true },
    }),
    // Prérequis non remplis (la demande serait refusée à l'envoi) : affichés avant de remplir le formulaire.
    type ? missingDocuments(patient.id, type.requiredDocuments) : [],
    type ? missingRequests(patient.id, type.requiredTypes) : [],
  ]);
  const blocked = missingDocs.length > 0 || missingTypes.length > 0;

  return (
    <div className="space-y-4">
      {kind === "TRANSFERT" && patient.deceasedAt && <Warning>Ce patient est déclaré décédé.</Warning>}
      {blocked && (
        <Warning>
          Impossible d&apos;envoyer pour l&apos;instant. Il faut d&apos;abord
          {missingDocs.map((k) => (
            <span key={k}> · <Link href={`/pro/documents/nouveau?type=${k}&patient=${patient.id}`} className="font-medium underline">{DOCUMENT_TYPES[k].label}</Link></span>
          ))}
          {missingTypes.map((t) => (
            <span key={t.id}> · <Link href={`/pro/demandes/nouvelle?patient=${patient.id}&service=${t.serviceId}&type=${t.id}`} className="font-medium underline">{t.name}</Link> ({t.service.name}, traitée)</span>
          ))}
        </Warning>
      )}
      {members.length === 0 && <Warning>Le service {service.name} n&apos;a aucun membre : personne ne sera prévenu de cette demande.</Warning>}
      {type?.description && <p className="text-sm text-muted">{type.description}</p>}

      <ActionForm action={createRequest} className="card space-y-5 p-6">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="characterId" value={patient.id} />
        <input type="hidden" name="toServiceId" value={service.id} />
        {type && <input type="hidden" name="typeId" value={type.id} />}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="fromServiceId">De la part de</label>
            <select id="fromServiceId" name="fromServiceId" defaultValue={fromServices[0]?.id ?? ""} className="input">
              <option value="">— Moi seulement —</option>
              {fromServices.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="recipientId">Destinataire</label>
            <select id="recipientId" name="recipientId" defaultValue="" className="input">
              <option value="">Tout le service {service.name}</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.displayName}</option>)}
            </select>
          </div>
        </div>

        <fieldset>
          <legend className="label">Priorité</legend>
          <div className="flex flex-wrap gap-4 text-sm">
            {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
              <label key={v} className="flex items-center gap-2">
                <input type="radio" name="priority" value={v} defaultChecked={v === "NORMAL"} className="accent-ocean-600" /> {l}
              </label>
            ))}
          </div>
        </fieldset>

        <DynamicFields fields={fields} />

        <div>
          <label className="label" htmlFor="message">Message au service (facultatif)</label>
          <textarea id="message" name="message" rows={3} maxLength={2000} className="input" />
        </div>
        <p className="text-xs text-muted">Le service est prévenu sur le site (notification) ; il accepte, refuse ou vous répond depuis la demande, où vous pouvez échanger.</p>
        <SubmitButton pendingText="Envoi…">{kind === "TRANSFERT" ? `Transférer vers ${service.name}` : "Envoyer la demande"}</SubmitButton>
      </ActionForm>
    </div>
  );
}

async function missingDocuments(characterId: string, required: string) {
  const kinds = required.split(",").filter((k): k is DocumentKind => DOCUMENT_KINDS.includes(k as DocumentKind));
  const out: DocumentKind[] = [];
  for (const kind of kinds) if (!(await prisma.medicalDocument.count({ where: { characterId, kind, revokedAt: null } }))) out.push(kind);
  return out;
}

async function missingRequests(characterId: string, required: string) {
  const ids = required.split(",").filter(Boolean);
  if (!ids.length) return [];
  const types = await prisma.requestType.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, serviceId: true, service: { select: { name: true } } } });
  const out: typeof types = [];
  for (const t of types) if (!(await prisma.serviceRequest.count({ where: { characterId, typeId: t.id, status: "COMPLETED" } }))) out.push(t);
  return out;
}

function Warning({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
