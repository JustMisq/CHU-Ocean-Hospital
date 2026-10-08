import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/forms";
import { saveGeneralSettings } from "@/lib/actions/config";
import { getSettings } from "@/lib/session";

export const metadata: Metadata = { title: "Configuration" };

export default async function GeneralConfigPage() {
  const s = await getSettings();

  return (
    <ActionForm action={saveGeneralSettings} className="max-w-2xl space-y-6">
      <section className="card space-y-4 p-6">
        <h2 className="font-bold">Hôpital</h2>
        <Field label="Nom de l'établissement" name="hospitalName" defaultValue={s.hospitalName} />
        <Field label="Accroche de la page d'accueil" name="tagline" defaultValue={s.tagline} />
        <Field label="Message de pied de page" name="emergencyNote" defaultValue={s.emergencyNote} />
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="font-bold">Comptes</h2>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="allowSignup" defaultChecked={s.allowSignup === "true"} className="mt-0.5 size-4 accent-ocean-600" />
          <span>
            Inscription libre des citoyens sur /inscription
            <span className="block text-xs text-muted">Décoché : seuls les comptes créés par la direction (page Personnel) peuvent se connecter.</span>
          </span>
        </label>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="font-bold">Règles de réservation</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fenêtre de réservation (jours)" name="bookingWindowDays" type="number" defaultValue={s.bookingWindowDays} />
          <Field label="Délai minimum pour réserver (minutes)" name="minNoticeMinutes" type="number" defaultValue={s.minNoticeMinutes} />
          <Field label="Délai minimum pour annuler (heures)" name="cancelNoticeHours" type="number" defaultValue={s.cancelNoticeHours} />
          <Field label="RDV à venir max / personnage" name="maxUpcomingPerCharacter" type="number" defaultValue={s.maxUpcomingPerCharacter} />
          <Field label="Personnages max / compte" name="maxCharactersPerUser" type="number" defaultValue={s.maxCharactersPerUser} />
        </div>
      </section>

      <SubmitButton>Enregistrer les réglages</SubmitButton>
    </ActionForm>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label" htmlFor={props.name}>{label}</label>
      <input id={props.name} className="input" {...props} />
    </div>
  );
}
