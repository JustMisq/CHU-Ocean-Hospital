import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ChevronRight, FileText, TriangleAlert } from "lucide-react";
import { prisma, type DocumentKind } from "@ocean/db";
import { PatientPicker } from "@/components/patient-picker";
import { isUnidentified, missingInfo } from "@/lib/characters";
import { DOCUMENT_TYPES } from "@/lib/document-types";
import { canHandleRequest } from "@/lib/requests";
import { requireStaff } from "@/lib/session";
import { DocumentForm } from "../document-form";
import { ImagingForm } from "../imaging-form";

export const metadata: Metadata = { title: "Nouveau document" };

const str = (v: unknown) => (typeof v === "string" ? v : "");

export default async function NewDocumentPage({ searchParams }: PageProps<"/pro/documents/nouveau">) {
  const user = await requireStaff();
  if (user.writableKinds.length === 0) redirect("/pro");
  const params = await searchParams;
  // Seuls les types que le grade permet de rédiger.
  const kind = user.writableKinds.find((k) => k === str(params.type)) ?? null;
  const patientId = str(params.patient);
  const rdv = str(params.rdv);
  const demande = str(params.demande);
  const q = str(params.q).trim();

  /** Lien vers l'assistant en gardant les choix déjà faits. */
  const href = (change: Record<string, string | null>) => {
    const next = new URLSearchParams();
    const current = { type: kind, patient: patientId || null, rdv: rdv || null, demande: demande || null, ...change };
    for (const [k, v] of Object.entries(current)) if (v) next.set(k, v);
    return `/pro/documents/nouveau?${next}`;
  };

  const patient = patientId ? await prisma.character.findUnique({ where: { id: patientId } }) : null;
  if (patientId && !patient) notFound();

  return (
    <div className={`${kind === "IMAGERIE" && patient ? "max-w-6xl" : "max-w-3xl"} space-y-6`}>
      <Link href="/pro/documents" className="text-sm font-medium text-ocean-600 hover:underline">← Documents</Link>
      <h1 className="text-2xl font-bold">Nouveau document</h1>

      <ol className="flex flex-wrap items-center gap-2 text-sm">
        <Step n={1} label={kind ? DOCUMENT_TYPES[kind].label : "Type de document"} done={Boolean(kind)} href={kind ? href({ type: null }) : undefined} />
        <ChevronRight className="size-4 text-muted" />
        <Step n={2} label={patient ? `${patient.firstName} ${patient.lastName}` : "Patient"} done={Boolean(patient)} href={patient ? href({ patient: null, rdv: null }) : undefined} />
        <ChevronRight className="size-4 text-muted" />
        <Step n={3} label="Rédaction" done={false} />
      </ol>

      {!kind ? (
        <TypePicker kinds={user.writableKinds} href={href} />
      ) : !patient ? (
        <PatientPicker q={q} keep={{ type: kind }} hrefFor={(id) => href({ patient: id })} next="document" />
      ) : (
        <Compose kind={kind} patient={patient} rdv={rdv} demande={demande} user={user} />
      )}
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

function TypePicker({ kinds, href }: { kinds: DocumentKind[]; href: (c: Record<string, string | null>) => string }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {kinds.map((k) => (
        <li key={k}>
          <Link href={href({ type: k })} className="card flex h-full items-start gap-3 p-4 hover:ring-2 hover:ring-ocean-200">
            <FileText className="mt-0.5 size-5 shrink-0 text-ocean-600" />
            <span>
              <span className="block font-semibold">{DOCUMENT_TYPES[k].label}</span>
              <span className="block text-sm text-muted">{DOCUMENT_TYPES[k].description}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function Compose({ kind, patient, rdv, demande, user }: {
  kind: DocumentKind;
  patient: NonNullable<Awaited<ReturnType<typeof prisma.character.findUnique>>>;
  rdv: string;
  demande: string;
  user: Awaited<ReturnType<typeof requireStaff>>;
}) {
  const [services, appointment] = await Promise.all([
    prisma.service.findMany({
      where: user.isAdmin ? {} : { staff: { some: { id: user.staff.id } } },
      orderBy: { order: "asc" },
      select: { id: true, name: true, code: true },
    }),
    rdv ? prisma.appointment.findFirst({ where: { id: rdv, characterId: patient.id }, select: { id: true, serviceId: true } }) : null,
  ]);
  // Rédigé en réponse à une demande : rattaché à elle (si on peut la traiter), en-tête du service destinataire.
  const request = demande
    ? await prisma.serviceRequest.findFirst({ where: { id: demande, characterId: patient.id, status: { in: ["PENDING", "ACCEPTED"] } }, select: { id: true, number: true, toServiceId: true, recipientId: true } })
    : null;
  const linked = request && (await canHandleRequest(user, request)) ? request : null;
  const defaultServiceId = services.find((s) => s.id === (linked?.toServiceId ?? appointment?.serviceId))?.id;
  const missing = [...missingInfo(patient), !patient.sex && !isUnidentified(patient) && "sexe"].filter(Boolean);

  return (
    <>
      {missing.length > 0 && (
        <p className="rounded-xl bg-canvas p-3 text-sm text-muted">
          Non renseigné : {missing.join(", ")} (n&apos;apparaîtra pas sur le document). Si vous le savez,{" "}
          <Link href={`/pro/patients/${patient.id}`} className="font-medium underline">complétez le dossier</Link>.
        </p>
      )}
      {patient.deceasedAt && kind !== "DECES" && <Warning>Ce patient est marqué décédé.</Warning>}
      {linked && <p className="rounded-xl bg-ocean-50 p-3 text-sm text-ocean-800">En réponse à la demande <Link href={`/pro/demandes/${linked.id}`} className="font-semibold underline">{linked.number}</Link> : le document y sera rattaché.</p>}
      {!user.staff.signatureUrl && (
        <Warning>
          Vous n&apos;avez pas encore de signature : le document n&apos;aura que le cachet.{" "}
          <Link href="/pro/profil" className="font-medium underline">Signer dans Mon profil</Link>.
        </Warning>
      )}
      <div className="card p-6">
        {DOCUMENT_TYPES[kind].custom === "imaging" ? (
          <ImagingForm
            characterId={patient.id}
            appointmentId={appointment?.id}
            services={services}
            defaultServiceId={defaultServiceId}
            requestId={linked?.id}
          />
        ) : (
          <DocumentForm
            kind={kind}
            characterId={patient.id}
            appointmentId={appointment?.id}
            services={services}
            defaultServiceId={defaultServiceId}
            requestId={linked?.id}
          />
        )}
      </div>
    </>
  );
}

function Warning({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
