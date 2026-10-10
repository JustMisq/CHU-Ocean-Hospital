import type { Metadata } from "next";
import { prisma } from "@ocean/db";
import { DocumentList } from "@/components/document-list";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Mes documents" };

export default async function PatientDocumentsPage() {
  const user = await requireUser("/espace/documents");
  // Personnages archivés compris : leurs documents restent téléchargeables.
  const characters = await prisma.character.findMany({
    where: { userId: user.id, documents: { some: {} } },
    include: { documents: { orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "asc" },
  });

  if (characters.length === 0) {
    return <p className="card p-8 text-center text-sm text-muted">Aucun document pour l&apos;instant. Ordonnances, certificats et arrêts de travail apparaîtront ici.</p>;
  }
  return (
    <div className="space-y-8">
      {characters.map((c) => (
        <section key={c.id}>
          <h2 className="mb-3 text-lg font-bold">{c.firstName} {c.lastName}</h2>
          <DocumentList documents={c.documents} />
        </section>
      ))}
    </div>
  );
}
