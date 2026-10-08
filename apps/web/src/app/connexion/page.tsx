import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@ocean/db";
import { signIn } from "@/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Logo } from "@/components/logo";
import { loginWithPassword } from "@/lib/actions/account";
import { DEMO_LOGIN_PREFIX, devLoginEnabled } from "@/lib/features";
import { getCurrentUser, getSettings } from "@/lib/session";

export const metadata: Metadata = { title: "Connexion" };

function safeCallback(value: unknown) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/espace";
}

export default async function LoginPage({ searchParams }: PageProps<"/connexion">) {
  const params = await searchParams;
  const callbackUrl = safeCallback(params.callbackUrl);
  if (await getCurrentUser()) redirect(callbackUrl);

  const settings = await getSettings();
  const demoUsers = devLoginEnabled
    ? await prisma.user.findMany({
        where: { login: { startsWith: DEMO_LOGIN_PREFIX } },
        include: { staff: { include: { grade: true } } },
        orderBy: { username: "asc" },
      })
    : [];

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <div className="card p-8">
        <div className="flex justify-center"><Logo name={settings.hospitalName} /></div>
        <h1 className="mt-6 text-center text-2xl font-bold">Connexion</h1>
        <p className="mt-2 text-center text-sm text-muted">Patients et personnel de l&apos;hôpital.</p>

        <ActionForm action={loginWithPassword} className="mt-6 space-y-4">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <div>
            <label className="label" htmlFor="login">Identifiant</label>
            <input id="login" name="login" required autoComplete="username" autoCapitalize="none" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="password">Mot de passe</label>
            <input id="password" name="password" type="password" required autoComplete="current-password" className="input" />
          </div>
          <SubmitButton className="btn-primary w-full py-3" pendingText="Connexion…">Se connecter</SubmitButton>
        </ActionForm>

        <div className="mt-5 space-y-1 text-center text-sm text-muted">
          {settings.allowSignup === "true" && (
            <p>Pas encore de compte ? <Link href="/inscription" className="font-medium text-ocean-600 hover:underline">Créer un compte</Link></p>
          )}
          <p className="text-xs">Personnel : votre compte est créé par la direction. Mot de passe oublié : adressez-vous à elle en jeu.</p>
        </div>
      </div>

      {demoUsers.length > 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-5">
          <p className="text-sm font-semibold text-amber-900">Mode développement — comptes de démo</p>
          <div className="mt-3 grid gap-2">
            {demoUsers.map((u) => (
              <form
                key={u.id}
                action={async () => {
                  "use server";
                  await signIn("dev", { login: u.login, redirectTo: u.staff?.grade ? "/pro" : callbackUrl });
                }}
              >
                <button className="flex w-full items-center justify-between rounded-xl bg-white px-4 py-2.5 text-sm hover:bg-amber-100">
                  <span className="font-medium">{u.username}</span>
                  <span className="text-xs font-semibold text-amber-800">{u.staff?.grade?.name ?? "Patient"}</span>
                </button>
              </form>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
