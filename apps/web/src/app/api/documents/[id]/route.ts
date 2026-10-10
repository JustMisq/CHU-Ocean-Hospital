import { prisma } from "@ocean/db";
import { renderDocumentPdf } from "@/lib/document-pdf";
import { canViewDocument } from "@/lib/documents";
import { getCurrentUser } from "@/lib/session";

/** PDF d'un document médical : affiché dans le navigateur, ou téléchargé avec `?dl=1`. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Non connecté.", { status: 401 });

  const { id } = await params;
  const document = await prisma.medicalDocument.findUnique({ where: { id }, include: { character: { select: { userId: true } } } });
  if (!document || !(await canViewDocument(user, document))) return new Response("Introuvable.", { status: 404 });

  const pdf = await renderDocumentPdf(document);
  const download = new URL(request.url).searchParams.has("dl");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${document.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
