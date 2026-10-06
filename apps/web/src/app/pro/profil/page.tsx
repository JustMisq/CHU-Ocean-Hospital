import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@ocean/db";
import { ActionForm, SubmitButton } from "@/components/forms";
import { GradeBadge } from "@/components/grade-badge";
import { updateOwnProfile } from "@/lib/actions/pro";
import { requireStaff } from "@/lib/session";

export const metadata: Metadata = { title: "Mon profil" };

export default async function ProfilePage() {
  const { staff } = await requireStaff();
  const links = await prisma.staffProfile.findUniqueOrThrow({
    where: { id: staff.id },
    select: { services: { orderBy: { order: "asc" } }, specialties: { orderBy: { order: "asc" } } },
  });

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold">Mon profil public</h1>
      <p className="mt-1 text-sm text-muted">
        Ces informations apparaissent sur <Link href={`/medecins/${staff.id}`} className="text-ocean-600 hover:underline">votre fiche</Link>.
      </p>

      <div className="card mt-6 space-y-3 p-6 text-sm">
        <p className="flex items-center gap-2"><span className="w-24 text-muted">Grade</span> {staff.grade ? <GradeBadge grade={staff.grade} /> : "—"}</p>
        <p className="flex gap-2"><span className="w-24 shrink-0 text-muted">Services</span> {links.services.map((s) => s.name).join(", ") || "—"}</p>
        <p className="flex gap-2"><span className="w-24 shrink-0 text-muted">Spécialités</span> {links.specialties.map((s) => s.name).join(", ") || "—"}</p>
        <p className="text-xs text-muted">Attribués via vos rôles Discord ou par la gestion du personnel.</p>
      </div>

      <ActionForm action={updateOwnProfile} className="card mt-4 space-y-4 p-6">
        <div>
          <label className="label" htmlFor="displayName">Nom affiché</label>
          <input id="displayName" name="displayName" required minLength={2} maxLength={60} defaultValue={staff.displayName} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="bio">Présentation</label>
          <textarea id="bio" name="bio" rows={5} maxLength={1000} defaultValue={staff.bio ?? ""} className="input" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isPublic" defaultChecked={staff.isPublic} className="size-4 accent-ocean-600" />
          Apparaître dans l&apos;annuaire public et être réservable
        </label>
        <SubmitButton>Enregistrer</SubmitButton>
      </ActionForm>
    </div>
  );
}
