"use client";

import { useEffect, useId, useMemo, useRef, useState, type PointerEvent, type SVGProps } from "react";
import { hasShape, layerOf, type AnatomyNode, type BoneArt, type Layer, type Modality, type Region, type RegionArt } from "@/lib/imaging/anatomy";
import { pathRole } from "@/lib/imaging/atlas";
import type { Finding } from "@/lib/imaging/catalog";
import { boxOf, type Box } from "@/lib/imaging/geometry";
import { tissueColor, type Contrast } from "@/lib/imaging/render";
import type { Tissue } from "@/lib/imaging/slices";

/**
 * Rendu de la carte :
 * - « atlas » : illustration anatomique (os dessinés, muscles fibrés, nerfs, artères) ;
 * - « exam » : l'image de l'examen lui-même — cliché (radio), reconstruction coronale (scanner), coupe coronale (IRM).
 */
export type MapRender = "atlas" | "exam";

/** Tissu équivalent d'une structure, pour les niveaux de gris scanner / IRM. */
const TISSUE_OF: Partial<Record<AnatomyNode["kind"], Tissue>> = {
  muscle: "muscle", tendon: "tendon", ligament: "ligament", nerve: "nerve", vessel: "artery", cartilage: "cartilage", joint: "joint",
  organ: "liver", viscus: "bowel", lung: "lung", airway: "air", brain: "gm", cord: "cord", disc: "disc",
};
const tissueOfNode = (n: AnatomyNode): Tissue => n.tissue ?? (n.tags?.includes("veine") ? "vein" : TISSUE_OF[n.kind] ?? "muscle");

/**
 * Radio : densité des organes (les poumons, pleins d'air, sont noirs ; cœur et médiastin, denses, sont clairs).
 * Ordre de dessin : poumons, trame vasculaire, organes denses, voies aériennes.
 */
const XRAY: { match: (n: AnatomyNode) => boolean; fill: string; opacity?: number; blur?: boolean }[] = [
  { match: (n) => n.kind === "lung", fill: "#121212", blur: true },
  { match: (n) => n.kind === "vessel" && Boolean(n.tags?.includes("artere-pulmonaire") || n.id === "veines-pulmonaires"), fill: "#4a4a4a", opacity: 0.55 },
  { match: (n) => (n.kind === "organ" || n.tags?.includes("aorte") === true) && n.modalities.includes("RADIO"), fill: "#a8a8a8", blur: true },
  { match: (n) => n.kind === "airway", fill: "#141414", opacity: 0.8 },
  // Abdomen : ombres des organes pleins et des psoas (légèrement plus denses que la graisse), gaz digestif (noir).
  { match: (n) => Boolean(n.tags?.includes("ombre")), fill: "#8a8a8a", opacity: 0.45, blur: true },
  { match: (n) => Boolean(n.tags?.includes("gaz")), fill: "#161616", opacity: 0.55, blur: true },
];

/** Couleurs « atlas » par type de structure : remplissage / contour (gaine). */
const ATLAS: Partial<Record<AnatomyNode["kind"], { fill: string; casing: string }>> = {
  muscle: { fill: "#c65a55", casing: "#7f2622" },
  tendon: { fill: "#efe8d6", casing: "#9a8b68" },
  ligament: { fill: "#ddd2b8", casing: "#8c7c58" },
  cartilage: { fill: "#a7d8e8", casing: "#2b7a94" },
  nerve: { fill: "#f6cf3f", casing: "#8a6500" },
  vessel: { fill: "#d63a2f", casing: "#6e0f0a" },
  joint: { fill: "#93c5fd", casing: "#1d4ed8" },
  cavity: { fill: "#cfe8f3", casing: "#6aa9c4" },
  cord: { fill: "#f4d35e", casing: "#9a7400" },
  brain: { fill: "#f2c4cf", casing: "#a8576b" },
  disc: { fill: "#a5c7e0", casing: "#4a7fa8" },
  organ: { fill: "#c98b8b", casing: "#7a3d3d" },
  viscus: { fill: "#f3c9c0", casing: "#a8665a" },
};

/** Veines (atlas). */
const VEIN = { fill: "#3d6fd6", casing: "#173a80" };

/** Calques d'illustration dessinés au-dessus des os, dans cet ordre. */
const ART_ORDER: Layer[] = ["muscles", "tendons", "organes", "vaisseaux", "nerfs"];

/** Formes à dessiner pour un nœud : la sienne, ou celles de ses descendants visibles (groupes). */
function shapesOf(region: Region, node: AnatomyNode, modality: Modality, layers: readonly Layer[]): AnatomyNode[] {
  if (hasShape(node)) return [node];
  return region.childrenOf(node.id).filter((c) => region.visibleIn(c.id, modality, layers)).flatMap((c) => shapesOf(region, c, modality, layers));
}

const hasVisibleChildren = (region: Region, id: string, modality: Modality, layers: readonly Layer[]) =>
  region.childrenOf(id).some((c) => region.visibleIn(c.id, modality, layers) && (hasShape(c) || region.childrenOf(c.id).length));

/** Os dessiné, avec ses couleurs d'origine (découpé si besoin : moitié de bassin…). */
function ArtBone({ bone, clip, opacity = 1 }: { bone: BoneArt; clip?: string; opacity?: number }) {
  return (
    <g clipPath={clip} opacity={opacity}>
      <g transform={bone.transform}>
        {bone.paths.map((p, i) => <path key={i} d={p.d} fill={p.fill} stroke={p.stroke} strokeWidth={p.sw} />)}
      </g>
    </g>
  );
}

