import { Link2 } from "lucide-react";

/** Indique qu'un élément est synchronisé depuis un rôle Discord. */
export function DiscordPill({ title = "Synchronisé depuis Discord" }: { title?: string }) {
  return (
    <span title={title} className="inline-flex items-center gap-1 rounded-full bg-[#5865F2]/10 px-2 py-0.5 text-[11px] font-semibold text-[#4752c4]">
      <Link2 className="size-3" /> Discord
    </span>
  );
}
