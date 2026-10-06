import Link from "next/link";
import { LogOut, Stethoscope } from "lucide-react";
import { signOut } from "@/auth";
import { getCurrentUser, getSettings } from "@/lib/session";
import { Avatar } from "./avatar";
import { Logo } from "./logo";

export async function SiteHeader() {
  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="shrink-0">
          <Logo name={settings.hospitalName} />
        </Link>
        <nav className="hidden items-center gap-5 text-sm font-medium text-muted md:flex">
          <Link href="/medecins" className="hover:text-ink">Trouver un soignant</Link>
          <Link href="/#services" className="hover:text-ink">Services</Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              {(user.isStaff || user.isAdmin) && (
                <Link href="/pro" className="btn-secondary hidden sm:inline-flex">
                  <Stethoscope className="size-4" /> Espace pro
                </Link>
              )}
              <Link href="/espace" className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-ocean-50">
                <Avatar name={user.username} src={user.avatarUrl} />
                <span className="hidden text-sm font-semibold sm:inline">{user.username}</span>
              </Link>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button className="rounded-full p-2 text-muted hover:bg-ocean-50 hover:text-ink" aria-label="Se déconnecter">
                  <LogOut className="size-4" />
                </button>
              </form>
            </>
          ) : (
            <Link href="/connexion" className="btn-primary">Se connecter</Link>
          )}
        </div>
      </div>
    </header>
  );
}