/** Os restylé en radio : os clair, corticale brillante. */
function XrayBone({ bone, clip, intensity = 1 }: { bone: BoneArt; clip?: string; intensity?: number }) {
  return (
    <g clipPath={clip} style={{ mixBlendMode: "screen" }} opacity={intensity}>
      <g transform={bone.transform}>
        {bone.paths.map((p, i) => {
          const role = pathRole(p);
          if (role === "base") return <path key={i} d={p.d} fill="#c8c8c8" fillOpacity={0.86} stroke="#f4f4f4" strokeWidth={(p.sw ?? 0.35) * 2.2} />;
          if (role === "skip") return null;
          if (role === "shade") return <path key={i} d={p.d} fill="#eeeeee" fillOpacity={0.45} />;
          return <path key={i} d={p.d} fill="none" stroke="#fafafa" strokeWidth={p.sw ?? 0.3} />;
        })}
      </g>
    </g>
  );
}

/** Contours de base d'un os (surlignage, zone de clic, rendu scanner / IRM). */
function ArtBase({ bone, clip, ...props }: { bone: BoneArt; clip?: string } & SVGProps<SVGPathElement>) {
  return (
    <g clipPath={clip}>
      <g transform={bone.transform}>
        {bone.paths.filter((p) => pathRole(p) === "base").map((p, i) => <path key={i} d={p.d} {...props} />)}
      </g>
    </g>
  );
}

