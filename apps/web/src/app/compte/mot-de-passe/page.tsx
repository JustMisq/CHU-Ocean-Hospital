import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { changePassword } from "@/lib/actions/account";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Mot de passe" };

export default async function PasswordPage() {
  // Pas de requireUser : il redirige ici quand le mot de passe est temporaire.
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?callbackUrl=/compte/mot-de-passe");
  const forced = user.mustChangePassword;

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="card p-8">
        <KeyRound className="size-8 text-ocean-600" />
        <h1 className="mt-4 text-2xl font-bold">{forced ? "Choisissez votre mot de passe" : "Changer de mot de passe"}</h1>
        {forced && (
          <p className="mt-2 text-sm text-muted">Vous vous êtes connecté avec un mot de passe temporaire. Choisissez-en un personnel pour continuer.</p>
        )}
        {user.login && <p className="mt-2 text-sm text-muted">Identifiant : <span className="font-mono font-medium text-ink">{user.login}</span></p>}

        <ActionForm action={changePassword} className="mt-6 space-y-4" resetOnSuccess>
          {!forced && (
            <div>
              <label className="label" htmlFor="current">Mot de passe actuel</label>
              <input id="current" name="current" type="password" required autoComplete="current-password" className="input" />
            </div>
          )}
          <div>
            <label className="label" htmlFor="password">Nouveau mot de passe</label>
            <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="confirm">Confirmation</label>
            <input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" className="input" />
          </div>
          <SubmitButton className="btn-primary w-full" pendingText="Enregistrement…">Enregistrer</SubmitButton>
        </ActionForm>
        {!forced && <Link href="/espace" className="mt-4 inline-block text-sm font-medium text-ocean-600 hover:underline">← Retour</Link>}
      </div>
    </div>
  );
}
