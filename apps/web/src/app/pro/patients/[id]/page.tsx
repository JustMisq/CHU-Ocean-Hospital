import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FilePlus, TriangleAlert } from "lucide-react";
import { PrescriptionList } from "@/components/prescription-list";
import { prisma } from "@ocean/db";
import { AttendanceSummary } from "@/components/attendance-summary";
import { ActionForm, SubmitButton } from "@/components/forms";
import { MedicalFields } from "@/components/medical-fields";
import { StatusBadge } from "@/components/status-badge";
import { updatePatientInfo } from "@/lib/actions/pro";
import { attendanceOf, canAccessPatient, missingInfo } from "@/lib/characters";
import { requireStaff } from "@/lib/session";
import { formatDate, formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Dossier patient" };

export default async function PatientFilePage({ params, searchParams }: PageProps<"/pro/patients/[id]">) {
  const { id } = await params;
  const { ordonnance } = await searchParams;
  const user = await requireStaff();
  if (!(await canAccessPatient(user, id))) notFound();

  const patient = await prisma.character.findUnique({
    where: { id },
    include: {
      user: { select: { username: true } },
      appointments: { include: { staff: { select: { displayName: true } }, service: { select: { name: true } } }, orderBy: { start: "desc" } },
      prescriptions: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!patient) notFound();
  const missing = missingInfo(patient);

  return (
    <div className="space-y-6">
      {user.can("patients.history") && <Link href="/pro/patients" className="text-sm font-medium text-ocean-600 hover:underline">← Patients</Link>}

      <div className="card p-6">
        <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold">
          {patient.firstName} {patient.lastName}
          {patient.archivedAt && <span className="rounded-full bg-canvas px-2 py-0.5 text-xs font-medium text-muted">Personnage archivé</span>}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Joueur : {patient.user.username} · Dossier créé le {formatDate(patient.createdAt)}
          {patient.patientNumber && ` · N° ${patient.patientNumber}`}
        </p>
        <div className="mt-3"><AttendanceSummary attendance={attendanceOf(patient.appointments.map((a) => a.status))} /></div>
        {patient.allergies && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-900">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {patient.allergies}
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <section className="card h-fit p-6">
          <h2 className="font-bold">Infos médicales</h2>
          {missing.length > 0 && <p className="mt-1 text-sm text-amber-700">À compléter : {missing.join(", ")}.</p>}
          <ActionForm action={updatePatientInfo} className="mt-4 space-y-4">
            <input type="hidden" name="id" value={patient.id} />
            <MedicalFields character={patient} />
            <SubmitButton>Enregistrer</SubmitButton>
            <p className="text-xs text-muted">Visible par le joueur. Chaque modification est tracée dans le journal.</p>
          </ActionForm>
        </section>

        <section className="space-y-8">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-bold">Ordonnances & certificats ({patient.prescriptions.length})</h2>
              {user.can("prescriptions.write") && (
                <Link href={`/pro/patients/${patient.id}/ordonnance`} className="btn-primary"><FilePlus className="size-4" /> Nouveau document</Link>
              )}
            </div>
            <div className="mt-3">
              <PrescriptionList
                prescriptions={patient.prescriptions}
                canRevoke={(p) => p.staffId === user.staff.id || user.isAdmin}
                highlightId={typeof ordonnance === "string" ? ordonnance : undefined}
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
