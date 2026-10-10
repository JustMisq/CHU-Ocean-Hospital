import type { Character } from "@ocean/db";
import { BLOOD_TYPES, SEXES } from "@/lib/characters";

const isoDate = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

/** Ce que le soignant observe quand on ne connaît pas (bien) la personne : dossiers sans compte. */
export function ObservationFields({ character }: { character?: Partial<Character> }) {
  return (
    <>
      <div>
        <label className="label" htmlFor="apparentAge">Âge apparent</label>
        <input id="apparentAge" name="apparentAge" maxLength={30} defaultValue={character?.apparentAge ?? ""} placeholder="Ex : 30-35 ans" className="input sm:max-w-48" />
      </div>
      <div>
        <label className="label" htmlFor="description">Signes distinctifs / circonstances</label>
        <textarea
          id="description"
          name="description"
          rows={2}
          maxLength={600}
          defaultValue={character?.description ?? ""}
          placeholder="Ex : tatouage serpent avant-bras gauche, veste rouge ; retrouvé inconscient Grove Street"
          className="input"
        />
      </div>
    </>
  );
}

/** Infos complémentaires d'un dossier (formulaire patient et formulaire soignant). */
export function MedicalFields({ character, idPrefix = "" }: { character?: Partial<Character>; idPrefix?: string }) {
  const id = (name: string) => `${idPrefix}${name}`;
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor={id("birthDate")}>Date de naissance</label>
          <input id={id("birthDate")} name="birthDate" type="date" defaultValue={isoDate(character?.birthDate)} className="input" />
        </div>
        <div>
          <label className="label" htmlFor={id("bloodType")}>Groupe sanguin</label>
          <select id={id("bloodType")} name="bloodType" defaultValue={character?.bloodType ?? ""} className="input">
            <option value="">Inconnu</option>
            {BLOOD_TYPES.map((b) => <option key={b}>{b}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor={id("sex")}>Sexe</label>
          <select id={id("sex")} name="sex" defaultValue={character?.sex ?? ""} className="input">
            <option value="">Non précisé</option>
            {Object.entries(SEXES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={id("phone")}>Téléphone (en jeu)</label>
          <input id={id("phone")} name="phone" maxLength={20} defaultValue={character?.phone ?? ""} placeholder="555-0123" className="input" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor={id("allergies")}>Allergies / antécédents</label>
        <textarea id={id("allergies")} name="allergies" rows={2} maxLength={300} defaultValue={character?.allergies ?? ""} className="input" />
      </div>
    </>
  );
}
