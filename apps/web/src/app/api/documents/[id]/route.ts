import { prisma } from "@ocean/db";
import { renderDocumentPdf } from "@/lib/document-pdf";
import { canViewDocument } from "@/lib/documents";
import { pdfToPng } from "@/lib/pdf-to-png";
import { getCurrentUser } from "@/lib/session";

/**
 * Document médical : PDF affiché dans le navigateur, téléchargé avec `?dl=1`,
 * ou image PNG (même rendu, toutes les pages) avec `?format=png` (téléchargée avec `&dl=1`).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Non connecté.", { status: 401 });

  const { id } = await params;
  const document = await prisma.medicalDocument.findUnique({ where: { id }, include: { character: { select: { userId: true } } } });
  if (!document || !(await canViewDocument(user, document))) return new Response("Introuvable.", { status: 404 });

  const search = new URL(request.url).searchParams;
  const download = search.has("dl");
  const png = search.get("format") === "png";
  const pdf = new Uint8Array(await renderDocumentPdf(document));
  const body = png ? new Uint8Array(await pdfToPng(pdf)) : pdf;
  return new Response(body, {
    headers: {
      "Content-Type": png ? "image/png" : "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${document.number}.${png ? "png" : "pdf"}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
