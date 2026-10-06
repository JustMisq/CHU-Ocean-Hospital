import type { Metadata } from "next";
import { prisma, type Service } from "@ocean/db";
import { ActionForm, SubmitButton } from "@/components/forms";
import { SERVICE_ICONS, ServiceIcon } from "@/components/service-icon";
import { deleteService, saveService } from "@/lib/actions/config";
import { ConfigItem, DeleteButton, RoleIdsField } from "../shared";

export const metadata: Metadata = { title: "Services" };

export default async function ServicesConfigPage() {
  const services = await prisma.service.findMany({ orderBy: { order: "asc" }, include: { _count: { select: { staff: true } } } });

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <ul className="space-y-2">
        {services.map((s) => (
          <li key={s.id}>
            <ConfigItem
              title={<><ServiceIcon name={s.icon} className="size-4 text-ocean-600" /> {s.name} {!s.isPublic && <span className="text-xs font-normal text-muted">(masqué)</span>}</>}
              subtitle={`${s._count.staff} membre(s) · ordre ${s.order}`}
              roleIds={s.discordRoleIds}
            >
              <ServiceForm service={s} />
              <div className="mt-4 border-t border-line pt-4">
                <DeleteButton action={deleteService} id={s.id} message={`Supprimer le service « ${s.name} » ? Les RDV passés sont conservés.`} />
              </div>
            </ConfigItem>
          </li>
        ))}
        {services.length === 0 && <li className="card p-8 text-center text-sm text-muted">Aucun service.</li>}
      </ul>

      <div className="card h-fit p-5">
        <h2 className="mb-4 font-bold">Nouveau service</h2>
        <ServiceForm />
      </div>
    </div>
  );
}

function ServiceForm({ service }: { service?: Service }) {
  return (
    <ActionForm action={saveService} className="space-y-4" resetOnSuccess={!service}>
      {service && <input type="hidden" name="id" value={service.id} />}
      <div>
        <label className="label">Nom</label>
        <input name="name" required defaultValue={service?.name} className="input" />
      </div>
      <div>
        <label className="label">Description (page publique)</label>
        <textarea name="description" rows={2} maxLength={300} defaultValue={service?.description} className="input" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Icône</label>
          <select name="icon" defaultValue={service?.icon ?? "stethoscope"} className="input">
            {Object.entries(SERVICE_ICONS).map(([key, [label]]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Ordre d&apos;affichage</label>
          <input name="order" type="number" defaultValue={service?.order ?? 0} className="input" />
        </div>
      </div>
      <RoleIdsField defaultValue={service?.discordRoleIds} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isPublic" defaultChecked={service?.isPublic ?? true} className="size-4 accent-ocean-600" />
        Visible sur le site public
      </label>
      <SubmitButton>{service ? "Enregistrer" : "Créer le service"}</SubmitButton>
    </ActionForm>
  );
}
