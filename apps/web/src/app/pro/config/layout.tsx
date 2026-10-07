import Link from "next/link";
import { discordEnabled } from "@/lib/features";
import { requireStaff } from "@/lib/session";

const TABS = [
  { href: "/pro/config", label: discordEnabled ? "Général & Discord" : "Général" },
  { href: "/pro/config/services", label: "Services" },
  { href: "/pro/config/grades", label: "Grades" },
  { href: "/pro/config/specialites", label: "Spécialités" },
];

export default async function ConfigLayout({ children }: LayoutProps<"/pro/config">) {
  await requireStaff("settings.manage");
  return (
    <div>
      <h1 className="text-2xl font-bold">Configuration</h1>
      <nav className="mt-4 flex gap-1 overflow-x-auto border-b border-line text-sm font-medium">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className="shrink-0 px-3 py-2 text-muted hover:text-ink">{t.label}</Link>
        ))}
      </nav>
      <div className="mt-6">{children}</div>
    </div>
  );
}
