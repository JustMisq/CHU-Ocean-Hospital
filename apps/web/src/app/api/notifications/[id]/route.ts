import { NextResponse } from "next/server";
import { prisma } from "@ocean/db";
import { getCurrentUser } from "@/lib/session";

/** Ouvre une notification : marquée lue, puis redirection vers sa page. */
export async function GET(request: Request, { params }: RouteContext<"/api/notifications/[id]">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/connexion", request.url));
  const { id } = await params;
  const notification = await prisma.notification.findFirst({ where: { id, userId: user.id } });
  if (!notification) return NextResponse.redirect(new URL("/notifications", request.url));
  if (!notification.readAt) await prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  // Liens internes uniquement.
  const target = notification.link.startsWith("/") && !notification.link.startsWith("//") ? notification.link : "/notifications";
  return NextResponse.redirect(new URL(target, request.url));
}
