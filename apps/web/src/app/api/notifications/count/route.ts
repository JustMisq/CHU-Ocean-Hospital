import { NextResponse } from "next/server";
import { unreadCount } from "@/lib/notifications";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Nombre de notifications non lues (rafraîchi régulièrement par la cloche de l'en-tête). */
export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ count: user ? await unreadCount(user.id) : 0 }, { headers: { "Cache-Control": "no-store" } });
}
