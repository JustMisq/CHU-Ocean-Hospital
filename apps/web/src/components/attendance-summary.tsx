import type { Attendance } from "@/lib/characters";

/** « 7 RDV · 5 honorés · 2 absences », absences en rouge pour que le praticien les voie tout de suite. */
export function AttendanceSummary({ attendance: { total, completed, noShow } }: { attendance: Attendance }) {
  return (
    <p className="flex flex-wrap gap-2 text-xs font-semibold">
      <span className="rounded-full bg-canvas px-2.5 py-0.5 text-muted">{total} RDV</span>
      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-emerald-700">{completed} honoré{completed > 1 ? "s" : ""}</span>
      <span className={`rounded-full px-2.5 py-0.5 ${noShow ? "bg-red-50 text-red-700" : "bg-canvas text-muted"}`}>
        {noShow} absence{noShow > 1 ? "s" : ""}
      </span>
    </p>
  );
}
