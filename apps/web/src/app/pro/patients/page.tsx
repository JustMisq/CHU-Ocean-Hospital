import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import { prisma, type Prisma } from "@ocean/db";
import { missingInfo } from "@/lib/characters";
import { requireStaff } from "@/lib/session";
import { formatDate } from "@/lib/time";

export const metadata: Metadata = { title: "Patients" };

const PAGE_SIZE = 50;

export default async function PatientsPage({ searchParams }: PageProps<"/pro/patients">) {
  await requireStaff("patients.history");
  const { q: rawQ } = await searchParams;
  const q = typeof rawQ === "string" ? rawQ.trim() : "";

  // Chaque mot doit se retrouver dans le prénom ou le nom (« tony russo », « russo »…).
  const where: Prisma.CharacterWhereInput = {
    AND: q
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => ({ OR: [{ firstName: { contains: word, mode: "insensitive" } }, { lastName: { contains: word, mode: "insensitive" } }] })),
  };
  const patients = await prisma.character.findMany({
    where,
    include: {
      appointments: { where: { status: "COMPLETED" }, orderBy: { start: "desc" }, take: 1, select: { start: true } },
      _count: { select: { appointments: { where: { status: "COMPLETED" } } } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: PAGE_SIZE,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">Patients</h1>
      <p className="mt-1 text-sm text-muted">Dossiers de tous les personnages : infos médicales et historique des consultations.</p>

      <form className="mt-6 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Prénom, nom…" className="input sm:max-w-sm" />
        <button className="btn-secondary">Rechercher</button>
      </form>

      <ul className="card mt-4 divide-y divide-line">
        {patients.map((p) => {
          const missing = missingInfo(p);
          return (
            <li key={p.id}>
              <Link href={`/pro/patients/${p.id}`} className="flex items-center gap-4 p-4 hover:bg-ocean-50/50">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 font-medium">
                    {p.firstName} {p.lastName}
                    {p.archivedAt && <span className="rounded-full bg-canvas px-2 py-0.5 text-xs font-medium text-muted">Archivé</span>}
                    {missing.length > 0 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">Incomplet</span>}
                  </span>
                  <span className="block text-sm text-muted">
                    {[p.bloodType, p.birthDate && `né(e) le ${formatDate(p.birthDate)}`].filter(Boolean).join(" · ") || "Infos non renseignées"}
                  </span>
                </span>
                <span className="hidden text-right text-xs text-muted sm:block">
                  {p._count.appointments} consultation{p._count.appointments > 1 ? "s" : ""}
                  {p.appointments[0] && <span className="block">dernière le {formatDate(p.appointments[0].start)}</span>}
                </span>
                <ChevronRight className="size-4 text-muted" />
              </Link>
            </li>
          );
        })}
        {patients.length === 0 && <li className="p-8 text-center text-sm text-muted">Aucun patient{q && " ne correspond à cette recherche"}.</li>}
      </ul>
      {patients.length === PAGE_SIZE && <p className="mt-3 text-xs text-muted">Seuls les {PAGE_SIZE} premiers résultats sont affichés : affinez la recherche.</p>}
    </div>
  );
}
