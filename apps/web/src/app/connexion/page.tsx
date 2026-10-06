import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@ocean/db";
import { devLoginEnabled, signIn } from "@/auth";
import { Logo } from "@/components/logo";
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
        where: { discordId: { startsWith: "dev-" } },
        include: { staff: { include: { grade: true } } },
        orderBy: { username: "asc" },
      })
    : [];

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <div className="card p-8 text-center">
        <div className="flex justify-center"><Logo name={settings.hospitalName} /></div>
        <h1 className="mt-6 text-2xl font-bold">Connexion</h1>
        <p className="mt-2 text-sm text-muted">
          Utilisez votre compte Discord. Votre accès au site dépend de vos rôles sur le serveur.
        </p>
        {params.erreur === "serveur" && (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
            Vous devez être membre du serveur Discord pour vous connecter.
          </p>
        )}
        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signIn("discord", { redirectTo: callbackUrl });
          }}
        >
          <button className="btn w-full bg-[#5865F2] py-3 text-white hover:bg-[#4752c4]">
            <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden>
              <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.3a18.4 18.4 0 0 0-5.6 0L8.6 3a19.7 19.7 0 0 0-4.9 1.5C.6 9.1-.3 13.6.1 18.1a19.9 19.9 0 0 0 6 3l1.3-2.1a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4c-.7.4-1.3.7-2 1l1.3 2.1a19.8 19.8 0 0 0 6-3c.5-5.2-.9-9.7-3.6-13.7ZM8.5 15.3c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm7 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z" />
            </svg>
            Continuer avec Discord
          </button>
        </form>
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
                  await signIn("dev", { discordId: u.discordId, redirectTo: u.staff?.grade ? "/pro" : callbackUrl });
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
