import { prisma } from "@ocean/db";

/** Une image n'est jamais modifiée (un nouvel envoi crée un nouvel id) : cache navigateur permanent. */
export async function GET(_: Request, { params }: RouteContext<"/api/images/[id]">) {
  const { id } = await params;
  const image = await prisma.image.findUnique({ where: { id } });
  if (!image) return new Response("Image introuvable", { status: 404 });

  return new Response(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
