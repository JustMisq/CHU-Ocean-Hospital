"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <TriangleAlert className="size-12 text-amber-500" />
      <h1 className="mt-4 text-2xl font-bold">Une erreur est survenue</h1>
      <p className="mt-2 text-sm text-muted">
        Réessayez dans un instant. Si le problème continue, signalez-le à la direction avec ce code :
      </p>
      {error.digest && <code className="mt-2 rounded-lg bg-white px-2 py-1 text-xs text-muted">{error.digest}</code>}
      <div className="mt-6 flex gap-2">
        <Link href="/" className="btn-secondary">Accueil</Link>
        <button onClick={reset} className="btn-primary">Réessayer</button>
      </div>
    </div>
  );
}