export function BodyMap({
  region, art, side, modality, focus, selected, findings, numbers, render, contrast = "CT_SOFT", injected = false, layers, scanY, onFocus, onSelect,
}: {
  region: Region;
  /** Illustration détaillée de la région (atlas), chargée à part. */
  art?: RegionArt | null;
  side: "D" | "G" | null;
  modality: Modality;
  focus: string;
  selected: string | null;
  findings: Finding[];
  numbers: Map<string, number>;
  render: MapRender;
  /** Fenêtre (scanner) ou séquence (IRM) du rendu « examen ». */
  contrast?: Contrast;
  injected?: boolean;
  /** Systèmes affichés et sélectionnables. */
  layers: readonly Layer[];
  /** Niveau de la coupe affichée (scanner / IRM) : ligne sur la carte. */
  scanY?: number | null;
  onFocus: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const uid = useId().replace(/:/g, "");
  const mirrored = region.bilateral && side === "G";
  const { aspect, unit: u } = region;
  const frame = (id: string) => region.frameOf(id, mirrored, aspect);
  const svgRef = useRef<SVGSVGElement>(null);
  const [box, setBox] = useState<Box>(() => frame(focus));
  const [hover, setHover] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; box: Box; moved: boolean } | null>(null);
  const boxRef = useRef(box);
  useEffect(() => {
    boxRef.current = box;
  }, [box]);

  // Zoom animé vers la zone choisie.
  useEffect(() => {
    const from = boxRef.current;
    const target = region.frameOf(focus, mirrored, aspect);
    const start = performance.now();
    let frameId = requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - start) / 420);
      const e = 1 - Math.pow(1 - t, 3);
      setBox(from.map((v, i) => v + (target[i] - v) * e) as Box);
      if (t < 1) frameId = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frameId);
  }, [region, focus, mirrored, aspect]);

  // Molette : zoom autour du curseur (comme une carte). Écouteur natif non passif, pour ne pas faire défiler la page.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: globalThis.WheelEvent) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const [x, y, w, h] = boxRef.current;
      const px = x + ((e.clientX - rect.left) / rect.width) * w;
      const py = y + ((e.clientY - rect.top) / rect.height) * h;
      const nw = Math.min(1400 * u, Math.max(20 * u, w * Math.exp(e.deltaY * 0.0015)));
      const nh = nw / aspect;
      setBox([px - ((px - x) * nw) / w, py - ((py - y) * nh) / h, nw, nh]);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [u, aspect]);

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    drag.current = { x: e.clientX, y: e.clientY, box, moved: false };
  };
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    if (!d.moved) svgRef.current?.setPointerCapture(e.pointerId);
    d.moved = true;
    const rect = svgRef.current!.getBoundingClientRect();
    setBox([d.box[0] - (dx / rect.width) * d.box[2], d.box[1] - (dy / rect.height) * d.box[3], d.box[2], d.box[3]]);
  };
  const endDrag = () => setTimeout(() => (drag.current = null), 0);

  const choose = (id: string) => {
    if (drag.current?.moved) return;
    if (hasVisibleChildren(region, id, modality, layers)) onFocus(id);
    else onSelect(id);
  };

  const interactive = useMemo(
    () =>
      region.childrenOf(focus)
        .filter((c) => region.visibleIn(c.id, modality, layers))
        .map((c) => ({ node: c, shapes: shapesOf(region, c, modality, layers) }))
        .filter((c) => c.shapes.length),
    [region, focus, modality, layers],
  );
  /** Tissus mous des calques affichés (vus par cet examen). */
  const soft = useMemo(
    () =>
      region.nodes.filter((n) => {
        const layer = layerOf(n.kind);
        return n.d && layer && layer !== "os" && layers.includes(layer) && n.modalities.includes(modality);
      }),
    [region, modality, layers],
  );
  const joints = useMemo(() => region.nodes.filter((n) => n.kind === "joint" && n.d), [region]);
  /** Os dessinés à part (absents de la planche, ex : calcanéum caché derrière le talus). */
  const drawnBones = useMemo(() => region.nodes.filter((n) => n.draw && n.d && (n.kind === "bone" || n.kind === "part")), [region]);
  const bones = Object.entries(region.bones);
  const boneClip = (id: string) => (region.bones[id].clip ? `url(#bclip-${uid}-${id})` : undefined);

  const showBones = layers.includes("os");
  const mode: "atlas" | "xray" | "tissue" = render === "atlas" ? "atlas" : modality === "RADIO" ? "xray" : "tissue";
  const dark = mode !== "atlas";
  const unit = box[2] / 100; // taille « écran » constante pour les repères
  const mirror = mirrored ? `translate(${region.mirror},0) scale(-1,1)` : undefined;
  const skin = region.skin;
  const tc = (t: Tissue) => tissueColor(t, contrast, injected);

  /** Surlignage (survol / sélection) et zone de clic d'une forme, quel que soit le rendu. */
  const overlay = (n: AnatomyNode, isHover: boolean, isSel: boolean, hit = false) => {
    const accent = isSel ? "#f59e0b" : isHover ? "#ef4444" : null;
    const clip = n.clip ? `url(#clip-${uid}-${n.id})` : undefined;
    const bone = n.art ? region.bones[n.art] : undefined;
    if (bone) {
      const bclip = n.art ? boneClip(n.art) : undefined;
      return (
        <g clipPath={clip}>
          {hit ? (
            <ArtBase bone={bone} clip={bclip} fill="transparent" pointerEvents="all" />
          ) : accent ? (
            <ArtBase bone={bone} clip={bclip} fill={accent} fillOpacity={0.45} stroke={accent} strokeWidth={0.8 * u} pointerEvents="none" />
          ) : mode === "atlas" && n.kind === "part" ? (
            <ArtBase bone={bone} clip={bclip} fill="#0a6f98" fillOpacity={0.06} stroke="#0a6f98" strokeOpacity={0.4} strokeWidth={0.5 * u} pointerEvents="none" />
          ) : null}
        </g>
      );
    }
    if (hit) {
      if (n.stroke) return <path d={n.d} clipPath={clip} fill="none" stroke="transparent" strokeWidth={Math.max(n.stroke, 9 * u)} pointerEvents="stroke" />;
      return <path d={n.d} clipPath={clip} fill="transparent" stroke="transparent" strokeWidth={n.hit ?? 0} pointerEvents="all" />;
    }
    if (!accent) {
      // Segments : léger contour pour voir où cliquer.
      if (n.kind === "segment") return <path d={n.d} fill="none" stroke={dark ? "#ffffff" : "#0a6f98"} strokeOpacity={0.25} strokeWidth={0.8 * u} strokeDasharray={`${3 * u} ${3 * u}`} pointerEvents="none" />;
      return null;
    }
    if (n.stroke) return <path d={n.d} clipPath={clip} fill="none" stroke={accent} strokeWidth={n.stroke + 2 * u} strokeOpacity={0.95} strokeLinecap="round" pointerEvents="none" />;
    return <path d={n.d} clipPath={clip} fill={accent} fillOpacity={0.45} stroke={accent} strokeWidth={1.2 * u} pointerEvents="none" />;
  };

  /** Structure dessinée façon atlas (couleur par type, veines en bleu). */
  const atlasShape = (n: AnatomyNode) => {
    const style = n.tags?.includes("veine") ? VEIN : ATLAS[n.kind] ?? ATLAS.muscle!;
    if (n.stroke) {
      // Gaine sombre dessous, cœur coloré, reflet pour les vaisseaux.
      return (
        <g key={n.id} strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d={n.d} stroke={style.casing} strokeWidth={n.stroke + 1.4 * u} />
          <path d={n.d} stroke={style.fill} strokeWidth={n.stroke} />
          {n.kind === "vessel" && <path d={n.d} stroke={n.tags?.includes("veine") ? "#a9c2f2" : "#ffb4ac"} strokeWidth={n.stroke * 0.25} strokeOpacity={0.7} />}
        </g>
      );
    }
    return (
      <g key={n.id}>
        <path d={n.d} fill={style.fill} fillOpacity={0.88} stroke={style.casing} strokeWidth={0.8 * u} />
        {n.kind === "muscle" && <path d={n.d} fill={`url(#fibers-${uid})`} />}
      </g>
    );
  };
  const hovered = hover ? region.byId.get(hover) : null;

  return (
    <div className={`relative overflow-hidden rounded-xl ${dark ? "bg-black" : "bg-slate-50"}`}>
      <svg
        ref={svgRef}
        viewBox={box.join(" ")}
        className="block w-full cursor-grab touch-none active:cursor-grabbing"
        style={{ aspectRatio: aspect }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        <defs>
          {region.nodes.filter((n) => n.clip).map((n) => (
            <clipPath key={n.id} id={`clip-${uid}-${n.id}`}>
              <rect x={n.clip![0]} y={n.clip![1]} width={n.clip![2]} height={n.clip![3]} />
            </clipPath>
          ))}
          {bones.filter(([, b]) => b.clip).map(([id, b]) => (
            <clipPath key={id} id={`bclip-${uid}-${id}`}>
              <rect x={b.clip![0]} y={b.clip![1]} width={b.clip![2]} height={b.clip![3]} />
            </clipPath>
          ))}
          <clipPath id={`skin-${uid}`}><path d={skin} /></clipPath>
          {/* Fibres musculaires (atlas). */}
          <pattern id={`fibers-${uid}`} width={3 * u} height={3 * u} patternUnits="userSpaceOnUse" patternTransform="rotate(-8)">
            <line x1={0} y1={0} x2={0} y2={3 * u} stroke="#7f2622" strokeWidth={0.5 * u} strokeOpacity={0.45} />
          </pattern>
          {/* Grain du capteur + léger flou : l'image ne fait pas « dessin vectoriel ». */}
          <filter id={`grain-${uid}`} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation={(mode === "xray" ? 0.6 : 0.9) * u} result="b" />
            <feTurbulence type="fractalNoise" baseFrequency={0.9 / u} numOctaves={2} seed={7} result="n" />
            <feColorMatrix in="n" type="saturate" values="0" result="m" />
            <feComposite in="b" in2="m" operator="arithmetic" k1={0} k2={1} k3={mode === "xray" ? 0.09 : 0.12} k4={-0.05} />
          </filter>
          <filter id={`soft-${uid}`}><feGaussianBlur stdDeviation={5 * u} /></filter>
          {region.look?.tissueHole && (
            <mask id={`hole-${uid}`} maskUnits="userSpaceOnUse" x={box[0] - box[2]} y={box[1] - box[3]} width={box[2] * 3} height={box[3] * 3}>
              <rect x={box[0] - box[2]} y={box[1] - box[3]} width={box[2] * 3} height={box[3] * 3} fill="#fff" />
              <path d={region.look.tissueHole} fill="#000" />
            </mask>
          )}
          <filter id={`blur-${uid}`} x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation={1.6 * u} /></filter>
        </defs>

        <g transform={mirror}>
          {mode === "xray" && (
            <g filter={`url(#grain-${uid})`}>
              <rect x={box[0] - box[2]} y={box[1] - box[3]} width={box[2] * 3} height={box[3] * 3} fill="#050505" />
              <path d={skin} fill={region.look?.xraySoft ?? "#3b3b3b"} filter={`url(#soft-${uid})`} />
              <g clipPath={`url(#skin-${uid})`}>
                {XRAY.map((layer, i) => (
                  <g key={i} opacity={layer.opacity ?? 1} filter={layer.blur ? `url(#blur-${uid})` : undefined}>
                    {region.nodes.filter((n) => n.d && layer.match(n)).map((n) => <path key={n.id} d={n.d} fill={layer.fill} />)}
                  </g>
                ))}
                <ShapeLesions region={region} findings={findings} mode="xray" tc={tc} u={u} />
              </g>
              {drawnBones.map((n) => <path key={n.id} d={n.d} fill="#c8c8c8" fillOpacity={0.3} stroke="#e8e8e8" strokeOpacity={0.5} strokeWidth={0.6 * u} style={{ mixBlendMode: "screen" }} />)}
              {bones.map(([id, b]) => <XrayBone key={id} bone={b} clip={boneClip(id)} intensity={region.look?.xrayBone} />)}
              <MapLesions region={region} findings={findings} mode="xray" contrast={contrast} injected={injected} />
            </g>
          )}

          {mode === "tissue" && (
            <g filter={`url(#grain-${uid})`}>
              <rect x={box[0] - box[2]} y={box[1] - box[3]} width={box[2] * 3} height={box[3] * 3} fill="#000" />
              {/* Graisse sous-cutanée, puis masse musculaire en retrait (liseré de graisse le long de la peau). */}
              <path d={skin} fill={tc("fat")} />
              <g clipPath={`url(#skin-${uid})`}>
                {/* Membres : muscle au centre, liseré de graisse sous la peau. Tronc : graisse au centre (médiastin), paroi musculaire. */}
                <path d={skin} fill={tc(region.look?.tissueInterior ?? "muscle")} stroke={tc(region.look?.tissueInterior ? "muscle" : "fat")} strokeWidth={16 * u} />
              </g>
              <path d={skin} fill="none" stroke={tc("skin")} strokeWidth={1.4 * u} />
              <g clipPath={`url(#skin-${uid})`}>
              {soft.filter((n) => n.kind !== "cavity").map((n) => {
                const color = tc(tissueOfNode(n));
                return n.stroke ? (
                  <path key={n.id} d={n.d} fill="none" stroke={color} strokeWidth={n.stroke} strokeLinecap="round" />
                ) : (
                  <path key={n.id} d={n.d} fill={color} stroke={tc("fat")} strokeWidth={0.9 * u} />
                );
              })}
              <ShapeLesions region={region} findings={findings} mode="tissue" tc={tc} u={u} ct={contrast.startsWith("CT_")} />
              </g>
              {joints.map((n) => <path key={n.id} d={n.d} fill={tc("joint")} />)}
              <g mask={region.look?.tissueHole ? `url(#hole-${uid})` : undefined}>
              {drawnBones.map((n) => <path key={n.id} d={n.d} fill={tc("marrow")} stroke={tc("bone")} strokeWidth={0.9 * u} opacity={showBones ? 1 : 0.25} />)}
              {bones.map(([id, b]) => (
                <ArtBase key={id} bone={b} clip={boneClip(id)} fill={tc("marrow")} stroke={tc("bone")} strokeWidth={0.9 * u} opacity={(showBones ? 1 : 0.25) * (region.look?.tissueBone ?? 1)} />
              ))}
              </g>
              <MapLesions region={region} findings={findings} mode="tissue" contrast={contrast} injected={injected} />
            </g>
          )}

          {mode === "atlas" && (
            <>
              {/* Contour extérieur seulement : trait large dessous, remplissage par-dessus (les doigts et la paume se fondent). */}
              <path d={skin} fill="none" stroke="#d6b49a" strokeWidth={2.4 * u} />
              <path d={skin} fill="#f6e3d3" />
              {drawnBones.map((n) => <path key={n.id} d={n.d} fill="#fbfbf8" stroke="#2b2b2b" strokeWidth={0.35 * u} opacity={showBones ? 1 : 0.15} />)}
              {bones.map(([id, b]) => <ArtBone key={id} bone={b} clip={boneClip(id)} opacity={showBones ? 1 : 0.15} />)}
              {showBones && joints.map((n) => <path key={n.id} d={n.d} fill="#93c5fd" fillOpacity={0.35} stroke="#1d4ed8" strokeOpacity={0.5} strokeWidth={0.6 * u} />)}
              <g clipPath={`url(#skin-${uid})`}>
              {art
                ? ART_ORDER.filter((l) => layers.includes(l)).map((l) => (
                    <g key={l}>
                      {/* Structures dessinées à part (veines, ligaments…), sous l'illustration du même calque. */}
                      {soft.filter((n) => n.draw && layerOf(n.kind) === l).map(atlasShape)}
                      {art.layers[l]?.length ? (
                        <g opacity={l === "muscles" ? 0.86 : 1}>
                          {art.layers[l]!.map((p, i) => <path key={i} d={p.d} fill={p.fill} stroke={p.stroke} strokeWidth={p.sw} />)}
                        </g>
                      ) : null}
                    </g>
                  ))
                : soft.map(atlasShape)}
              {/* Illustration dans l'ordre d'origine (organes devant les vaisseaux…), filtrée par calque. */}
              {art?.ordered?.filter((p) => layers.includes(p.layer)).map((p, i) => <path key={`o${i}`} d={p.d} fill={p.fill} stroke={p.stroke} strokeWidth={p.sw} />)}
              </g>
            </>
          )}

          {/* Zones cliquables du niveau courant. */}
          {interactive.map(({ node, shapes }) => {
            const isHover = hover === node.id;
            const isSel = selected === node.id;
            return (
              <g
                key={node.id}
                className="cursor-pointer"
                onPointerEnter={() => setHover(node.id)}
                onPointerLeave={() => setHover((h) => (h === node.id ? null : h))}
                onClick={() => choose(node.id)}
              >
                {shapes.map((s) => (
                  <g key={s.id}>
                    {overlay(s, isHover, isSel)}
                    {overlay(s, false, false, true)}
                  </g>
                ))}
              </g>
            );
          })}

          {/* Structure sélectionnée hors du niveau courant : toujours surlignée. */}
          {selected && region.byId.get(selected) && !interactive.some((c) => c.node.id === selected) &&
            shapesOf(region, region.byId.get(selected)!, modality, layers).map((s) => <g key={s.id}>{overlay(s, false, true)}</g>)}
        </g>

        {scanY != null && (
          <g pointerEvents="none">
            <line x1={box[0]} x2={box[0] + box[2]} y1={scanY} y2={scanY} stroke="#22d3ee" strokeWidth={unit * 0.5} strokeDasharray={`${unit * 2} ${unit}`} />
            <text x={box[0] + unit * 2} y={scanY - unit} fontSize={unit * 3.2} fill="#22d3ee">Coupe</text>
          </g>
        )}

        {findings.map((f) => {
          const [mx, my] = region.markerOf(f.structure);
          const x = mirrored ? region.mirror - mx : mx;
          return (
            <g key={f.id} pointerEvents="none">
              <circle cx={x} cy={my} r={unit * 2.6} fill="#ef4444" stroke="#fff" strokeWidth={unit * 0.5} />
              <text x={x} y={my + unit * 1.1} textAnchor="middle" fontSize={unit * 3} fontWeight={700} fill="#fff">{numbers.get(f.id)}</text>
            </g>
          );
        })}
      </svg>
      <p className={`pointer-events-none absolute left-2 top-2 rounded px-2 py-0.5 text-xs font-medium ${dark ? "bg-white/10 text-white" : "bg-white/80 text-ink"}`}>
        {hovered ? hovered.label : "Survolez une zone · molette : zoom · glisser : déplacer"}
      </p>
    </div>
  );
}

