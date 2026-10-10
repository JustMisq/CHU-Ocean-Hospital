/**
 * Génère l'atlas des régions dessinées sur la planche du squelette entier (LadyofHats, domaine public) :
 *  - src/lib/imaging/atlas/plate-bones.ts : os de la planche, en coordonnées de la planche (toutes régions) ;
 *  - pour chaque région : <région>-shapes.ts (peau et structures, léger) et <région>-art.ts (illustration détaillée, lourd,
 *    chargé à la demande).
 * Les illustrations viennent de Servier Medical Art (CC BY 4.0, voir atlas/source/SOURCES.md) : chaque figure est recalée
 * sur la planche par une déformation « plaque mince » ancrée sur des repères anatomiques.
 *
 * Usage (depuis apps/web) :
 *   npx tsx scripts/build-body.mts <dossier des kits Servier décompressés> [dossier d'images de contrôle] [régions…]
 * Le dossier des kits contient x-Muscles, x-Nervous-system, x-Arteries-physiology, x-Respiratory-system…
 * (fichiers .pptx décompressés). Ne lit et n'écrit que des fichiers locaux.
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ABDOMEN_BONES, buildAbdomen } from "./body/abdomen.mts";
import { buildHead } from "./body/head.mts";
import { buildLowerLimb, LOWER_LIMB_BONES } from "./body/lower-limb.mts";
import { buildSpine } from "./body/spine.mts";
import { buildThorax, THORAX_BONES } from "./body/thorax.mts";
import { Debug, measureBone, writeTs, type BuildContext, type PlateBoneData } from "./lib/body.mts";
import { loadPlate } from "./lib/plate.mts";

const here = dirname(fileURLToPath(import.meta.url));
const atlasDir = join(here, "../src/lib/imaging/atlas");
const [servierDir, debugDir, ...only] = process.argv.slice(2);
if (!servierDir) throw new Error("Usage : npx tsx scripts/build-body.mts <dossier des kits Servier> [dossier de contrôle] [régions…]");
if (debugDir && debugDir !== "-") mkdirSync(debugDir, { recursive: true });

const ctx: BuildContext = {
  plate: loadPlate(join(atlasDir, "source/skeleton-front.svg")),
  servierDir,
  atlasDir,
  debug: new Debug(debugDir && debugDir !== "-" ? debugDir : undefined),
};
const wanted = (id: string) => only.length === 0 || only.includes(id);

// ─── Os de la planche (toutes régions) ───────────────────────────────────────

const specs = { ...LOWER_LIMB_BONES, ...THORAX_BONES, ...ABDOMEN_BONES };
const bones: Record<string, PlateBoneData> = {};
// Tracés arrondis au dixième (repère de la planche : largement suffisant, et deux fois plus léger).
const round1 = (d: string) => d.replace(/(\d+\.\d)\d+/g, "$1");
for (const [id, spec] of Object.entries(specs)) {
  const bone = await measureBone(ctx.plate, spec);
  bones[id] = { ...bone, paths: bone.paths.map((p) => ({ ...p, d: round1(p.d) })) };
}
writeTs(
  join(atlasDir, "plate-bones.ts"),
  `// Généré par scripts/build-body.mts à partir de source/skeleton-front.svg (LadyofHats, domaine public). Ne pas modifier.
// Os de la planche du squelette entier, en coordonnées de la planche (456 × 926) ; le côté droit du patient est à gauche.

import type { ArtPath } from "../anatomy";

export type PlateBone = {
  /** Contour de l'os (découpe comprise). */
  hull: [number, number][];
  paths: ArtPath[];
  /** Partie du dessin à garder (ex : moitié droite du bassin). */
  clip?: [number, number, number, number];
};`,
  `export const PLATE_BONES: Record<string, PlateBone> = ${JSON.stringify(bones)};`,
);
console.log(`${Object.keys(bones).length} os de la planche.`);

// ─── Régions ─────────────────────────────────────────────────────────────────

if (wanted("membre-inf")) await buildLowerLimb(ctx);
if (wanted("thorax")) await buildThorax(ctx);
if (wanted("abdomen")) await buildAbdomen(ctx);
if (wanted("rachis")) await buildSpine(ctx);
if (wanted("tete-cou")) await buildHead(ctx);
