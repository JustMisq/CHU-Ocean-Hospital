import { prisma } from "@ocean/db";
import { renderPrescriptionPdf } from "@/lib/prescription-pdf";
import { canViewPrescription } from "@/lib/prescriptions";
import { getCurrentUser } from "@/lib/session";

/** PDF d'une ordonnance : affiché dans le navigateur, ou téléchargé avec `?dl=1`. */
export async function GET(request: Request, { params }: RouteContext<"/api/ordonnances/[id]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Non connecté.", { status: 401 });

  const { id } = await params;
  const prescription = await prisma.prescription.findUnique({ where: { id }, include: { character: { select: { userId: true } } } });
  if (!prescription || !(await canViewPrescription(user, prescription))) return new Response("Introuvable.", { status: 404 });

  const pdf = await renderPrescriptionPdf(prescription);
  const download = new URL(request.url).searchParams.has("dl");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${prescription.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
