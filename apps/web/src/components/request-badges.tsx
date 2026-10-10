import type { RequestKind, RequestPriority, RequestStatus } from "@ocean/db";
import { PRIORITY_LABELS, PRIORITY_STYLES, STATUS_STYLES, statusLabel } from "@/lib/request-labels";

export function RequestStatusBadge({ kind, status }: { kind: RequestKind; status: RequestStatus }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}>{statusLabel(kind, status)}</span>;
}

export function PriorityBadge({ priority }: { priority: RequestPriority }) {
  if (priority === "NORMAL") return null;
  return <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${PRIORITY_STYLES[priority]}`}>{PRIORITY_LABELS[priority]}</span>;
}
