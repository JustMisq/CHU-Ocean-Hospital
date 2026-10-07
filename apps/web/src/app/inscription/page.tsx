import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Logo } from "@/components/logo";
import { signup } from "@/lib/actions/account";
import { getCurrentUser, getSettings } from "@/lib/session";

export const metadata: Metadata = { title: "Créer un compte" };

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/espace");
  const settings = await getSettings();

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <div className="card p-8">
        <div className="flex justify-center"><Logo name={settings.hospitalName} /></div>
        <h1 className="mt-6 text-center text-2xl font-bold">Créer un compte</h1>

        {settings.allowSignup !== "true" ? (
          <p className="mt-4 text-center text-sm text-muted">Les inscriptions sont fermées pour le moment. Adressez-vous à l&apos;hôpital en jeu.</p>
        ) : (
          <>
            <p className="mt-2 text-center text-sm text-muted">
              Votre dossier patient est créé en même temps. Le reste (date de naissance, groupe sanguin…) pourra être complété plus tard.
            </p>
            <ActionForm action={signup} className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="firstName">Prénom du personnage</label>
                  <input id="firstName" name="firstName" required maxLength={40} className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="lastName">Nom</label>
                  <input id="lastName" name="lastName" required maxLength={40} className="input" />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="login">Identifiant de connexion</label>
                <input id="login" name="login" required minLength={3} maxLength={32} pattern="[A-Za-z0-9._\-]+" autoComplete="username" autoCapitalize="none" className="input" />
                <p className="mt-1 text-xs text-muted">Lettres, chiffres, point, tiret. Il ne sera pas affiché.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="password">Mot de passe</label>
                  <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="confirm">Confirmation</label>
                  <input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" className="input" />
                </div>
              </div>
              <SubmitButton className="btn-primary w-full py-3" pendingText="Création…">Créer mon compte</SubmitButton>
            </ActionForm>
          </>
        )}
        <p className="mt-5 text-center text-sm text-muted">
          Déjà inscrit ? <Link href="/connexion" className="font-medium text-ocean-600 hover:underline">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
