import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FilePlus } from "lucide-react";
import { prisma, type Prisma } from "@ocean/db";
import { DocumentList } from "@/components/document-list";
import { DOCUMENT_TYPES } from "@/lib/document-types";
import { canRevokeDocument, dossierSearch } from "@/lib/documents";
import { requireStaff } from "@/lib/session";

export const metadata: Metadata = { title: "Documents" };

const PAGE_SIZE = 50;

export default async function DocumentsPage({ searchParams }: PageProps<"/pro/documents">) {
  const user = await requireStaff();
  if (user.readableKinds.length === 0) redirect("/pro");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const kind = user.readableKinds.find((k) => k === params.type) ?? null;
  // « Voir les documents de tout l'hôpital » : ceux des types lisibles par son grade ; sinon, seulement les siens.
  const seeAll = user.can("documents.view_all");

  const where: Prisma.MedicalDocumentWhereInput = {
    AND: [
      seeAll ? { OR: [{ kind: { in: user.readableKinds } }, { staffId: user.staff.id }] } : { staffId: user.staff.id },
      kind ? { kind } : {},
      q ? { OR: [{ number: { contains: q, mode: "insensitive" } }, { character: dossierSearch(q) }] } : {},
    ],
  };
  const documents = await prisma.medicalDocument.findMany({ where, orderBy: { createdAt: "desc" }, take: PAGE_SIZE });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Documents</h1>
          <p className="mt-1 text-sm text-muted">
            Ordonnances, certificats, arrêts de travail… {seeAll ? "de tout l'hôpital." : "que vous avez rédigés."}
          </p>
        </div>
        {user.writableKinds.length > 0 && (
          <Link href="/pro/documents/nouveau" className="btn-primary"><FilePlus className="size-4" /> Nouveau document</Link>
        )}
      </div>

      <form className="mt-6 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Patient, n° patient ou n° de document" className="input sm:max-w-sm" />
        <select name="type" defaultValue={kind ?? ""} className="input sm:max-w-56">
          <option value="">Tous les types</option>
          {user.readableKinds.map((k) => <option key={k} value={k}>{DOCUMENT_TYPES[k].label}</option>)}
        </select>
        <button className="btn-secondary">Filtrer</button>
      </form>

      <div className="mt-4">
        <DocumentList
          documents={documents}
          showPatient
          canRevoke={(d) => canRevokeDocument(user, d)}
          empty={q || kind ? "Aucun document ne correspond." : "Aucun document pour l'instant."}
        />
      </div>
      {documents.length === PAGE_SIZE && <p className="mt-3 text-xs text-muted">Seuls les {PAGE_SIZE} derniers sont affichés : affinez la recherche.</p>}
    </div>
  );
}
