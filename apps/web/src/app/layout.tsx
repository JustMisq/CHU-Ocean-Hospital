import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { getSettings } from "@/lib/session";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const { hospitalName } = await getSettings();
  return {
    title: { default: `${hospitalName} — Prise de rendez-vous`, template: `%s · ${hospitalName}` },
    description: `Prenez rendez-vous avec les soignants de ${hospitalName}.`,
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const settings = await getSettings();
  return (
    <html lang="fr" className={`${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line bg-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted sm:flex-row sm:justify-between">
            <p>© {settings.hospitalName} — serveur RP. Établissement fictif.</p>
            <p>{settings.emergencyNote}</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
