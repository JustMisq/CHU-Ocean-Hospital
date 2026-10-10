"use client";

import { useId, useState } from "react";
import type { Region } from "@/lib/imaging/anatomy";
import type { Finding } from "@/lib/imaging/catalog";
import { centroid, pathPoints } from "@/lib/imaging/geometry";
import { CONTRAST_LABELS, findingItems, findingSides, isCT as isCTContrast, sliceOverlays, tissueColor, type Contrast, type Overlay } from "@/lib/imaging/render";
import type { Slice } from "@/lib/imaging/slices";

/**
 * Coupe axiale « façon console » : niveaux de gris du scanner ou de l'IRM, lésions dessinées,
 * tissus cliquables (sélectionne la structure correspondante sur la carte).
 */
export function SliceView({ region, slice, contrast, injected, findings, numbers, selected, side, onSelect, interactive = true }: {
  region: Region;
  slice: Slice;
  contrast: Contrast;
  injected: boolean;
  findings: Finding[];
  /** Numéro affiché pour chaque lésion (même numérotation que la liste). */
  numbers?: Map<string, number>;
  selected?: string | null;
  /** Côté examiné (régions paires) ; sans côté, la coupe est vue d'en bas : droite du patient à gauche de l'écran. */
  side: "D" | "G" | null;
  onSelect?: (id: string) => void;
  interactive?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<string | null>(null);
  const overlays = sliceOverlays(region, slice, findings, contrast, injected);
  const isCT = isCTContrast(contrast);
  const contrastLabel = CONTRAST_LABELS[contrast];
  const mirrored = region.bilateral && side === "G";
  const mirror = mirrored ? "scale(-1,1)" : undefined;
  const hoverLabel = hover ? region.byId.get(hover)?.label : null;
  const [vx, vy, vw, vh] = slice.view ?? [-80, -62, 160, 124];
  // Repères d'orientation : membre (latéral / médial) ou tronc et tête (droite / gauche du patient).
  const [leftMark, rightMark] = region.bilateral ? (mirrored ? ["M", "L"] : ["L", "M"]) : ["D", "G"];
  const sideLabel = region.bilateral ? (mirrored ? "GAUCHE" : "DROIT") : "";

  return (
    <div className="relative select-none overflow-hidden rounded-xl bg-black">
      <svg viewBox={`${vx} ${vy} ${vw} ${vh}`} className="block w-full" style={{ aspectRatio: vw / vh }}>
        <defs>
          {/* Grain du capteur + léger flou : l'image ne fait pas « dessin vectoriel ». */}
          <filter id={`grain-${uid}`} x="0" y="0" width="100%" height="100%">
            <feGaussianBlur stdDeviation={isCT ? 0.35 : 0.5} result="soft" />
            <feTurbulence type="fractalNoise" baseFrequency={isCT ? 1.6 : 1.1} numOctaves={2} seed={4} result="noise" />
            <feColorMatrix in="noise" type="saturate" values="0" result="mono" />
            <feComposite in="soft" in2="mono" operator="arithmetic" k1={0} k2={1} k3={isCT ? 0.07 : 0.11} k4={-0.04} />
          </filter>
        </defs>

        <g filter={`url(#grain-${uid})`} transform={mirror}>
          <rect x={vx} y={vy} width={vw} height={vh} fill="#000" />
          {slice.items.map((it, i) => (
            <path key={i} d={it.d} fill={tissueColor(it.tissue, contrast, injected)} />
          ))}
          {overlays.map((o, i) => <OverlayShape key={i} o={o} />)}
        </g>

        {/* Calque d'interaction, sans filtre (survol net). */}
        {interactive && (
          <g transform={mirror}>
            {slice.items.map((it, i) =>
              it.id ? (
                <path
                  key={i}
                  d={it.d}
                  fill="transparent"
                  stroke={it.id === selected ? "#f59e0b" : hover === it.id ? "#ef4444" : "transparent"}
                  strokeWidth={1.2}
                  className="cursor-pointer"
                  onPointerEnter={() => setHover(it.id!)}
                  onPointerLeave={() => setHover(null)}
                  onClick={() => onSelect?.(it.id!)}
                />
              ) : null,
            )}
          </g>
        )}

        {/* Repères numérotés des lésions présentes sur la coupe. */}
        {numbers &&
          findings.map((f) => {
            const it = findingItems(slice, f, findingSides(f)[0]).find((x) => x.tissue !== "marrow");
            if (!it) return null;
            const [cx, cy] = centroid(pathPoints(it.d));
            const x = mirrored ? -cx : cx;
            return (
              <g key={f.id} pointerEvents="none">
                <circle cx={x + 6} cy={cy - 6} r={3.6} fill="#ef4444" stroke="#fff" strokeWidth={0.6} />
                <text x={x + 6} y={cy - 4.7} textAnchor="middle" fontSize={4} fontWeight={700} fill="#fff">{numbers.get(f.id)}</text>
              </g>
            );
          })}

        {/* Surimpressions façon console : orientation, examen, niveau. */}
        <g fill="#e5e7eb" fontSize={4.2} fontFamily="ui-monospace, monospace" pointerEvents="none">
          <text x={vx + vw / 2} y={vy + 6} textAnchor="middle">A</text>
          <text x={vx + vw / 2} y={vy + vh - 2} textAnchor="middle">P</text>
          <text x={vx + 4} y={vy + vh / 2 + 1.5}>{leftMark}</text>
          <text x={vx + vw - 6} y={vy + vh / 2 + 1.5}>{rightMark}</text>
          <text x={vx + 3} y={vy + 7}>{isCT ? "TDM" : "IRM"} · {contrastLabel}</text>
          <text x={vx + 3} y={vy + 12}>{injected && isCT ? "Injecté" : contrast === "T1_GADO" ? "Gadolinium" : "Sans injection"}</text>
          {sideLabel && <text x={vx + vw - 3} y={vy + 7} textAnchor="end">{sideLabel}</text>}
          <text x={vx + 3} y={vy + vh - 4}>{slice.label}</text>
        </g>
      </svg>
      {hoverLabel && <p className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/70 px-2 py-0.5 text-xs text-white">{hoverLabel}</p>}
    </div>
  );
}

function OverlayShape({ o }: { o: Overlay }) {
  if (o.type === "line") {
    return <line x1={o.from[0]} y1={o.from[1]} x2={o.to[0]} y2={o.to[1]} stroke={o.stroke} strokeWidth={o.width} strokeOpacity={o.opacity ?? 1} strokeLinecap="round" />;
  }
  if (o.type === "circle") return <circle cx={o.at[0]} cy={o.at[1]} r={o.r} fill={o.fill} fillOpacity={o.opacity ?? 1} />;
  return <path d={o.d} fill={o.fill ?? "none"} fillOpacity={o.opacity ?? 1} stroke={o.stroke} strokeWidth={o.width} strokeOpacity={o.stroke ? o.opacity ?? 1 : undefined} />;
}
