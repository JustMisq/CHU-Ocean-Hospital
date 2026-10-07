import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@ocean/db";
import { requireStaff } from "@/lib/session";
import { formatDate, formatTime } from "@/lib/time";

export const metadata: Metadata = { title: "Journal" };

const PAGE_SIZE = 50;

const CATEGORIES = {
  staff: { label: "Personnel", prefixes: ["staff."] },
  rdv: { label: "Rendez-vous", prefixes: ["appointment."] },
  config: { label: "Configuration", prefixes: ["settings.", "service.", "specialty.", "grade."] },
} as const;

type Category = keyof typeof CATEGORIES;

export default async function AuditLogPage({ searchParams }: PageProps<"/pro/journal">) {
  await requireStaff("audit.view");
  const params = await searchParams;
  const category = (typeof params.type === "string" && params.type in CATEGORIES ? params.type : "") as Category | "";
  const page = Math.max(1, Number(params.page) || 1);

  const logs = await prisma.auditLog.findMany({
    where: category ? { OR: CATEGORIES[category].prefixes.map((p) => ({ action: { startsWith: p } })) } : {},
    include: { actor: { select: { username: true, staff: { select: { displayName: true } } } } },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE + 1,
  });
  const hasMore = logs.length > PAGE_SIZE;
  const href = (p: number, type = category) => `/pro/journal?${new URLSearchParams({ ...(type && { type }), ...(p > 1 && { page: String(p) }) })}`;

  return (
    <div>
      <h1 className="text-2xl font-bold">Journal</h1>
      <p className="mt-1 text-sm text-muted">Changements de grade, annulations (soignants et patients), configuration… qui a fait quoi et quand.</p>

      <div className="mt-6 flex flex-wrap gap-2 text-sm font-medium">
        {([["", "Tout"], ...Object.entries(CATEGORIES).map(([k, v]) => [k, v.label])] as [Category | "", string][]).map(([key, label]) => (
          <Link key={key} href={href(1, key)} className={`rounded-full px-3 py-1 ${category === key ? "bg-ocean-600 text-white" : "border border-line bg-white text-muted"}`}>
            {label}
          </Link>
        ))}
      </div>

      <ul className="card mt-4 divide-y divide-line">
        {logs.slice(0, PAGE_SIZE).map((log) => (
          <li key={log.id} className="flex flex-col gap-1 p-4 text-sm sm:flex-row sm:gap-4">
            <span className="w-32 shrink-0 font-mono text-xs text-muted">{formatDate(log.createdAt)} {formatTime(log.createdAt)}</span>
            <span className="min-w-0 flex-1">
              <span className="font-semibold">{log.actor?.staff?.displayName ?? log.actor?.username ?? "Compte supprimé"}</span>{" "}
              <span className="text-muted">— {log.summary}</span>
            </span>
          </li>
        ))}
        {logs.length === 0 && <li className="p-8 text-center text-sm text-muted">Aucune action enregistrée.</li>}
      </ul>

      {(page > 1 || hasMore) && (
        <div className="mt-4 flex justify-between text-sm font-medium">
          {page > 1 ? <Link href={href(page - 1)} className="text-ocean-600 hover:underline">← Plus récent</Link> : <span />}
          {hasMore && <Link href={href(page + 1)} className="text-ocean-600 hover:underline">Plus ancien →</Link>}
        </div>
      )}
    </div>
  );
}
