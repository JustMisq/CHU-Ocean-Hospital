import type { Metadata } from "next";
import { BellOff, CheckCheck } from "lucide-react";
import { prisma } from "@ocean/db";
import { markAllNotificationsRead } from "@/lib/actions/requests";
import { requireUser } from "@/lib/session";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser("/notifications");
  const notifications = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Notifications</h1>
        {unread > 0 && (
          <form action={markAllNotificationsRead}>
            <button className="btn-secondary"><CheckCheck className="size-4" /> Tout marquer comme lu</button>
          </form>
        )}
      </div>
      {notifications.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-10 text-sm text-muted">
          <BellOff className="size-6" /> Rien pour l&apos;instant.
        </div>
      ) : (
        <ul className="card divide-y divide-line">
          {notifications.map((n) => (
            <li key={n.id}>
              <a href={`/api/notifications/${n.id}`} className={`flex items-start gap-3 p-4 hover:bg-ocean-50/50 ${n.readAt ? "" : "bg-ocean-50/40"}`}>
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-red-500"}`} />
                <span className="min-w-0 flex-1">
                  <span className={`block ${n.readAt ? "" : "font-semibold"}`}>{n.title}</span>
                  {n.body && <span className="block truncate text-sm text-muted">{n.body}</span>}
                </span>
                <span className="shrink-0 text-xs text-muted">{formatDateTime(n.createdAt)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
