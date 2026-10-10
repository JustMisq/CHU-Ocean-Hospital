# Sources des dessins anatomiques

| Fichier / dessin | Origine | Licence |
|---|---|---|
| `skeleton-front.svg` | « Human skeleton front no-text no-color » par **LadyofHats** (Mariana Ruiz Villarreal), [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Human_skeleton_front_no-text_no-color.svg) | Domaine public (placé dans le domaine public par l'autrice) |
| `body-highlighter-polygons.ts.txt` | Polygones de [react-body-highlighter](https://github.com/giavinh79/react-body-highlighter) v2.0.5 (GV79) | MIT — voir `body-highlighter-LICENSE.txt` |
| Muscles, nerfs, artères, poumons, cœur, appareils digestif et urinaire, cerveau, crâne et rachis | **Servier Medical Art** par Servier, [smart.servier.com](https://smart.servier.com) — kits PowerPoint « Muscles », « Nervous system », « Arteries physiology », « Respiratory system », « Digestive system », « Urinary system », « Bones » | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |

**Attribution Servier (CC BY 4.0)** : « Illustrations adaptées de Servier Medical Art (smart.servier.com), sous licence CC BY 4.0. »
Modifications apportées : sélection de parties des figures, conversion en SVG, déformation (plaque mince) pour les recaler sur la
planche du squelette, découpage en structures (muscles, lobes, vertèbres, os du crâne…), changement d'orientation.

Les fichiers de données utilisés par le site sont **générés** à partir de ces sources ; ne pas les modifier à la main :
- `../skeleton-arm.ts`, `../body-zones.ts` : `apps/web/scripts/build-atlas.mts` (`npx tsx scripts/build-atlas.mts` depuis `apps/web`) ;
- `../plate-bones.ts`, `../*-shapes.ts`, `../*-art.ts` : `apps/web/scripts/build-body.mts`
  (`npx tsx scripts/build-body.mts <dossier des kits Servier décompressés>` depuis `apps/web`).

Les kits Servier eux-mêmes ne sont pas versionnés (fichiers volumineux) : les télécharger sur smart.servier.com et décompresser
chaque `.pptx` dans un dossier `x-<Nom>` (ex : `x-Muscles`).
