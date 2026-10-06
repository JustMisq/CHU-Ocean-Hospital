import type { AppointmentStatus } from "@ocean/db";

const STYLES: Record<AppointmentStatus, [string, string]> = {
  PENDING: ["En attente", "bg-amber-50 text-amber-800"],
  CONFIRMED: ["Confirmé", "bg-ocean-50 text-ocean-700"],
  COMPLETED: ["Terminé", "bg-emerald-50 text-emerald-700"],
  CANCELLED: ["Annulé", "bg-gray-100 text-gray-600"],
  NO_SHOW: ["Absent", "bg-red-50 text-red-700"],
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const [label, cls] = STYLES[status];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}
