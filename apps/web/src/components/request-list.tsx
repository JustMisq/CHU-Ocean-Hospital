import Link from "next/link";
import { ArrowRightLeft, ChevronRight, Inbox } from "lucide-react";
import type { RequestKind, RequestPriority, RequestStatus } from "@ocean/db";
import { requestTitle } from "@/lib/request-labels";
import { formatDateTime } from "@/lib/time";
import { PriorityBadge, RequestStatusBadge } from "./request-badges";

export type RequestRow = {
  id: string;
  number: string;
  kind: RequestKind;
  status: RequestStatus;
  priority: RequestPriority;
  typeSnapshot: unknown;
  createdAt: Date;
  character: { firstName: string; lastName: string };
  author: { displayName: string };
  fromService: { name: string } | null;
  toService: { name: string };
  assignee: { displayName: string } | null;
};

/** Liste de demandes / transferts (page Demandes, dossier patient). */
export function RequestList({ requests, showPatient = true, empty }: { requests: RequestRow[]; showPatient?: boolean; empty: string }) {
  if (!requests.length) return <p className="card p-8 text-center text-sm text-muted">{empty}</p>;
  return (
    <ul className="card divide-y divide-line">
      {requests.map((r) => {
        const Icon = r.kind === "TRANSFERT" ? ArrowRightLeft : Inbox;
        return (
          <li key={r.id}>
            <Link href={`/pro/demandes/${r.id}`} className={`flex items-center gap-3 p-4 hover:bg-ocean-50/50 ${r.priority === "VITAL" && r.status === "PENDING" ? "bg-red-50/60" : ""}`}>
              <Icon className="size-5 shrink-0 text-ocean-600" />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 font-medium">
                  {requestTitle(r)}
                  {showPatient && <span className="text-muted">— {r.character.firstName} {r.character.lastName}</span>}
                  <PriorityBadge priority={r.priority} />
                </span>
                <span className="block truncate text-sm text-muted">
                  {r.number} · {r.fromService?.name ?? r.author.displayName} → {r.toService.name} · {formatDateTime(r.createdAt)}
                  {r.assignee && ` · pris par ${r.assignee.displayName}`}
                </span>
              </span>
              <RequestStatusBadge kind={r.kind} status={r.status} />
              <ChevronRight className="size-4 shrink-0 text-muted" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Champs à charger pour une ligne de liste. */
export const requestRowInclude = {
  character: { select: { firstName: true, lastName: true } },
  author: { select: { displayName: true } },
  fromService: { select: { name: true } },
  toService: { select: { name: true } },
  assignee: { select: { displayName: true } },
} as const;
