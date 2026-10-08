import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { prisma } from "@ocean/db";
import { canAccessPatient, missingInfo } from "@/lib/characters";
import { requireStaff } from "@/lib/session";
import { PrescriptionForm } from "./prescription-form";

export const metadata: Metadata = { title: "Nouvelle ordonnance" };

export default async function NewPrescriptionPage({ params, searchParams }: PageProps<"/pro/patients/[id]/ordonnance">) {
  const { id } = await params;
  const { rdv } = await searchParams;
  const user = await requireStaff("prescriptions.write");
  if (!(await canAccessPatient(user, id))) notFound();

  const [patient, services, appointment] = await Promise.all([
    prisma.character.findUnique({ where: { id } }),
    prisma.service.findMany({
      where: user.isAdmin ? {} : { staff: { some: { id: user.staff.id } } },
      orderBy: { order: "asc" },
      select: { id: true, name: true, code: true },
    }),
    typeof rdv === "string" ? prisma.appointment.findFirst({ where: { id: rdv, characterId: id }, select: { id: true, serviceId: true } }) : null,
  ]);
  if (!patient) notFound();
  const missing = missingInfo(patient);

  return (
    <div className="max-w-3xl space-y-6">
      <Link href={appointment ? `/pro/rdv/${appointment.id}` : `/pro/patients/${id}`} className="text-sm font-medium text-ocean-600 hover:underline">
        ← {appointment ? "Rendez-vous" : "Dossier patient"}
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Nouveau document</h1>
        <p className="mt-1 text-sm text-muted">Pour {patient.firstName} {patient.lastName}</p>
      </div>

      {(missing.length > 0 || !patient.sex) && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            Dossier incomplet ({[...missing, !patient.sex && "sexe"].filter(Boolean).join(", ")}) : ces infos manqueront sur le document.{" "}
            <Link href={`/pro/patients/${id}`} className="font-medium underline">Compléter le dossier</Link> avant d&apos;émettre.
          </span>
        </p>
      )}
      {!user.staff.signatureUrl && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            Vous n&apos;avez pas encore de signature : le document n&apos;aura que le cachet.{" "}
            <Link href="/pro/profil" className="font-medium underline">Signer dans Mon profil</Link>.
          </span>
        </p>
      )}

      <div className="card p-6">
        <PrescriptionForm characterId={id} appointmentId={appointment?.id} services={services} defaultServiceId={services.find((s) => s.id === appointment?.serviceId)?.id} />
      </div>
    </div>
  );
}
