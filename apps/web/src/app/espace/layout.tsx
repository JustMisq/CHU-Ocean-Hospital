import Link from "next/link";
import { requireUser } from "@/lib/session";

export default async function PatientLayout({ children }: LayoutProps<"/espace">) {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold">Bonjour {user.username}</h1>
      <nav className="mt-4 flex gap-1 border-b border-line text-sm font-medium">
        <Link href="/espace" className="border-b-2 border-transparent px-3 py-2 text-muted hover:text-ink">Mes rendez-vous</Link>
        <Link href="/espace/personnages" className="border-b-2 border-transparent px-3 py-2 text-muted hover:text-ink">Mes personnages</Link>
      </nav>
      <div className="mt-6">{children}</div>
    </div>
  );
}
