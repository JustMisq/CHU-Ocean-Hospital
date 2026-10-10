import Link from "next/link";
import { ChartColumn, CalendarDays, ClipboardList, Clock, FileText, ScrollText, Settings2, UserRound, Users } from "lucide-react";
import { GradeBadge } from "@/components/grade-badge";
import { requireStaff } from "@/lib/session";
import { isStaffBookable } from "@/lib/slots";

export default async function ProLayout({ children }: LayoutProps<"/pro">) {
  const user = await requireStaff();
  const links = [
    { href: "/pro", label: "Agenda", icon: CalendarDays, show: true },
    { href: "/pro/disponibilites", label: "Disponibilités", icon: Clock, show: isStaffBookable(user.staff) || user.isAdmin },
    { href: "/pro/patients", label: "Patients", icon: ClipboardList, show: user.can("patients.history") },
    { href: "/pro/documents", label: "Documents", icon: FileText, show: user.readableKinds.length > 0 },
    { href: "/pro/profil", label: "Mon profil", icon: UserRound, show: true },
    { href: "/pro/personnel", label: "Personnel", icon: Users, show: user.can("staff.manage") },
    { href: "/pro/stats", label: "Statistiques", icon: ChartColumn, show: user.can("stats.view") },
    { href: "/pro/journal", label: "Journal", icon: ScrollText, show: user.can("audit.view") },
    { href: "/pro/config", label: "Configuration", icon: Settings2, show: user.can("settings.manage") },
  ].filter((l) => l.show);

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 md:grid-cols-[220px_1fr]">
      <aside className="md:sticky md:top-24 md:h-fit">
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Espace pro</p>
          <p className="mt-1 font-semibold">{user.staff.displayName}</p>
          <div className="mt-1">
            {user.staff.grade ? <GradeBadge grade={user.staff.grade} /> : <span className="text-xs text-muted">Super-admin</span>}
          </div>
        </div>
        <nav className="mt-3 flex gap-1 overflow-x-auto md:flex-col">
          {links.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted hover:bg-white hover:text-ink">
              <Icon className="size-4" /> {label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}