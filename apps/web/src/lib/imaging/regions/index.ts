import type { AnatomyNode, Region } from "../anatomy";
import { ABDOMEN } from "./abdomen";
import { HEAD } from "./head";
import { LOWER_LIMB } from "./lower-limb";
import { SPINE } from "./spine";
import { THORAX } from "./thorax";
import { UPPER_LIMB } from "./upper-limb";

/** Régions disponibles, dans l'ordre d'affichage. */
export const REGION_LIST: Region[] = [HEAD, UPPER_LIMB, LOWER_LIMB, THORAX, ABDOMEN, SPINE];
export const REGIONS = new Map(REGION_LIST.map((r) => [r.id, r]));

/** Chaque structure n'appartient qu'à une région (identifiants uniques sur tout le corps). */
const NODE_REGION = new Map<string, Region>();
for (const r of REGION_LIST) {
  for (const n of r.nodes) {
    if (NODE_REGION.has(n.id)) throw new Error(`Structure « ${n.id} » déclarée dans deux régions`);
    NODE_REGION.set(n.id, r);
  }
}

export const regionOfNode = (id: string): Region | undefined => NODE_REGION.get(id);
export const findNode = (id: string): AnatomyNode | undefined => NODE_REGION.get(id)?.byId.get(id);
/** Chemin depuis la racine de la région (fil d'Ariane). */
export const ancestryOf = (id: string): AnatomyNode[] => NODE_REGION.get(id)?.ancestry(id) ?? [];
