import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <SearchX className="size-12 text-ocean-600" />
      <h1 className="mt-4 text-2xl font-bold">Page introuvable</h1>
      <p className="mt-2 text-sm text-muted">Ce lien n&apos;existe pas ou plus : soignant retiré, rendez-vous supprimé, ou adresse mal tapée.</p>
      <div className="mt-6 flex gap-2">
        <Link href="/" className="btn-secondary">Accueil</Link>
        <Link href="/medecins" className="btn-primary">Trouver un soignant</Link>
      </div>
    </div>
  );
}
