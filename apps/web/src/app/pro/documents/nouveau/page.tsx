import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ChevronRight, FileText, Search, TriangleAlert, UserPlus } from "lucide-react";
import { prisma, type DocumentKind } from "@ocean/db";
import { DossierBadges } from "@/components/dossier-badges";
import { ActionForm, SubmitButton } from "@/components/forms";
import { MedicalFields, ObservationFields } from "@/components/medical-fields";
import { createDossier } from "@/lib/actions/documents";
import { isUnidentified, missingInfo } from "@/lib/characters";
import { DOCUMENT_TYPES } from "@/lib/document-types";
import { dossierSearch } from "@/lib/documents";
import { requireStaff } from "@/lib/session";
import { formatDate } from "@/lib/time";
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
  const q = str(params.q).trim();

  /** Lien vers l'assistant en gardant les choix déjà faits. */
  const href = (change: Record<string, string | null>) => {
    const next = new URLSearchParams();
    const current = { type: kind, patient: patientId || null, rdv: rdv || null, ...change };
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
        <PatientPicker kind={kind} q={q} href={href} />
      ) : (
        <Compose kind={kind} patient={patient} rdv={rdv} user={user} />
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

async function PatientPicker({ kind, q, href }: { kind: DocumentKind; q: string; href: (c: Record<string, string | null>) => string }) {
  // Sans recherche : les derniers dossiers sans compte (souvent ceux qu'on vient de créer sur intervention).
  const results = await prisma.character.findMany({
    where: q ? dossierSearch(q) : { userId: null },
    orderBy: q ? [{ lastName: "asc" }, { firstName: "asc" }] : { createdAt: "desc" },
    take: q ? 20 : 8,
  });

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <form className="flex gap-2">
          <input type="hidden" name="type" value={kind} />
          <input name="q" defaultValue={q} autoFocus placeholder="Prénom, nom ou n° patient (PAT-…)" className="input" />
          <button className="btn-primary shrink-0"><Search className="size-4" /> Rechercher</button>
        </form>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">{q ? "Résultats" : "Derniers dossiers sans compte"}</p>
        <ul className="mt-2 divide-y divide-line">
          {results.map((c) => (
            <li key={c.id}>
              <Link href={href({ patient: c.id })} className="flex items-center gap-3 py-3 hover:bg-ocean-50/50">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 font-medium">
                    {c.firstName} {c.lastName}
                    <DossierBadges dossier={c} />
                  </span>
                  <span className="block text-sm text-muted">
                    {[c.patientNumber, c.birthDate && `né(e) le ${formatDate(c.birthDate)}`].filter(Boolean).join(" · ") || "Infos non renseignées"}
                  </span>
                </span>
                <ChevronRight className="size-4 text-muted" />
              </Link>
            </li>
          ))}
          {results.length === 0 && <li className="py-4 text-sm text-muted">{q ? "Aucun dossier trouvé." : "Aucun dossier sans compte pour l'instant."}</li>}
        </ul>
      </section>

      <details className="card" open={Boolean(q) && results.length === 0}>
        <summary className="flex cursor-pointer items-center gap-2 p-5 font-semibold">
          <UserPlus className="size-5 text-ocean-600" /> Créer un dossier sans compte
        </summary>
        <ActionForm action={createDossier} className="space-y-4 border-t border-line p-5">
          <p className="text-sm text-muted">
            Pour quelqu&apos;un qui n&apos;a pas encore de compte sur le site. Tout est facultatif : on remplit ce qu&apos;on sait, le reste se
            complète plus tard depuis le dossier, qui pourra aussi être rattaché au compte du joueur.
          </p>
          <input type="hidden" name="kind" value={kind} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="firstName">Prénom</label>
              <input id="firstName" name="firstName" maxLength={40} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="lastName">Nom</label>
              <input id="lastName" name="lastName" maxLength={40} className="input" />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted">Identité inconnue ? Laissez vide : le dossier sera nommé « INCONNU X-0001 », « X-0002 »…</p>
          <ObservationFields />
          <MedicalFields />
          <SubmitButton pendingText="Création…">Créer le dossier et continuer</SubmitButton>
        </ActionForm>
      </details>
    </div>
  );
}

async function Compose({ kind, patient, rdv, user }: {
  kind: DocumentKind;
  patient: NonNullable<Awaited<ReturnType<typeof prisma.character.findUnique>>>;
  rdv: string;
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
            defaultServiceId={services.find((s) => s.id === appointment?.serviceId)?.id}
          />
        ) : (
          <DocumentForm
            kind={kind}
            characterId={patient.id}
            appointmentId={appointment?.id}
            services={services}
            defaultServiceId={services.find((s) => s.id === appointment?.serviceId)?.id}
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
