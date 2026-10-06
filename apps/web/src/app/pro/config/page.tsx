import type { Metadata } from "next";
import { parseRoleIds, prisma } from "@ocean/db";
import { ActionForm, SubmitButton } from "@/components/forms";
import { saveGeneralSettings } from "@/lib/actions/config";
import { getSettings } from "@/lib/session";

export const metadata: Metadata = { title: "Configuration" };

export default async function GeneralConfigPage() {
  const [s, services, grades, specialties] = await Promise.all([
    getSettings(),
    prisma.service.findMany({ orderBy: { order: "asc" } }),
    prisma.grade.findMany({ orderBy: { order: "desc" } }),
    prisma.specialty.findMany({ orderBy: { order: "asc" } }),
  ]);

  const mapping = [
    ...grades.map((g) => ({ type: "Grade", name: g.name, ids: parseRoleIds(g.discordRoleIds) })),
    ...services.map((x) => ({ type: "Service", name: x.name, ids: parseRoleIds(x.discordRoleIds) })),
    ...specialties.map((x) => ({ type: "Spécialité", name: x.name, ids: parseRoleIds(x.discordRoleIds) })),
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <ActionForm action={saveGeneralSettings} className="space-y-6">
        <section className="card space-y-4 p-6">
          <h2 className="font-bold">Hôpital</h2>
          <Field label="Nom de l'établissement" name="hospitalName" defaultValue={s.hospitalName} />
          <Field label="Accroche de la page d'accueil" name="tagline" defaultValue={s.tagline} />
          <Field label="Message de pied de page" name="emergencyNote" defaultValue={s.emergencyNote} />
        </section>

        <section className="card space-y-4 p-6">
          <h2 className="font-bold">Serveur Discord</h2>
          <Field
            label="ID du serveur Discord"
            name="discordGuildId"
            defaultValue={s.discordGuildId}
            placeholder={process.env.DISCORD_GUILD_ID ? `${process.env.DISCORD_GUILD_ID} (valeur du fichier .env)` : "Ex : 112233445566778899"}
            hint="Discord → Paramètres → Avancés → Mode développeur, puis clic droit sur le serveur → Copier l'identifiant."
          />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="requireGuildMember" defaultChecked={s.requireGuildMember === "true"} className="mt-0.5 size-4 accent-ocean-600" />
            <span>Réserver la connexion aux membres du serveur Discord</span>
          </label>
        </section>

        <section className="card space-y-4 p-6">
          <h2 className="font-bold">Règles de réservation</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fenêtre de réservation (jours)" name="bookingWindowDays" type="number" defaultValue={s.bookingWindowDays} />
            <Field label="Délai minimum (minutes)" name="minNoticeMinutes" type="number" defaultValue={s.minNoticeMinutes} />
            <Field label="RDV à venir max / personnage" name="maxUpcomingPerCharacter" type="number" defaultValue={s.maxUpcomingPerCharacter} />
            <Field label="Personnages max / compte" name="maxCharactersPerUser" type="number" defaultValue={s.maxCharactersPerUser} />
          </div>
        </section>

        <SubmitButton>Enregistrer les réglages</SubmitButton>
      </ActionForm>

      <section className="card h-fit p-6">
        <h2 className="font-bold">Correspondance des rôles Discord</h2>
        <p className="mt-1 text-sm text-muted">
          À chaque connexion, le membre reçoit le <strong>grade le plus haut</strong> parmi ses rôles, et <strong>tous</strong> les services et spécialités correspondants.
          Les IDs se règlent dans chaque onglet.
        </p>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="pb-2 font-medium">Type</th>
              <th className="pb-2 font-medium">Nom</th>
              <th className="pb-2 font-medium">Rôles Discord</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {mapping.map((m) => (
              <tr key={`${m.type}-${m.name}`}>
                <td className="py-2 pr-3 text-muted">{m.type}</td>
                <td className="py-2 pr-3 font-medium">{m.name}</td>
                <td className="py-2 font-mono text-xs">
                  {m.ids.length ? m.ids.join(", ") : <span className="font-sans text-muted">Manuel</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Field({ label, hint, ...props }: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label" htmlFor={props.name}>{label}</label>
      <input id={props.name} className="input" {...props} />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
