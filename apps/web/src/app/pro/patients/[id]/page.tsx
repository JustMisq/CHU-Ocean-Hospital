import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRightLeft, FilePlus, Inbox, Link2, MapPin, TriangleAlert } from "lucide-react";
import { normalizeLogin, prisma } from "@ocean/db";
import { AttendanceSummary } from "@/components/attendance-summary";
import { DocumentList } from "@/components/document-list";
import { DossierBadges } from "@/components/dossier-badges";
import { ActionForm, SubmitButton } from "@/components/forms";
import { MedicalFields, ObservationFields } from "@/components/medical-fields";
import { RequestList, requestRowInclude } from "@/components/request-list";
import { StatusBadge } from "@/components/status-badge";
import { linkDossier } from "@/lib/actions/documents";
import { updatePatientInfo } from "@/lib/actions/pro";
import { attendanceOf, canAccessPatient, missingInfo } from "@/lib/characters";
import { canRevokeDocument } from "@/lib/documents";
import { currentServiceOf } from "@/lib/requests";
import { requireStaff } from "@/lib/session";
import { formatDate, formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Dossier patient" };

export default async function PatientFilePage({ params, searchParams }: PageProps<"/pro/patients/[id]">) {
  const { id } = await params;
  const { document: highlight, compte } = await searchParams;
  const user = await requireStaff();
  if (!(await canAccessPatient(user, id))) notFound();

  const patient = await prisma.character.findUnique({
    where: { id },
    include: {
      user: { select: { username: true, login: true } },
      appointments: { include: { staff: { select: { displayName: true } }, service: { select: { name: true } } }, orderBy: { start: "desc" } },
      // Documents des types lisibles par son grade, plus ceux qu'on a rédigés soi-même.
      documents: {
        where: { OR: [{ kind: { in: user.readableKinds } }, ...(user.staff ? [{ staffId: user.staff.id }] : [])] },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!patient) notFound();
  const [requests, current] = await Promise.all([
    prisma.serviceRequest.findMany({ where: { characterId: id }, include: requestRowInclude, orderBy: { createdAt: "desc" }, take: 30 }),
    currentServiceOf(id),
  ]);
  const missing = missingInfo(patient);
  const withoutAccount = !patient.user;

  // Rattachement d'un dossier sans compte : compte du joueur cherché par son identifiant.
  const accountLogin = typeof compte === "string" ? normalizeLogin(compte) : "";
  const account = withoutAccount && accountLogin
    ? await prisma.user.findUnique({
        where: { login: accountLogin },
        select: { login: true, username: true, characters: { where: { archivedAt: null }, orderBy: { createdAt: "asc" } } },
      })
    : null;

  return (
    <div className="space-y-6">
      {user.can("patients.history") && <Link href="/pro/patients" className="text-sm font-medium text-ocean-600 hover:underline">← Patients</Link>}

      <div className="card p-6">
        <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold">
          {patient.firstName} {patient.lastName}
          <DossierBadges dossier={patient} />
        </h1>
        <p className="mt-1 text-sm text-muted">
          {patient.user ? `Joueur : ${patient.user.username}` : "Pas encore de compte sur le site"} · Dossier créé le {formatDate(patient.createdAt)}
          {patient.patientNumber && ` · N° ${patient.patientNumber}`}
        </p>
        {(patient.apparentAge || patient.description) && (
          <p className="mt-2 text-sm">
            {patient.apparentAge && <span className="font-medium">Âge apparent : {patient.apparentAge}. </span>}
            {patient.description}
          </p>
        )}
        {current && (
          <p className="mt-2 flex items-center gap-1.5 text-sm"><MapPin className="size-4 text-ocean-600" /> Actuellement en <strong>{current.name}</strong>{current.since && <span className="text-muted">depuis le {formatDateTime(current.since)}</span>}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`/pro/demandes/nouvelle?patient=${patient.id}`} className="btn-secondary"><Inbox className="size-4" /> Demande à un service</Link>
          {!patient.deceasedAt && <Link href={`/pro/demandes/nouvelle?kind=TRANSFERT&patient=${patient.id}`} className="btn-secondary"><ArrowRightLeft className="size-4" /> Transférer</Link>}
        </div>
        <div className="mt-3"><AttendanceSummary attendance={attendanceOf(patient.appointments.map((a) => a.status))} /></div>
        {patient.allergies && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-900">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {patient.allergies}
          </p>
        )}
      </div>

      {withoutAccount && (
        <section className="card border-violet-200 bg-violet-50/40 p-6">
          <h2 className="flex items-center gap-2 font-bold"><Link2 className="size-5 text-violet-600" /> Rattacher à un compte</h2>
          {!user.can("patients.history") ? (
            <p className="mt-2 text-sm text-muted">Dossier créé sans compte. Le rattachement au compte du joueur se fait par un soignant ayant accès aux dossiers patients.</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted">
                Quand la personne a créé son compte sur le site : son dossier, ses documents et son historique la suivent.
              </p>
              <form className="mt-4 flex gap-2">
                <input name="compte" defaultValue={accountLogin} required autoCapitalize="none" placeholder="Identifiant du compte du joueur" className="input sm:max-w-xs" />
                <button className="btn-secondary">Chercher</button>
              </form>
              {accountLogin && !account && <p className="mt-3 text-sm text-red-700">Aucun compte avec l&apos;identifiant « {accountLogin} ».</p>}
              {account && (
                <ActionForm action={linkDossier} className="mt-4 space-y-3">
                  <input type="hidden" name="id" value={patient.id} />
                  <input type="hidden" name="login" value={account.login ?? ""} />
                  <p className="text-sm">Compte <strong>{account.username}</strong> (@{account.login}) :</p>
                  <label className="flex items-start gap-2 text-sm">
                    <input type="radio" name="target" value="new" defaultChecked className="mt-0.5 accent-ocean-600" />
                    <span>Ajouter ce dossier comme <strong>nouveau personnage</strong> du joueur</span>
                  </label>
                  {account.characters.map((c) => (
                    <label key={c.id} className="flex items-start gap-2 text-sm">
                      <input type="radio" name="target" value={c.id} className="mt-0.5 accent-ocean-600" />
                      <span>
                        <strong>Fusionner</strong> avec son personnage {c.firstName} {c.lastName}
                        <span className="block text-xs text-muted">Le joueur l&apos;a déjà créé : RDV et documents sont regroupés, ce dossier provisoire disparaît.</span>
                      </span>
                    </label>
                  ))}
                  <SubmitButton pendingText="Rattachement…">Rattacher</SubmitButton>
                </ActionForm>
              )}
            </>
          )}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <section className="card h-fit p-6">
          <h2 className="font-bold">Infos médicales</h2>
          {missing.length > 0 && <p className="mt-1 text-sm text-amber-700">À compléter : {missing.join(", ")}.</p>}
          <ActionForm action={updatePatientInfo} className="mt-4 space-y-4">
            <input type="hidden" name="id" value={patient.id} />
            {/* Sans compte, personne d'autre ne peut corriger l'identité : le soignant le peut. */}
            {withoutAccount && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="firstName">Prénom</label>
                  <input id="firstName" name="firstName" required maxLength={40} defaultValue={patient.firstName} className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="lastName">Nom</label>
                  <input id="lastName" name="lastName" required maxLength={40} defaultValue={patient.lastName} className="input" />
                </div>
              </div>
            )}
            {withoutAccount && <ObservationFields character={patient} />}
            <MedicalFields character={patient} />
            <SubmitButton>Enregistrer</SubmitButton>
            <p className="text-xs text-muted">{withoutAccount ? "" : "Visible par le joueur. "}Chaque modification est tracée dans le journal.</p>
          </ActionForm>
        </section>

        <section className="space-y-8">
          {requests.length > 0 && (
            <div>
              <h2 className="font-bold">Demandes et transferts ({requests.length})</h2>
              <div className="mt-3"><RequestList requests={requests} showPatient={false} empty="" /></div>
            </div>
          )}

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-bold">Documents ({patient.documents.length})</h2>
              {user.writableKinds.length > 0 && (
                <Link href={`/pro/documents/nouveau?patient=${patient.id}`} className="btn-primary"><FilePlus className="size-4" /> Nouveau document</Link>
              )}
            </div>
            <div className="mt-3">
              <DocumentList
                documents={patient.documents}
                canRevoke={(d) => canRevokeDocument(user, d)}
                highlightId={typeof highlight === "string" ? highlight : undefined}
              />
            </div>
          </div>

          <div>
            <h2 className="font-bold">Consultations ({patient.appointments.length})</h2>
            <ul className="mt-3 space-y-2">
              {patient.appointments.map((a) => (
                <li key={a.id} className="card p-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/pro/rdv/${a.id}`} className="font-medium hover:underline">{formatDateTime(a.start)}</Link>
                    <StatusBadge status={a.status} />
                  </div>
                  <p className="text-muted">{a.staff.displayName}{a.service && ` · ${a.service.name}`} — {a.reason}</p>
                  {a.report && <p className="mt-2 whitespace-pre-line rounded-xl bg-canvas p-3">{a.report}</p>}
                </li>
              ))}
              {patient.appointments.length === 0 && <li className="card p-6 text-center text-sm text-muted">Aucune consultation pour l&apos;instant.</li>}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
