"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";

/** Cloche de l'en-tête : nombre de notifications non lues, mis à jour toutes les 30 s et à chaque navigation. */
export function NotificationBell({ initial }: { initial: number }) {
  const [count, setCount] = useState(initial);
  const pathname = usePathname();

  useEffect(() => {
    let alive = true;
    const refresh = () =>
      fetch("/api/notifications/count", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { count: number } | null) => alive && d && setCount(d.count))
        .catch(() => {});
    refresh();
    const timer = setInterval(() => document.visibilityState === "visible" && refresh(), 30_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [pathname]);

  return (
    <Link href="/notifications" className="relative rounded-full p-2 text-muted hover:bg-ocean-50 hover:text-ink" aria-label={count ? `${count} notification(s) non lue(s)` : "Notifications"}>
      <Bell className="size-5" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold leading-5 text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
