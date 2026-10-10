"use client";

import { useState } from "react";
import { BODY_ZONES } from "@/lib/imaging/atlas/body-zones";
import { REGIONS } from "@/lib/imaging/regions";

/**
 * Silhouette de face (polygones de react-body-highlighter, MIT) : on y choisit la zone à examiner.
 * Les zones dont la région n'est pas encore prête s'affichent « bientôt ». Le rachis entier s'ouvre par un bouton à part.
 */

/** Zone de la silhouette → région de l'imagerie. */
const REGION_OF: Record<string, string> = {
  tete: "tete-cou",
  thorax: "thorax",
  abdomen: "abdomen",
  "membre-sup": "membre-sup",
  "membre-inf": "membre-inf",
};
const LABELS: Record<string, string> = {
  tete: "Tête et cou",
  thorax: "Thorax",
  abdomen: "Abdomen et bassin",
  "membre-sup-D": "Membre supérieur droit",
  "membre-sup-G": "Membre supérieur gauche",
  "membre-inf-D": "Membre inférieur droit",
  "membre-inf-G": "Membre inférieur gauche",
};
const keyOf = (z: (typeof BODY_ZONES)[number]) => (z.side ? `${z.zone}-${z.side}` : z.zone);

export function BodyOverview({ onPick }: { onPick: (region: string, side: "D" | "G" | null) => void }) {
  const [hover, setHover] = useState<string | null>(null);
  const ready = (zone: string) => REGIONS.has(REGION_OF[zone]);
  const hoverZone = hover ? BODY_ZONES.find((z) => keyOf(z) === hover)?.zone : null;

  return (
    <div className="mx-auto max-w-[15rem]">
      <svg viewBox="-4 -2 108 204" className="block w-full">
        {BODY_ZONES.map((z, i) => {
          const key = keyOf(z);
          const ok = ready(z.zone);
          const isHover = hover === key;
          return (
            <polygon
              key={i}
              points={z.points}
              fill={isHover ? (ok ? "#ef4444" : "#94a3b8") : ok ? "#7dd3fc" : "#e2e8f0"}
              fillOpacity={isHover && ok ? 0.85 : 1}
              stroke={ok ? "#0369a1" : "#cbd5e1"}
              strokeWidth={0.35}
              strokeLinejoin="round"
              className={ok ? "cursor-pointer" : "cursor-not-allowed"}
              onPointerEnter={() => setHover(key)}
              onPointerLeave={() => setHover((h) => (h === key ? null : h))}
              onClick={() => ok && onPick(REGION_OF[z.zone], z.side)}
            />
          );
        })}
        <text x={6} y={120} fontSize={6} fontWeight={700} fill="#64748b">D</text>
        <text x={90} y={120} fontSize={6} fontWeight={700} fill="#64748b">G</text>
      </svg>
      <button
        type="button"
        onClick={() => onPick("rachis", null)}
        className="mt-2 w-full rounded-lg border border-ocean-200 bg-ocean-50 px-3 py-1.5 text-sm font-medium text-ocean-700 hover:bg-red-50 hover:text-red-700"
      >
        Rachis (colonne vertébrale entière)
      </button>
      <p className="mt-2 text-center text-sm font-medium">
        {hover ? (
          <>
            {LABELS[hover]}
            {hoverZone && !ready(hoverZone) && <span className="ml-1 text-muted">— bientôt</span>}
          </>
        ) : (
          <span className="text-muted">Cliquez sur la zone à examiner (en bleu : disponible)</span>
        )}
      </p>
    </div>
  );
}
