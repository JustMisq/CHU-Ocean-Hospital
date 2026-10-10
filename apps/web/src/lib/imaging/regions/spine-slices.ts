import { ellipse, longBone, smooth } from "../geometry";
import { boneShape, type Slice, type SliceItem } from "../slices";

/**
 * Coupes axiales du rachis (scanner / IRM) passant par un disque ou un corps vertébral : vue d'en bas, avant en haut,
 * droite du patient à gauche de l'écran. Niveaux (y) dans le repère de la figure du rachis.
 */

type P = [number, number];
const mirror = (pts: P[]): P[] => pts.map(([x, y]) => [-x, y] as P).reverse();

/** Vertèbre en coupe : corps (ou disque), pédicules, lames, épineuse, transverses ; canal avec moelle ou racines. */
function level(opts: { body: string; disc?: string; cord: string | null; roots?: boolean; scale: number; cervical?: boolean; lumbar?: boolean }): SliceItem[] {
  const k = opts.scale;
  const s = (pts: P[]): P[] => pts.map(([x, y]) => [x * k, y * k]);
  const items: SliceItem[] = [];
  const body: P[] = s([[-22, -30], [0, -38], [22, -30], [24, -14], [12, -6], [0, -8], [-12, -6], [-24, -14]]);
  if (opts.disc) {
    items.push({ tissue: "disc", id: opts.disc, d: smooth(body) });
    items.push({ tissue: "fluid", id: opts.disc, d: smooth(s([[-10, -26], [0, -30], [10, -26], [10, -18], [0, -15], [-10, -18]])) });
  } else items.push(...boneShape(opts.body, body, 0.78));
  const arch: P[] = s([[-14, -6], [-18, 6], [-12, 16], [-4, 20], [0, 34], [4, 20], [12, 16], [18, 6], [14, -6], [8, -4], [10, 8], [0, 14], [-10, 8], [-8, -4]]);
  items.push({ tissue: "bone", id: opts.body, d: smooth(arch) });
  items.push({ tissue: "bone", id: opts.body, d: longBone(s([[-18, 2], [opts.lumbar ? -40 : opts.cervical ? -30 : -34, opts.cervical ? -4 : 4]]), [5 * k, 3.5 * k]) });
  items.push({ tissue: "bone", id: opts.body, d: longBone(s([[18, 2], [opts.lumbar ? 40 : opts.cervical ? 30 : 34, opts.cervical ? -4 : 4]]), [5 * k, 3.5 * k]) });
  // Canal : liquide céphalo-rachidien, moelle ou racines de la queue de cheval.
  items.push({ tissue: "fluid", id: "canal-rachidien", d: ellipse(0, 3 * k, 8 * k, 7 * k) });
  if (opts.cord) items.push({ tissue: "cord", id: opts.cord, d: ellipse(0, 2.5 * k, opts.cervical ? 5.5 * k : 4 * k, opts.cervical ? 4 * k : 3.6 * k) });
  if (opts.roots) for (const [x, y] of [[-3, 1], [0, 3], [3, 1], [-4, 5], [4, 5], [0, 7]]) items.push({ tissue: "nerve", id: "queue-de-cheval", d: ellipse(x * k, y * k, 1, 1) });
  return items;
}

/** Muscles paravertébraux et peau du dos. */
function back(k: number, width = 70): SliceItem[] {
  const muscle: P[] = [[-30, 8], [-20, 10], [-8, 20], [-6, 36], [-22, 38], [-34, 25]].map(([x, y]) => [x * k, y * k]);
  return [
    { tissue: "skin", d: smooth([[-width, -10], [-width * 0.8, -50], [0, -62], [width * 0.8, -50], [width, -10], [width * 0.75, 40], [0, 58], [-width * 0.75, 40]]) },
    { tissue: "fat", d: smooth([[-width + 2, -10], [-width * 0.8 + 2, -48], [0, -60], [width * 0.8 - 2, -48], [width - 2, -10], [width * 0.75 - 2, 38], [0, 55], [-width * 0.75 + 2, 38]]) },
    { tissue: "muscle", id: "rachis-pm", d: smooth(muscle) },
    { tissue: "muscle", id: "rachis-pm", d: smooth(mirror(muscle)) },
  ];
}

const SLICES: Slice[] = [
  {
    id: "s-rachis-c5",
    label: "Rachis cervical — C5",
    y: 149,
    items: [
      ...back(1.3, 52),
      { tissue: "muscle", d: ellipse(-26, -40, 8, 6) },
      { tissue: "muscle", d: ellipse(26, -40, 8, 6) },
      { tissue: "air", d: ellipse(0, -52, 8, 5) },
      { tissue: "artery", d: ellipse(-30, -26, 3.5, 3.5) },
      { tissue: "artery", d: ellipse(30, -26, 3.5, 3.5) },
      { tissue: "artery", d: ellipse(-24, -2, 2, 2) },
      { tissue: "artery", d: ellipse(24, -2, 2, 2) },
      ...level({ body: "vert-C5", cord: "moelle-cervicale", scale: 0.9, cervical: true }),
    ],
  },
  {
    id: "s-rachis-c6c7",
    label: "Rachis cervical — disque C6-C7",
    y: 158.6,
    items: [...back(1.3, 54), { tissue: "air", d: ellipse(0, -52, 8, 5) }, ...level({ body: "vert-C6", disc: "disque-C6-C7", cord: "moelle-cervicale", scale: 0.95, cervical: true })],
  },
  {
    id: "s-rachis-t8",
    label: "Rachis thoracique — T8",
    y: 250.5,
    items: [
      ...back(1.25, 66),
      { tissue: "lung", d: smooth([[-64, -20], [-50, -50], [-20, -54], [-14, -20], [-26, 6], [-50, 10]]) },
      { tissue: "lung", d: smooth(mirror([[-64, -20], [-50, -50], [-20, -54], [-14, -20], [-26, 6], [-50, 10]])) },
      { tissue: "artery", d: ellipse(14, -46, 6, 6) },
      { tissue: "bone", d: longBone([[-24, -8], [-46, -2], [-62, 10]], [4, 4, 3]) },
      { tissue: "bone", d: longBone([[24, -8], [46, -2], [62, 10]], [4, 4, 3]) },
      ...level({ body: "vert-T8", cord: "moelle-thoracique", scale: 0.85 }),
    ],
  },
  {
    id: "s-rachis-l4l5",
    label: "Rachis lombaire — disque L4-L5",
    y: 381,
    items: [
      ...back(1.3, 72),
      { tissue: "muscle", d: ellipse(-34, -28, 10, 12) },
      { tissue: "muscle", d: ellipse(34, -28, 10, 12) },
      { tissue: "artery", d: ellipse(-10, -54, 5, 5) },
      { tissue: "artery", d: ellipse(10, -54, 5, 5) },
      ...level({ body: "vert-L4", disc: "disque-L4-L5", cord: null, roots: true, scale: 1.05, lumbar: true }),
    ],
  },
  {
    id: "s-rachis-l3",
    label: "Rachis lombaire — L3",
    y: 352.5,
    items: [
      ...back(1.3, 72),
      { tissue: "muscle", d: ellipse(-30, -30, 9, 12) },
      { tissue: "muscle", d: ellipse(30, -30, 9, 12) },
      { tissue: "artery", d: ellipse(4, -54, 6, 6) },
      ...level({ body: "vert-L3", cord: null, roots: true, scale: 1.05, lumbar: true }),
    ],
  },
];

/** Rangées de haut en bas (ordre du curseur). */
export const SPINE_SLICES = SLICES.sort((a, b) => a.y - b.y);
