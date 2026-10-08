import type { ReactNode } from "react";
import { ChevronRight, Trash } from "lucide-react";
import { ConfirmButton } from "@/components/forms";

/** Ligne dépliable d'une liste de configuration (service, grade, spécialité). */
export function ConfigItem({ title, subtitle, children }: { title: ReactNode; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <details className="card group">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold">{title}</p>
          {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>
        <ChevronRight className="size-4 text-muted transition group-open:rotate-90" />
      </summary>
      <div className="border-t border-line p-4">{children}</div>
    </details>
  );
}

export function DeleteButton({ action, id, message }: { action: (data: FormData) => Promise<void>; id: string; message: string }) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <ConfirmButton message={message} className="btn-danger">
        <Trash className="size-4" /> Supprimer
      </ConfirmButton>
    </form>
  );
}
