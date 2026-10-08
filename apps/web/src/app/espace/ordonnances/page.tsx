import type { Metadata } from "next";
import { prisma } from "@ocean/db";
import { PrescriptionList } from "@/components/prescription-list";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Mes ordonnances" };

export default async function PatientPrescriptionsPage() {
  const user = await requireUser("/espace/ordonnances");
  // Personnages archivés compris : leurs ordonnances restent téléchargeables.
  const characters = await prisma.character.findMany({
    where: { userId: user.id, prescriptions: { some: {} } },
    include: { prescriptions: { orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "asc" },
  });

  if (characters.length === 0) {
    return <p className="card p-8 text-center text-sm text-muted">Aucune ordonnance pour l&apos;instant. Elles apparaîtront ici après une consultation.</p>;
  }
  return (
    <div className="space-y-8">
      {characters.map((c) => (
        <section key={c.id}>
          <h2 className="mb-3 text-lg font-bold">{c.firstName} {c.lastName}</h2>
          <PrescriptionList prescriptions={c.prescriptions} />
        </section>
      ))}
    </div>
  );
}