/** Aspect des lésions sur l'image de l'examen (radio, scanner, IRM), au niveau du repère de la structure. */
function MapLesions({ region, findings, mode, contrast, injected }: { region: Region; findings: Finding[]; mode: "xray" | "tissue"; contrast: Contrast; injected: boolean }) {
  const ct = contrast.startsWith("CT_");
  const fluidBright = !ct && (contrast === "T2" || contrast === "FS");
  return (
    <>
      {findings.map((f) => {
        const [x, y] = region.markerOf(f.structure);
        return (
          <g key={f.id} transform={`translate(${x} ${y}) scale(${region.unit})`}>
            <Lesion f={f} mode={mode} ct={ct} fluidBright={fluidBright} contrast={contrast} injected={injected} />
          </g>
        );
      })}
    </>
  );
}

/** Une lésion dessinée autour de l'origine (repère du membre supérieur ; mise à l'échelle par la région). */
function Lesion({ f, mode, ct, fluidBright, contrast, injected }: { f: Finding; mode: "xray" | "tissue"; ct: boolean; fluidBright: boolean; contrast: Contrast; injected: boolean }) {
  switch (f.lesion) {
    case "fracture":
    case "fissure": {
      const w = f.lesion === "fissure" ? 0.8 : f.options.deplacement && f.options.deplacement !== "non" ? 2.4 : 1.6;
      const color = mode === "xray" || ct ? "#0a0a0a" : fluidBright ? "#f0f0f0" : "#141414";
      return (
        <g>
          {fluidBright && <ellipse cx={0} cy={0} rx={12} ry={9} fill="#e8e8e8" fillOpacity={0.45} />}
          <path d="M-14,-2 l7,4 l6,-5 l7,5 l8,-3" stroke={color} strokeWidth={w} fill="none" />
        </g>
      );
    }
    case "corps-etranger":
      return (
        <g>
          {mode === "tissue" && ct &&
            Array.from({ length: 8 }, (_, i) => {
              const a = (i / 8) * Math.PI * 2;
              return <line key={i} x1={0} y1={0} x2={Math.cos(a) * 30} y2={Math.sin(a) * 30} stroke={i % 2 ? "#ffffff" : "#000000"} strokeWidth={0.6} strokeOpacity={0.5} />;
            })}
          <ellipse cx={3} cy={0} rx={3} ry={6} fill="#ffffff" transform="rotate(25 3 0)" />
        </g>
      );
    case "oedeme-osseux":
      // Invisible en radio et au scanner : seule l'IRM montre l'œdème médullaire.
      if (mode === "xray" || ct) return null;
      return <ellipse cx={0} cy={0} rx={10} ry={14} fill={fluidBright ? "#e6e6e6" : "#2a2a2a"} fillOpacity={0.7} />;
    case "epanchement":
    case "hemarthrose":
    case "collection":
      return <ellipse cx={0} cy={0} rx={13} ry={7} fill={fluidBright ? "#f2f2f2" : ct ? (f.lesion === "hemarthrose" ? "#9a9a9a" : "#6e6e6e") : "#3a3a3a"} fillOpacity={0.85} />;
    case "lipohemarthrose":
      // Niveau horizontal : graisse (au-dessus) sur le sang (en dessous).
      return (
        <g>
          <path d="M-14,0 h28 a14,8 0 0 1 -28,0 z" fill={mode === "xray" ? "#6a6a6a" : ct ? "#a0a0a0" : fluidBright ? "#e0e0e0" : "#5a5a5a"} fillOpacity={0.85} />
          <path d="M-14,0 h28 a14,8 0 0 0 -28,0 z" fill={mode === "xray" ? "#1e1e1e" : ct ? "#2c2c2c" : fluidBright ? "#8a8a8a" : "#e8e8e8"} fillOpacity={0.85} />
        </g>
      );
    case "hematome":
      return <ellipse cx={0} cy={0} rx={12} ry={9} fill={ct ? "#a8a8a8" : fluidBright ? "#d8d8d8" : "#9a9a9a"} fillOpacity={0.85} />;
    case "entorse":
    case "rupture-ligament":
    case "rupture-tendon":
    case "tendinopathie":
    case "lesion-labrum":
    case "lesion-menisque":
    case "lesion-nerf":
    case "lesion-musculaire":
      return <ellipse cx={0} cy={0} rx={9} ry={7} fill={fluidBright ? "#efefef" : "#8a8a8a"} fillOpacity={fluidBright ? 0.75 : 0.4} />;
    case "lesion-vasculaire":
      return injected || contrast === "T1_GADO" ? <ellipse cx={4} cy={0} rx={9} ry={7} fill="#f2f2f2" fillOpacity={0.85} /> : null;
    case "thrombose":
      // Défaut de remplissage dans une veine opacifiée.
      return injected || contrast === "T1_GADO" ? <ellipse cx={0} cy={0} rx={4} ry={14} fill="#3a3a3a" stroke="#f2f2f2" strokeWidth={1.5} /> : null;
    case "lithiase":
      // Calcul : très dense en radio et au scanner, vide de signal en IRM.
      return <circle cx={0} cy={0} r={3.2} fill={mode === "xray" || ct ? "#ffffff" : "#050505"} />;
    case "traumatisme-foie":
    case "traumatisme-rate":
    case "traumatisme-rein":
    case "traumatisme-pancreas":
    case "appendicite":
    case "perforation-digestive":
      // Lacération / foyer : hypodense au scanner (sauf saignement actif, très dense), hypersignal T2.
      return (
        <g>
          <ellipse cx={0} cy={0} rx={12} ry={7} fill={ct ? "#3c3c3c" : fluidBright ? "#e2e2e2" : "#5a5a5a"} fillOpacity={0.75} />
          <path d="M-12,-1 l5,3 l4,-4 l5,4 l4,-3 l5,2" stroke={ct ? "#202020" : fluidBright ? "#f5f5f5" : "#2a2a2a"} strokeWidth={1.4} fill="none" />
          {f.options.saignement === "oui" && (injected || contrast === "T1_GADO") && <circle cx={4} cy={1} r={3} fill="#f5f5f5" />}
        </g>
      );    case "diastasis":
      return (
        <g stroke={mode === "xray" || ct ? "#ffffff" : "#e5e5e5"} strokeWidth={1.4}>
          <path d="M-8,-8 v16 M8,-8 v16" />
          <path d="M-6,0 h12" strokeDasharray="2 2" />
        </g>
      );
    case "emphyseme":
      return (
        <g>
          {[[-10, -4], [-4, 6], [6, -6], [9, 4], [0, -10]].map(([dx, dy], i) => <circle key={i} cx={dx} cy={dy} r={1.6} fill="#000" />)}
        </g>
      );
    case "tumefaction":
      return <ellipse cx={0} cy={0} rx={22} ry={16} fill="#8a8a8a" fillOpacity={0.3} />;
    case "luxation":
    case "subluxation":
      return <circle cx={0} cy={0} r={10} fill="none" stroke={mode === "xray" ? "#000" : "#ffffff"} strokeWidth={2} strokeDasharray="3 2" />;
    default:
      return null;
  }
}

