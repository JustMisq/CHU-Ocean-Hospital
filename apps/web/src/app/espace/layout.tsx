import Link from "next/link";
import { ClipboardPen } from "lucide-react";
import { prisma } from "@ocean/db";
import { ensureCharacter, missingInfo } from "@/lib/characters";
import { requireUser } from "@/lib/session";

export default async function PatientLayout({ children }: LayoutProps<"/espace">) {
  const user = await requireUser();
  await ensureCharacter(user);
  const incomplete = (await prisma.character.findMany({ where: { userId: user.id, archivedAt: null }, orderBy: { createdAt: "asc" } }))
    .map((c) => ({ ...c, missing: missingInfo(c) }))
    .filter((c) => c.missing.length > 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold">Bonjour {user.username}</h1>
      <nav className="mt-4 flex gap-1 border-b border-line text-sm font-medium">
        <Link href="/espace" className="border-b-2 border-transparent px-3 py-2 text-muted hover:text-ink">Mes rendez-vous</Link>
        <Link href="/espace/ordonnances" className="border-b-2 border-transparent px-3 py-2 text-muted hover:text-ink">Mes ordonnances</Link>
        <Link href="/espace/personnages" className="border-b-2 border-transparent px-3 py-2 text-muted hover:text-ink">Mes personnages</Link>
        {user.login && <Link href="/compte/mot-de-passe" className="ml-auto border-b-2 border-transparent px-3 py-2 text-muted hover:text-ink">Mot de passe</Link>}
      </nav>

      {incomplete.length > 0 && (
        <div className="mt-6 flex flex-col gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center">
          <ClipboardPen className="size-5 shrink-0" />
          <p className="flex-1">
            {incomplete.map((c) => (
              <span key={c.id} className="block">
                Dossier de <strong>{c.firstName} {c.lastName}</strong> incomplet : {c.missing.join(", ")}.
              </span>
            ))}
            <span className="text-amber-800">Facultatif, mais utile aux soignants le jour du RDV.</span>
          </p>
          <Link href="/espace/personnages" className="btn-secondary shrink-0">Compléter</Link>
        </div>
      )}

      <div className="mt-6">{children}</div>
    </div>
  );
}
