import type { ReactNode } from "react";
import { ChevronRight, Trash } from "lucide-react";
import { parseRoleIds } from "@ocean/db";
import { DiscordPill } from "@/components/discord-pill";
import { ConfirmButton } from "@/components/forms";
import { discordEnabled, isDiscordLinked } from "@/lib/features";

/** Ligne dépliable d'une liste de configuration (service, grade, spécialité). */
export function ConfigItem({ title, subtitle, roleIds, children }: { title: ReactNode; subtitle?: ReactNode; roleIds: string; children: ReactNode }) {
  return (
    <details className="card group">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold">{title} {isDiscordLinked({ discordRoleIds: roleIds }) && <DiscordPill />}</p>
          {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>
        <ChevronRight className="size-4 text-muted transition group-open:rotate-90" />
      </summary>
      <div className="border-t border-line p-4">{children}</div>
    </details>
  );
}

export function RoleIdsField({ defaultValue = "" }: { defaultValue?: string }) {
  // Discord désactivé : champ masqué, mais les IDs déjà saisis sont conservés pour une réactivation.
  if (!discordEnabled) return <input type="hidden" name="discordRoleIds" value={defaultValue} />;
  return (
    <div>
      <label className="label">IDs des rôles Discord</label>
      <input name="discordRoleIds" defaultValue={parseRoleIds(defaultValue).join(", ")} placeholder="Vide = attribution manuelle" className="input font-mono" />
      <p className="mt-1 text-xs text-muted">Plusieurs IDs possibles, séparés par des virgules. Clic droit sur le rôle → Copier l&apos;identifiant.</p>
    </div>
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
