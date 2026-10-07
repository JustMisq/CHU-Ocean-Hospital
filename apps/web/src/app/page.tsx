import Link from "next/link";
import { ArrowRight, CalendarDays, ClipboardList, Search, ShieldCheck } from "lucide-react";
import { prisma } from "@ocean/db";
import { ServiceIcon } from "@/components/service-icon";
import { discordEnabled } from "@/lib/features";
import { getSettings } from "@/lib/session";
import { bookableStaffWhere } from "@/lib/slots";

export default async function HomePage() {
  const [services, staffCount, settings] = await Promise.all([
    prisma.service.findMany({
      where: { isPublic: true },
      orderBy: { order: "asc" },
      include: { _count: { select: { staff: { where: bookableStaffWhere } } } },
    }),
    prisma.staffProfile.count({ where: bookableStaffWhere }),
    getSettings(),
  ]);

  return (
    <>
      <section className="relative overflow-hidden bg-ocean-700 text-white">
        <div
          aria-hidden
          className="absolute inset-0 opacity-30"
          style={{ background: "radial-gradient(60rem 30rem at 85% 120%, #35a9d3, transparent), radial-gradient(40rem 20rem at 0% 0%, #0a2738, transparent)" }}
        />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <p className="mb-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-ocean-100">
            {staffCount} soignants disponibles
          </p>
          <h1 className="max-w-2xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            {settings.tagline}
          </h1>
          <p className="mt-4 max-w-xl text-lg text-ocean-100">
            Prenez rendez-vous avec les soignants de {settings.hospitalName}, consultez vos comptes rendus et gérez vos personnages.
          </p>

          <form action="/medecins" className="mt-8 flex max-w-2xl flex-col gap-2 rounded-2xl bg-white p-2 shadow-xl sm:flex-row">
            <div className="flex flex-1 items-center gap-2 px-3">
              <Search className="size-5 text-muted" />
              <input name="q" placeholder="Nom du soignant…" className="w-full py-2.5 text-ink outline-none placeholder:text-muted" />
            </div>
            <select name="service" className="rounded-xl border border-line px-3 py-2.5 text-sm text-ink sm:border-0 sm:border-l sm:rounded-none">
              <option value="">Tous les services</option>
              {services.map((s) => (
                <option key={s.id} value={s.slug}>{s.name}</option>
              ))}
            </select>
            <button className="btn-primary">Rechercher</button>
          </form>
        </div>
      </section>

      <section id="services" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
        <h2 className="text-2xl font-bold">Nos services</h2>
        <p className="mt-1 text-muted">Choisissez un service pour voir les soignants et leurs disponibilités.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <Link key={s.id} href={`/medecins?service=${s.slug}`} className="card group flex gap-4 p-5 transition hover:border-ocean-300 hover:shadow-md">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-ocean-50 text-ocean-600">
                <ServiceIcon name={s.icon} className="size-6" />
              </span>
              <span>
                <span className="flex items-center gap-1 font-semibold">
                  {s.name}
                  <ArrowRight className="size-4 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                </span>
                <span className="mt-1 block text-sm text-muted">{s.description}</span>
                <span className="mt-2 block text-xs font-medium text-ocean-600">
                  {s._count.staff} soignant{s._count.staff > 1 ? "s" : ""}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-3">
          {[
            { icon: Search, title: "Trouvez un soignant", text: "Filtrez par spécialité et consultez les fiches de l'équipe." },
            { icon: CalendarDays, title: "Réservez un créneau", text: "Choisissez un horaire libre pour l'un de vos personnages." },
            { icon: ClipboardList, title: "Suivez vos soins", text: "Retrouvez vos rendez-vous et les comptes rendus de consultation." },
          ].map(({ icon: Icon, title, text }, i) => (
            <div key={title} className="flex gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ocean-600 text-sm font-bold text-white">{i + 1}</span>
              <div>
                <h3 className="flex items-center gap-2 font-semibold"><Icon className="size-4 text-ocean-600" />{title}</h3>
                <p className="mt-1 text-sm text-muted">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="card flex flex-col items-start gap-4 p-8 sm:flex-row sm:items-center">
          <ShieldCheck className="size-10 shrink-0 text-ocean-600" />
          <div className="flex-1">
            <h2 className="text-lg font-bold">Vous faites partie du personnel ?</h2>
            <p className="text-sm text-muted">
              {discordEnabled
                ? "Connectez-vous avec Discord : votre accès pro est attribué automatiquement selon vos rôles sur le serveur."
                : "Connectez-vous avec l'identifiant fourni par la direction pour accéder à votre agenda et à vos patients."}
            </p>
          </div>
          <Link href="/pro" className="btn-primary">Espace pro</Link>
        </div>
      </section>
    </>
  );
}
