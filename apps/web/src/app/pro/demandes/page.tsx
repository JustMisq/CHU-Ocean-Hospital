import Link from "next/link";
import type { Metadata } from "next";
import { Plus, Settings2 } from "lucide-react";
import { prisma, type Prisma } from "@ocean/db";
import { RequestList, requestRowInclude } from "@/components/request-list";
import { myServiceIds, visibleRequestsWhere } from "@/lib/requests";
import { requireStaff } from "@/lib/session";

export const metadata: Metadata = { title: "Demandes et transferts" };

const OPEN = { status: { in: ["PENDING", "ACCEPTED"] } } satisfies Prisma.ServiceRequestWhereInput;
const CLOSED = { status: { in: ["COMPLETED", "REFUSED", "CANCELLED"] } } satisfies Prisma.ServiceRequestWhereInput;

export default async function RequestsPage({ searchParams }: PageProps<"/pro/demandes">) {
  const user = await requireStaff();
  const all = user.isAdmin || user.can("requests.view_all");
  const services = await myServiceIds(user.staff.id);
  const canConfigure = all || user.can("requests.configure") || user.can("settings.manage") || (await prisma.service.count({ where: { headId: user.staff.id } })) > 0;

  // Reçues : pour un de mes services (sans destinataire nommé) ou pour moi ; transferts compris.
  const received: Prisma.ServiceRequestWhereInput = { OR: [{ toServiceId: { in: services }, recipientId: null }, { recipientId: user.staff.id }, { assigneeId: user.staff.id }] };
  const sent: Prisma.ServiceRequestWhereInput = { authorId: user.staff.id };
  const tabs = [
    { id: "recues", label: "À traiter", where: { AND: [received, OPEN] } },
    { id: "envoyees", label: "Envoyées en cours", where: { AND: [sent, OPEN] } },
    ...(all ? [{ id: "hopital", label: "Tout l'hôpital (en cours)", where: OPEN }] : []),
    { id: "historique", label: "Historique", where: { AND: [await visibleRequestsWhere(user), CLOSED] } },
  ];
  const vue = (await searchParams).vue;
  const tab = tabs.find((t) => t.id === vue) ?? tabs[0];
  const [counts, requests] = await Promise.all([
    Promise.all(tabs.map((t) => (t.id === "historique" ? null : prisma.serviceRequest.count({ where: t.where })))),
    prisma.serviceRequest.findMany({
      where: tab.where,
      include: requestRowInclude,
      // Urgences vitales d'abord, puis les plus anciennes en attente.
      orderBy: tab.id === "historique" ? [{ updatedAt: "desc" }] : [{ priority: "desc" }, { createdAt: "asc" }],
      take: 100,
    }),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Demandes et transferts</h1>
        <div className="flex flex-wrap gap-2">
          {canConfigure && <Link href="/pro/demandes/types" className="btn-secondary"><Settings2 className="size-4" /> Types de demandes</Link>}
          <Link href="/pro/demandes/nouvelle" className="btn-primary"><Plus className="size-4" /> Nouvelle demande</Link>
        </div>
      </div>
      {services.length === 0 && !all && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          Vous n&apos;êtes rattaché(e) à aucun service : vous ne recevez que les demandes qui vous sont adressées nommément.
        </p>
      )}

      <nav className="flex flex-wrap gap-1 border-b border-line text-sm font-medium">
        {tabs.map((t, i) => (
          <Link key={t.id} href={`/pro/demandes?vue=${t.id}`} className={`-mb-px border-b-2 px-3 py-2 ${t.id === tab.id ? "border-ocean-600 text-ocean-700" : "border-transparent text-muted hover:text-ink"}`}>
            {t.label}
            {counts[i] ? <span className="ml-1.5 rounded-full bg-ocean-600 px-1.5 text-xs text-white">{counts[i]}</span> : null}
          </Link>
        ))}
      </nav>

      <RequestList
        requests={requests}
        empty={tab.id === "recues" ? "Rien à traiter pour vos services." : tab.id === "envoyees" ? "Aucune demande en cours." : "Rien ici pour l'instant."}
      />
    </div>
  );
}