/**
 * Lésions dessinées d'après la forme des organes (thorax…) : pneumothorax (poumon rétracté, liseré pleural, air sans trame),
 * épanchements déclives, contusions et condensations dans un lobe, cardiomégalie, élargissement médiastinal…
 */
function ShapeLesions({ region, findings, mode, tc, u, ct = false }: { region: Region; findings: Finding[]; mode: "xray" | "tissue"; tc: (t: Tissue) => string; u: number; ct?: boolean }) {
  const xray = mode === "xray";
  /** Lobes d'un poumon (pour une plèvre : ceux du même côté). */
  const lungOf = (id: string) => {
    const group = id.startsWith("plevre-") ? `poumon-${id.slice(-1)}` : id;
    const node = region.byId.get(group);
    if (!node) return [];
    return node.kind === "lung" ? [node] : region.childrenOf(group).filter((n) => n.kind === "lung" && n.d);
  };
  const scaled = (cx: number, cy: number, k: number) => `translate(${cx} ${cy}) scale(${k}) translate(${-cx} ${-cy})`;
  return (
    <>
      {findings.map((f) => {
        const node = region.byId.get(f.structure);
        if (!node) return null;
        switch (f.lesion) {
          case "pneumothorax": {
            const lobes = lungOf(node.id);
            if (!lobes.length) return null;
            const [x, y, w, h] = boxOf(lobes.flatMap((n) => region.nodePoints(n.id)));
            // Le poumon se rétracte vers son hile (bord médial).
            const cx = node.id.endsWith("-d") ? x + w : x, cy = y + h * 0.45;
            const k = f.options.abondance === "complet" ? 0.45 : f.options.abondance === "moyen" ? 0.7 : 0.86;
            return (
              <g key={f.id}>
                {lobes.map((n) => <path key={n.id} d={n.d} fill={xray ? "#000" : tc("air")} />)}
                <g transform={scaled(cx, cy, k)}>
                  {lobes.map((n) => <path key={n.id} d={n.d} fill={xray ? "#1f1f1f" : tc("lung")} stroke={xray ? "#b8b8b8" : tc("skin")} strokeWidth={(0.45 * u) / k} />)}
                </g>
              </g>
            );
          }
          case "hemothorax":
          case "epanchement-pleural": {
            const lobes = lungOf(node.id);
            if (!lobes.length) return null;
            const [x, y, w, h] = boxOf(lobes.flatMap((n) => region.nodePoints(n.id)));
            const level = f.options.abondance === "massif" ? 0.75 : f.options.abondance === "moyen" ? 0.45 : 0.22;
            const top = y + h * (1 - level);
            // Ligne bordante concave (plus haute en dehors) : liquide déclive.
            const lateralX = node.id.endsWith("-d") ? x : x + w;
            const clip = `M${x - 5},${y + h + 5}L${x - 5},${top}Q${x + w / 2},${top + h * 0.12} ${lateralX},${top - h * 0.06}L${x + w + 5},${top}L${x + w + 5},${y + h + 5}Z`;
            const id = `fluid-${f.id}`;
            return (
              <g key={f.id}>
                <defs><clipPath id={id}><path d={clip} /></clipPath></defs>
                <g clipPath={`url(#${id})`}>
                  {/* Sang épanché : environ 35-70 UH au scanner (gris), liquide simple plus sombre. */}
                  {lobes.map((n) => <path key={n.id} d={n.d} fill={xray ? "#9c9c9c" : f.lesion === "hemothorax" && ct ? tc("muscle") : tc("fluid")} />)}
                </g>
              </g>
            );
          }
          case "contusion-pulmonaire":
          case "condensation":
          case "atelectasie":
          case "oedeme-pulmonaire": {
            const lobes = f.lesion === "oedeme-pulmonaire" ? region.nodes.filter((n) => n.kind === "lung" && n.d) : lungOf(node.id);
            if (!lobes.length) return null;
            const id = `lobe-${f.id}`;
            const [mx, my] = region.markerOf(f.structure);
            const dense = xray ? "#8a8a8a" : tc("muscle");
            return (
              <g key={f.id}>
                <defs><clipPath id={id}>{lobes.map((n) => <path key={n.id} d={n.d} />)}</clipPath></defs>
                <g clipPath={`url(#${id})`}>
                  {f.lesion === "contusion-pulmonaire" && <ellipse cx={mx} cy={my} rx={12 * u * 2.4} ry={9 * u * 2.4} fill={dense} fillOpacity={0.55} />}
                  {f.lesion === "condensation" && lobes.map((n) => <path key={n.id} d={n.d} fill={dense} fillOpacity={0.8} />)}
                  {f.lesion === "atelectasie" && lobes.map((n) => <path key={n.id} d={n.d} fill={dense} fillOpacity={0.9} transform={scaled(mx, my, 0.7)} />)}
                  {f.lesion === "oedeme-pulmonaire" && lobes.map((n) => <path key={n.id} d={n.d} fill={dense} fillOpacity={0.35} />)}
                </g>
              </g>
            );
          }
          case "cardiomegalie":
          case "epanchement-pericardique": {
            const heart = region.nodes.find((n) => n.tags?.includes("coeur") && n.d);
            if (!heart) return null;
            const [x, y, w, h] = boxOf(region.nodePoints(heart.id));
            const k = f.lesion === "cardiomegalie" ? 1.22 : 1.14;
            const cy = y + h * 0.35;
            return (
              <g key={f.id}>
                <path d={heart.d} transform={scaled(x + w * 0.4, cy, k)} fill={xray ? "#a8a8a8" : tc(f.lesion === "cardiomegalie" ? "heart" : "fluid")} />
                {f.lesion === "epanchement-pericardique" && <path d={heart.d} fill={xray ? "#a8a8a8" : tc("heart")} />}
              </g>
            );
          }
          case "elargissement-mediastin":
          case "hematome-mediastinal": {
            const aorta = region.nodes.find((n) => n.tags?.includes("aorte") && n.d);
            if (!aorta) return null;
            const [x, y, w, h] = boxOf(region.nodePoints(aorta.id));
            return <ellipse key={f.id} cx={x + w / 2} cy={y + h * 0.6} rx={w * 0.85} ry={h * 0.9} fill={xray ? "#a0a0a0" : tc("blood")} fillOpacity={0.75} />;
          }
          case "hemoperitoine": {
            // Le sang se collecte dans les zones déclives : espace de Morison (sous le foie), gouttière droite, pelvis.
            const fill = xray ? "#8a8a8a" : ct ? tc("blood") : tc("fluid");
            const big = f.options.abondance === "grand", mid = big || f.options.abondance === "moyen";
            return (
              <g key={f.id} fill={fill} fillOpacity={0.85}>
                <ellipse cx={156} cy={350} rx={11} ry={4} transform="rotate(-18 156 350)" />
                {mid && <ellipse cx={143} cy={392} rx={4} ry={18} />}
                {mid && <ellipse cx={208} cy={440} rx={14} ry={7} />}
                {big && <ellipse cx={272} cy={392} rx={4} ry={18} />}
                {big && <ellipse cx={262} cy={312} rx={6} ry={12} />}
              </g>
            );
          }
          case "pneumoperitoine": {
            // Croissant gazeux entre le dôme hépatique et la coupole droite (et sous la coupole gauche).
            const liver = region.byId.get("foie");
            if (!liver?.d) return null;
            const [x, y, w] = boxOf(region.nodePoints("foie"));
            const color = xray ? "#000" : tc("air");
            return (
              <g key={f.id} fill="none" stroke={color} strokeLinecap="round">
                <path d={`M${x + w * 0.05},${y + 12} Q${x + w * 0.3},${y - 7} ${x + w * 0.62},${y + 4}`} strokeWidth={3.2 * u} />
                <path d={`M${x + w * 0.95},${y + 14} Q${x + w * 1.08},${y + 6} ${x + w * 1.2},${y + 16}`} strokeWidth={2.2 * u} />
              </g>
            );
          }
          case "hematome-retroperitoneal":
          case "anevrisme-aortique": {
            const [mx, my] = f.lesion === "anevrisme-aortique" ? [207, 368] : region.markerOf("rein-d");
            return <ellipse key={f.id} cx={mx} cy={my} rx={f.lesion === "anevrisme-aortique" ? 7 : 14} ry={f.lesion === "anevrisme-aortique" ? 11 : 20} fill={xray ? "#8a8a8a" : ct ? tc("blood") : tc("fluid")} fillOpacity={0.8} />;
          }
          case "occlusion": {
            // Anses dilatées (gaz) avec niveaux hydro-aériques.
            if (!node.d) return null;
            const [x, y, w, h] = boxOf(region.nodePoints(node.id));
            const cx = x + w / 2, cy = y + h / 2;
            return (
              <g key={f.id}>
                <path d={node.d} transform={scaled(cx, cy, 1.15)} fill={xray ? "#0c0c0c" : tc("air")} fillOpacity={0.75} />
                {[0.35, 0.55, 0.75].map((t) => (
                  <line key={t} x1={x + w * (t - 0.12)} x2={x + w * (t + 0.08)} y1={y + h * t} y2={y + h * t} stroke={xray ? "#9a9a9a" : tc("fluid")} strokeWidth={1.2 * u} />
                ))}
              </g>
            );
          }
          case "fracture-bassin": {
            // Traits sur l'anneau : branches pubiennes, et arrière de l'anneau (sacro-iliaques) dans les formes instables.
            const color = xray || ct ? "#050505" : "#f0f0f0";
            const posterior = ["apc2", "apc3", "lc2", "lc3", "vs", "cm"].includes(f.options.mecanisme ?? "");
            const jag = (x: number, y: number) => `M${x - 4},${y - 2} l2.5,3 l2,-3 l2.5,3 l2.5,-2`;
            return (
              <g key={f.id} stroke={color} strokeWidth={1.4 * u} fill="none">
                <path d={jag(188, 442)} />
                {f.options.mecanisme !== "lc1" && <path d={jag(228, 446)} />}
                {posterior && <path d={`M186,402 l2,5 l-2,5 l2,5`} />}
                {(f.options.mecanisme === "apc1" || f.options.mecanisme === "apc2" || f.options.mecanisme === "apc3") && <path d="M204,455 h7" strokeDasharray="1.5 1.5" />}
              </g>
            );
          }          case "pneumomediastin": {
            const heart = region.nodes.find((n) => n.tags?.includes("coeur") && n.d);
            if (!heart) return null;
            const [x, y, w, h] = boxOf(region.nodePoints(heart.id));
            return <path key={f.id} d={heart.d} transform={scaled(x + w / 2, y + h / 2, 1.05)} fill="none" stroke="#000" strokeWidth={1.4 * u} strokeDasharray={`${3 * u} ${2 * u}`} />;
          }
          default:
            return null;
        }
      })}
    </>
  );
}