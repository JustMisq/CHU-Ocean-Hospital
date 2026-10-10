"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Plus, RotateCcw, Trash, TriangleAlert, ZoomOut } from "lucide-react";
import { ALL_LAYERS, LAYERS, type Layer, type Modality, type RegionArt } from "@/lib/imaging/anatomy";
import {
  CT_OPTIONS, DEFAULT_RADIO_VIEWS, findingText, LESION_BY_ID, lesionsFor, MODALITIES, MRI_PLANES, MRI_SEQUENCES, optionsFor, RADIO_VIEWS,
  suggestConclusion, techniqueText, type Finding, type ImagingData,
} from "@/lib/imaging/catalog";
import { REGIONS } from "@/lib/imaging/regions";
import { CONTRAST_LABELS, contrastsFor, type Contrast } from "@/lib/imaging/render";
import { slicesIn } from "@/lib/imaging/slices";
import { BodyMap, type MapRender } from "./body-map";
import { BodyOverview } from "./body-overview";
import { SliceView } from "./slice-view";

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Illustrations détaillées déjà chargées (par région), partagées entre les éditeurs ouverts. */
const artCache = new Map<string, RegionArt>();

export function ImagingEditor() {
  const [modality, setModality] = useState<Modality>("RADIO");
  /** Région examinée (null : choix sur la silhouette) et côté pour les régions paires. */
  const [regionId, setRegionId] = useState<string | null>(null);
  const [side, setSide] = useState<"D" | "G" | null>(null);
  const [focus, setFocus] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [zone, setZone] = useState("");
  /** Image de l'examen (radio / scanner / IRM) ou atlas anatomique, et systèmes affichés. */
  const [render, setRender] = useState<MapRender>("exam");
  const [layers, setLayers] = useState<Layer[]>(ALL_LAYERS);
  /** Illustrations détaillées chargées (par région). */
  const [arts, setArts] = useState<Record<string, RegionArt>>({});

  const [views, setViews] = useState<string[]>(["Face", "Profil"]);
  const [injection, setInjection] = useState("sans");
  const [reconstructions, setReconstructions] = useState<string[]>(["Reconstructions multiplanaires (MPR)"]);
  const [sequences, setSequences] = useState<string[]>(["T1", "DP Fat-Sat (densité de protons)"]);
  const [planes, setPlanes] = useState<string[]>(["Axial", "Coronal"]);
  const [contrast, setContrast] = useState<Contrast>("CT_SOFT");
  const [sliceIndex, setSliceIndex] = useState(0);

  const [findings, setFindings] = useState<Finding[]>([]);
  const [lesion, setLesion] = useState("");
  const [options, setOptions] = useState<Record<string, string>>({});
  const [size, setSize] = useState("");
  const [note, setNote] = useState("");

  const [indication, setIndication] = useState("");
  const [results, setResults] = useState("");
  const [conclusion, setConclusion] = useState("");

  const region = regionId ? REGIONS.get(regionId) ?? null : null;
  const numbers = useMemo(() => new Map(findings.map((f, i) => [f.id, i + 1])), [findings]);

  // Atlas détaillé : chargé à la première demande (puis gardé en mémoire).
  useEffect(() => {
    if (!region?.loadArt || render !== "atlas" || artCache.has(region.id)) return;
    let alive = true;
    region.loadArt().then((a) => {
      artCache.set(region.id, a);
      if (alive) setArts((m) => ({ ...m, [region.id]: a }));
    });
    return () => {
      alive = false;
    };
  }, [region, render]);
  const art = region ? arts[region.id] ?? artCache.get(region.id) ?? null : null;

  const changeModality = (m: Modality) => {
    setModality(m);
    if (region) {
      setContrast(contrastsFor(m, region.id)[0] ?? "CT_SOFT");
      setLayers(region.layersFor(m));
    }
    // Les lésions déjà notées restent si l'examen les voit ; sinon on les retire.
    setFindings((fs) => fs.filter((f) => lesionsFor(f.structure, m).some((l) => l.id === f.lesion)));
    setLesion("");
  };

  /** Zone examinée : les incidences radio proposées en dépendent (épaule : Lamy, Garth…). */
  const changeZone = (z: string) => {
    setZone(z);
    setViews((RADIO_VIEWS[z] ?? DEFAULT_RADIO_VIEWS).slice(0, 2));
  };
  const goTo = (id: string) => {
    setFocus(id);
    setSliceIndex(0);
    if (!region) return;
    const z = region.zoneOf(id);
    if (z !== region.root.id && z !== zone) changeZone(z);
  };
  const select = (id: string) => {
    setSelected(id);
    setLesion("");
    setOptions({});
  };

  /** Choix sur la silhouette : région (et côté). Changer de région efface les lésions d'une autre région. */
  const pick = (id: string, s: "D" | "G" | null) => {
    const next = REGIONS.get(id);
    if (!next) return;
    if (id !== regionId && findings.length && !window.confirm("Changer de région efface les lésions déjà notées. Continuer ?")) return;
    if (id !== regionId) {
      setFindings([]);
      setSelected(null);
    }
    setRegionId(id);
    setSide(next.bilateral ? s : null);
    setFocus(next.root.id);
    setSliceIndex(0);
    changeZone(next.root.id);
    setLayers(next.layersFor(modality));
    setContrast(contrastsFor(modality, id)[0] ?? "CT_SOFT");
  };

  if (!region) {
    return (
      <div className="space-y-4">
        <ModalityPicker modality={modality} onChange={changeModality} />
        <BodyOverview onPick={pick} />
        <input type="hidden" name="imaging" value="" />
      </div>
    );
  }

  const data: ImagingData = {
    modality, ...(region.bilateral && side && { side }), zone, views, injection, reconstructions, sequences, planes, indication, findings, results, conclusion,
  };

  // Coupes de la zone affichée (scanner / IRM).
  const ys = region.nodePoints(focus).map((p) => p[1]);
  const slices = slicesIn(region.slices, Math.min(...ys), Math.max(...ys));
  const slice = slices[Math.min(sliceIndex, slices.length - 1)];
  const sectional = modality !== "RADIO" && Boolean(slice);
  const contrasts = contrastsFor(modality, region.id);

  const selectedNode = selected ? region.byId.get(selected) : null;
  const available = selected ? lesionsFor(selected, modality) : [];
  const lesionType = LESION_BY_ID.get(lesion);
  const lesionOptions = lesionType && selected ? optionsFor(lesionType, selected) : [];
  const children = region.childrenOf(focus).filter((c) => region.visibleIn(c.id, modality, layers));
  const injected = modality === "SCANNER" && injection !== "sans";
  const trail = region.ancestry(focus);
  const sideLabel = region.bilateral && side ? (side === "D" ? " droit" : " gauche") : "";
  const regionLayers = region.layersFor(modality);
  /** Calques présents dans la région, quel que soit l'examen (ceux que l'examen ne voit pas sont grisés). */
  const presentLayers = ALL_LAYERS.filter((l) => (["RADIO", "SCANNER", "IRM"] as Modality[]).some((m) => region.layersFor(m).includes(l)));

  const addFinding = () => {
    if (!selected || !lesionType) return;
    setFindings([...findings, { id: crypto.randomUUID(), structure: selected, lesion, options, ...(size && { size }), ...(note.trim() && { note: note.trim() }) }]);
    setLesion("");
    setOptions({});
    setSize("");
    setNote("");
  };

  /** Lésion sur la structure sélectionnée + liste des lésions. */
  const lesionPanel = (
      <section className="rounded-xl border border-line p-4">
        {!selectedNode ? (
          <p className="text-sm text-muted">Sélectionnez une structure (sur la carte, la coupe ou la liste) pour y décrire une lésion.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">
              <span className="font-semibold">{selectedNode.label}</span>{" "}
              <span className="text-muted">— {region.ancestry(selectedNode.id).slice(1, -1).map((n) => n.label).join(" › ")}</span>
            </p>
            {available.length === 0 ? (
              <p className="text-sm text-amber-800">
                Rien d&apos;analysable sur cette structure en {MODALITIES[modality].short.toLowerCase()} :{" "}
                {modality === "RADIO" ? "les tissus mous se voient au scanner ou à l'IRM." : "choisissez une structure plus précise ou un autre examen."}
              </p>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <select value={lesion} onChange={(e) => { setLesion(e.target.value); setOptions({}); }} className="input">
                    <option value="">Type de lésion…</option>
                    {available.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                  </select>
                  {lesionOptions.map((o) => (
                    <select key={o.name} value={options[o.name] ?? ""} onChange={(e) => setOptions({ ...options, [o.name]: e.target.value })} className="input">
                      <option value="">{o.label}…</option>
                      {o.choices.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  ))}
                  {lesion && (
                    <>
                      <input value={size} onChange={(e) => setSize(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="Taille en mm (facultatif)" className="input" />
                      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Précision (facultatif)" className="input sm:col-span-2" />
                    </>
                  )}
                </div>
                {lesionType?.warning && (
                  <p className="flex items-start gap-2 text-xs text-amber-800"><TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> {lesionType.warning}</p>
                )}
                <button type="button" onClick={addFinding} disabled={!lesionType} className="btn-secondary">
                  <Plus className="size-4" /> Ajouter la lésion
                </button>
              </>
            )}
          </div>
        )}

        {findings.length > 0 && (
          <ol className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
            {findings.map((f, i) => (
              <li key={f.id} className="flex items-start gap-2">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">{i + 1}</span>
                <button type="button" onClick={() => { goTo(region.byId.get(f.structure)?.parent ?? region.root.id); select(f.structure); }} className="flex-1 text-left hover:underline">
                  {findingText(f)}
                </button>
                <button type="button" onClick={() => setFindings(findings.filter((x) => x.id !== f.id))} className="text-muted hover:text-red-700" aria-label="Retirer">
                  <Trash className="size-4" />
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>
  );

  return (
    <div className="space-y-6">
      <input type="hidden" name="imaging" value={JSON.stringify(data)} />
      <ModalityPicker modality={modality} onChange={changeModality} />

      {/* Paramètres techniques propres à l'examen. */}
      <section className="rounded-xl border border-line p-4">
        <p className="label">Technique</p>
        {modality === "RADIO" && (
          <Chips label="Incidences" all={RADIO_VIEWS[zone] ?? DEFAULT_RADIO_VIEWS} values={views} onToggle={(v) => setViews(toggle(views, v))} />
        )}
        {modality === "SCANNER" && (
          <div className="space-y-3">
            <select value={injection} onChange={(e) => setInjection(e.target.value)} className="input sm:max-w-md">
              {CT_OPTIONS.injection.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <Chips label="Reconstructions" all={[...CT_OPTIONS.reconstructions]} values={reconstructions} onToggle={(v) => setReconstructions(toggle(reconstructions, v))} />
          </div>
        )}
        {modality === "IRM" && (
          <div className="space-y-3">
            <Chips label="Séquences" all={MRI_SEQUENCES} values={sequences} onToggle={(v) => setSequences(toggle(sequences, v))} />
            <Chips label="Plans" all={MRI_PLANES} values={planes} onToggle={(v) => setPlanes(toggle(planes, v))} />
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="mriSafety" required className="mt-0.5 size-4 accent-ocean-600" />
              <span>Contre-indications vérifiées (pacemaker, corps étranger métallique, implant non compatible, claustrophobie).</span>
            </label>
          </div>
        )}
        <p className="mt-3 rounded-lg bg-canvas p-2 text-xs text-muted">{techniqueText(data)}</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Navigation : carte de la région. */}
        <section className="space-y-2">
          <nav className="flex flex-wrap items-center gap-1 text-sm">
            <button type="button" onClick={() => setRegionId(null)} className="font-medium text-ocean-600 hover:underline">Corps</button>
            {trail.map((n, i) => (
              <span key={n.id} className="flex items-center gap-1">
                <ChevronRight className="size-3.5 text-muted" />
                {i === trail.length - 1 ? (
                  <span className="font-semibold">{n.label}{n.kind === "region" ? sideLabel : ""}</span>
                ) : (
                  <button type="button" onClick={() => goTo(n.id)} className="font-medium text-ocean-600 hover:underline">
                    {n.label}{n.kind === "region" ? sideLabel : ""}
                  </button>
                )}
              </span>
            ))}
            {trail.length > 1 && (
              <button type="button" onClick={() => goTo(trail[trail.length - 2].id)} className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink">
                <ZoomOut className="size-3.5" /> Dézoomer
              </button>
            )}
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex overflow-hidden rounded-lg border border-line text-xs font-semibold">
              {([["exam", modality === "RADIO" ? "Cliché" : modality === "SCANNER" ? "Image scanner" : "Image IRM"], ["atlas", "Atlas anatomique"]] as const).map(([v, l]) => (
                <button key={v} type="button" onClick={() => setRender(v)} className={`px-2.5 py-1.5 ${render === v ? "bg-ocean-600 text-white" : "hover:bg-canvas"}`}>{l}</button>
              ))}
            </div>
            {contrasts.length > 0 && (
              <select value={contrast} onChange={(e) => setContrast(e.target.value as Contrast)} className="input w-auto py-1 text-xs" aria-label={modality === "IRM" ? "Séquence affichée" : "Fenêtre affichée"}>
                {contrasts.map((c) => <option key={c} value={c}>{CONTRAST_LABELS[c]}</option>)}
              </select>
            )}
          </div>
          {/* Calques : un système à la fois ou plusieurs ; ceux que l'examen ne montre pas sont grisés. */}
          <div className="flex flex-wrap items-center gap-1.5">
            {presentLayers.map((l) => {
              const possible = regionLayers.includes(l);
              const on = layers.includes(l);
              return (
                <button
                  key={l}
                  type="button"
                  disabled={!possible}
                  title={possible ? "Clic : afficher / masquer · double-clic : afficher seul" : `Invisible en ${MODALITIES[modality].short.toLowerCase()}`}
                  onClick={() => setLayers(on ? layers.filter((x) => x !== l) : [...layers, l])}
                  onDoubleClick={() => setLayers([l])}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${!possible ? "cursor-not-allowed border-line text-muted/50 line-through" : on ? "border-ocean-500 bg-ocean-50 text-ocean-700" : "border-line text-muted hover:bg-canvas"}`}
                >
                  {LAYERS[l]}
                </button>
              );
            })}
            {regionLayers.some((l) => !layers.includes(l)) && (
              <button type="button" onClick={() => setLayers(regionLayers)} className="text-xs font-medium text-ocean-600 hover:underline">Tout afficher</button>
            )}
          </div>
          <BodyMap
            region={region}
            art={region.loadArt ? art : undefined}
            side={side}
            modality={modality}
            focus={focus}
            selected={selected}
            findings={findings}
            numbers={numbers}
            render={render}
            contrast={contrast}
            injected={injected}
            layers={layers}
            scanY={sectional ? slice.y : null}
            onFocus={goTo}
            onSelect={select}
          />
          <p className="text-[11px] text-muted">
            Dessins : LadyofHats (domaine public) ; Servier Medical Art, smart.servier.com (CC BY 4.0), adaptés.
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => select(focus)} className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${selected === focus ? "border-amber-400 bg-amber-50" : "border-ocean-200 text-ocean-700 hover:bg-ocean-50"}`}>
              Sélectionner : {region.byId.get(focus)?.label}
            </button>
            {children.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => (region.childrenOf(c.id).some((k) => region.visibleIn(k.id, modality, layers)) ? goTo(c.id) : select(c.id))}
                className={`rounded-full border px-2.5 py-1 text-xs ${selected === c.id ? "border-amber-400 bg-amber-50" : "border-line hover:bg-canvas"}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </section>

        {/* Rendu réaliste : cliché radio, ou coupes scanner / IRM. */}
        <section className="space-y-2">
          {!sectional ? (
            lesionPanel
          ) : (
            <>
              <p className="text-sm font-semibold">Coupes axiales · {CONTRAST_LABELS[contrast]}</p>
              <SliceView
                region={region}
                slice={slice}
                contrast={contrast}
                injected={injected}
                findings={findings}
                numbers={numbers}
                selected={selected}
                side={side}
                onSelect={select}
              />
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted">{region.sliceEnds[0]}</span>
                <input
                  type="range"
                  min={0}
                  max={slices.length - 1}
                  value={Math.min(sliceIndex, slices.length - 1)}
                  onChange={(e) => setSliceIndex(Number(e.target.value))}
                  disabled={slices.length < 2}
                  className="flex-1 accent-ocean-600"
                />
                <span className="text-xs text-muted">{region.sliceEnds[1]}</span>
              </div>
              <p className="text-xs text-muted">
                {slices.length} niveau{slices.length > 1 ? "x" : ""} de coupe dans cette zone. Zoomez sur la carte pour cibler une région ; cliquez dans la coupe pour sélectionner un tissu.
              </p>
            </>
          )}
        </section>
      </div>

      {sectional && lesionPanel}

      {/* Compte rendu. */}
      <section className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div>
            <label className="label" htmlFor="img-indication">Indication (motif de l&apos;examen) *</label>
            <input id="img-indication" value={indication} onChange={(e) => setIndication(e.target.value)} required maxLength={1000} placeholder="Ex : chute sur la main, douleur du poignet, recherche de fracture" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="img-zone">Zone examinée</label>
            <select id="img-zone" value={zone} onChange={(e) => changeZone(e.target.value)} className="input">
              <option value={region.root.id}>{region.root.label} entier</option>
              {region.zones.map((z) => <option key={z.id} value={z.id}>{region.byId.get(z.id)?.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="img-results">Résultats complémentaires (facultatif)</label>
          <textarea id="img-results" value={results} onChange={(e) => setResults(e.target.value)} rows={3} maxLength={3000} placeholder="Éléments négatifs utiles, qualité de l'examen… (les lésions ci-dessus sont reprises automatiquement)" className="input" />
        </div>
        <div>
          <div className="flex items-end justify-between gap-2">
            <label className="label" htmlFor="img-conclusion">Conclusion *</label>
            <button type="button" onClick={() => setConclusion(suggestConclusion(data))} className="mb-1.5 inline-flex items-center gap-1 text-xs font-medium text-ocean-600 hover:underline">
              <RotateCcw className="size-3.5" /> Proposer depuis les lésions
            </button>
          </div>
          <textarea id="img-conclusion" value={conclusion} onChange={(e) => setConclusion(e.target.value)} required rows={3} maxLength={2000} className="input" />
        </div>
      </section>
    </div>
  );
}

function ModalityPicker({ modality, onChange }: { modality: Modality; onChange: (m: Modality) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {(Object.keys(MODALITIES) as Modality[]).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={`rounded-xl border p-3 text-left transition ${modality === m ? "border-ocean-500 bg-ocean-50 ring-1 ring-ocean-500" : "border-line hover:bg-canvas"}`}
        >
          <span className="block font-semibold">{MODALITIES[m].label}</span>
          <span className="block text-xs text-muted">{MODALITIES[m].description}</span>
        </button>
      ))}
    </div>
  );
}

function Chips({ label, all, values, onToggle }: { label: string; all: string[]; values: string[]; onToggle: (v: string) => void }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {all.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onToggle(v)}
            className={`rounded-full border px-2.5 py-1 text-xs ${values.includes(v) ? "border-ocean-500 bg-ocean-50 font-semibold text-ocean-700" : "border-line text-muted hover:bg-canvas"}`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}
