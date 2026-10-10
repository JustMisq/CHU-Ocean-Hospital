# Ocean Hospital

Site de prise de rendez-vous (style Doctolib) pour l'hôpital d'un serveur GTA RP.
Ce n'est pas un MDT : la prise de service et le terrain restent en jeu. Le site gère les RDV, le suivi patient et l'organisation de l'hôpital.
Il fonctionne seul, sans bot ni lien avec Discord : comptes identifiant + mot de passe, tout se gère sur le site.

```
apps/web      Site Next.js 16 (public, espace patient, espace pro, configuration)
packages/db   Schéma Prisma 7 + client + logique partagée (permissions, réglages, mots de passe)
```

## Démarrer en local

```bash
npm install            # génère aussi le client Prisma
npm run db:push        # crée / met à jour les tables dans la base Postgres
npm run db:seed        # grades / services / spécialités d'exemple + comptes de démo
npm run dev            # http://localhost:3000
```

Variables : `packages/db/.env` (Prisma CLI) et `apps/web/.env.local` (voir `apps/web/.env.example`).
`DATABASE_URL` est la même URL Postgres dans les deux fichiers (celle de la base Neon créée sur Vercel).
Avec `AUTH_DEV_LOGIN="true"`, `/connexion` propose des comptes de démo sans mot de passe.

## Première configuration

1. Créer ton compte super-admin (accès total, même sans grade) :
   ```bash
   npm run admin -- <identifiant> <motdepasse>
   ```
2. Se connecter sur `/connexion`, aller dans **Espace pro → Configuration** :
   - **Général** : nom de l'hôpital, inscription libre ou non, règles de réservation et d'annulation ;
   - **Grades** : hiérarchie (ordre), couleur, permissions, réservable ou non ;
   - **Services** : affichés sur le site public ;
   - **Spécialités** : compétences en plus.
3. **Personnel** : créer les comptes des soignants (voir ci-dessous).

## Comptes

| Qui | Comment |
|---|---|
| Citoyen / patient | S'inscrit lui-même sur `/inscription` (désactivable dans Configuration → Général) avec le prénom et le nom de son personnage : le dossier patient est créé en même temps. |
| EMS / médecin | La direction crée son compte dans **Personnel → Créer un compte soignant** : un mot de passe temporaire s'affiche une fois, à transmettre en jeu. Il le change à sa première connexion. |
| Citoyen qui rejoint l'hôpital | **Personnel → Promouvoir un compte existant** : il garde son compte et ses personnages. |
| Mot de passe oublié | **Personnel → Réinitialiser un mot de passe** (patients, ou soignants de grade inférieur). |

Tout compte a au moins un personnage : s'il n'en a aucun (ex : compte soignant), il est créé automatiquement depuis son nom
(« Dr. Jordan Reyes » → Jordan Reyes) à la première visite de l'espace patient ou de la prise de RDV.
Seuls prénom et nom sont obligatoires ; date de naissance, groupe sanguin, téléphone et allergies se complètent plus tard,
par le joueur (bandeau « dossier incomplet ») ou par un soignant depuis **Patients** (permission `patients.history`,
ou soignant ayant déjà eu ce patient en RDV). Chaque modification par un soignant est tracée dans le journal.

Mots de passe hachés avec scrypt. Compte bloqué 15 min après 5 échecs de connexion.

Avoir un grade = accès à l'espace pro. Pas de grade = patient. Grades, services et spécialités s'attribuent dans **Personnel**.

Apparaître dans l'annuaire public et recevoir des RDV : réglé par grade (case « réservable »), et modifiable par membre dans
**Personnel** (selon le grade / toujours / jamais) — ex : un ambulancier n'est pas dans l'annuaire.
Le soignant peut en plus se masquer lui-même depuis **Mon profil**.

Photo et bannière d'un soignant : envoyées depuis **Mon profil** (glisser-déposer), stockées dans la base. Sans photo : initiales.

## Permissions (cochées par grade)

| Permission | Effet |
|---|---|
| `patients.history` | Page Patients : tous les dossiers (historique, infos médicales modifiables) |
| `documents.view_all` | Zone Documents : voir les documents de tout l'hôpital (sinon seulement les siens) |
| `documents.revoke_all` | Annuler les documents rédigés par d'autres soignants |
| `doc.read.<TYPE>` / `doc.write.<TYPE>` | Par type de document (ordonnance, arrêt de travail, décès…) : **Aucun / Lecture / Rédaction**, réglé dans le tableau « Documents » du grade. La rédaction inclut la lecture ; un soignant voit toujours ce qu'il a rédigé, un patient toujours ses documents. |
| `agenda.view_all` | Voir l'agenda de tout l'hôpital |
| `appointments.manage_all` | Clôturer / annuler les RDV des autres soignants |
| `staff.manage` | Page Personnel (uniquement les grades **inférieurs** au sien) |
| `staff.manage_peers` | En plus de `staff.manage` : modifier son propre profil et ceux de **même grade** (services, spécialités, annuaire — jamais le grade). Pour la co-direction. |
| `stats.view` | Page Statistiques |
| `audit.view` | Page Journal (changements de grade, annulations, configuration) |
| `settings.manage` | Page Configuration |
| `requests.view_all` | Demandes et transferts : voir et traiter ceux de tout l'hôpital (sinon ceux de ses services) |
| `requests.configure` | Configurer les types de demandes de tous les services (un chef de service le peut toujours pour le sien) |

## Rendez-vous

- **Déplacer** : le patient choisit un autre créneau libre du même soignant depuis son espace (mêmes délais que l'annulation en ligne) ;
  le soignant (ou `appointments.manage_all`) peut fixer librement une nouvelle date depuis la fiche du RDV. Tracé dans le journal.
- **Absences** : un RDV marqué « Patient absent » compte dans le dossier. Le nombre de RDV, d'honorés et d'absences s'affiche
  sur le dossier patient, la fiche du RDV et dans « Mes personnages ». Un avertissement est affiché au patient avant de réserver.

## Documents

Zone **Documents** de l'espace pro (droits par type de document, voir Permissions) : on choisit le type, puis le patient, puis on rédige.
Aussi accessible depuis le dossier patient et la fiche d'un RDV. PDF : `/api/documents/<id>` (`?dl=1` pour télécharger) ; image PNG du même document (toutes les pages) : `?format=png` (convertie
côté serveur par pdf.js, boutons « PDF » et « PNG » dans les listes de documents).
Le patient retrouve ses documents dans **Mon espace → Mes documents**.

Types : ordonnance, prescription d'examens, certificat médical, arrêt de travail, certificat de décès (marque le dossier
« décédé », plus de prise de RDV), refus de soins (décharge signée), refus de signer la décharge (attestation devant témoin).
Tout ce qui définit un type (champs, numérotation, validité) est dans `apps/web/src/lib/document-types.ts`, son texte imprimé
dans `apps/web/src/lib/document-pdf.tsx` ; un nouveau type = une valeur dans l'enum `DocumentKind` + ces deux fichiers.

- **Patient sans compte** : dans l'assistant, « Créer un dossier sans compte » (nom, naissance…). Le dossier se **rattache** plus
  tard au compte du joueur depuis le dossier patient (`patients.history`) : comme nouveau personnage, ou **fusionné** avec le
  personnage qu'il a déjà créé (RDV et documents regroupés).
- **Par service** (Configuration → Services) : code de numérotation (`KINE` → `KINE-202609-0001` ; sinon préfixe du type :
  `AT-…`, `DC-…`) et chef de service affiché en marge.
- **Par soignant** (Mon profil) : titre imprimé (« Masseur-kinésithérapeute D.E. ») et signature dessinée, apposée sur le cachet.
- **Hôpital** (Configuration → Général) : ville et adresse imprimées.
- Le patient reçoit un n° (`PAT-AAAAMM-NNNN`, code-barres) à son premier document.
- Un document émis n'est **jamais modifié** : l'en-tête est figé (`snapshot`), signature comprise. On peut seulement l'**annuler**
  (auteur ou super-admin) : il reste dans le dossier, barré « ANNULÉE ».
- Rédiger un document pour un patient donne accès à son dossier (comme l'avoir eu en RDV).
- **Patient non identifié** : nom laissé vide → « INCONNU X-0001 » ; on note l'âge apparent et les signes distinctifs.

## Imagerie (radio, scanner, IRM)

Type de document **Compte rendu d'imagerie** (zone Documents). Tout le corps est couvert, région par région :
**tête et cou**, **membres supérieurs**, **thorax**, **abdomen et bassin**, **membres inférieurs** (sur la silhouette) et **rachis
entier** (bouton sous la silhouette).

- **Carte du corps** : silhouette → région → segment → structure → partie (ex : membre inférieur › genou › plateau tibial latéral ;
  thorax › cage thoracique › côtes droites › 6e côte droite ; tête › encéphale › lobe temporal). Survol en rouge, clic pour zoomer,
  molette et glisser comme une carte, fil d'Ariane.
- **Les 3 examens sont différents** : ce qu'on peut sélectionner, les lésions proposées, la technique (incidences / injection /
  séquences) et le rendu. Fenêtres et séquences selon la région : scanner parties molles, osseux, pulmonaire, cérébral ;
  IRM T1, T2, fat-sat, gadolinium, et pour le cerveau FLAIR, diffusion, T2*.
- **La carte est l'image de l'examen** : cliché en radio (poumons noirs, gaz digestif, os), reconstruction au scanner, coupe IRM
  selon la séquence. Bouton « Atlas » pour l'illustration anatomique (chargée seulement à la demande).
- **Calques** : os, muscles, tendons et ligaments, système nerveux, vaisseaux, organes — ensemble ou un seul (double-clic) ;
  ceux que l'examen ne voit pas sont grisés.
- **Coupes axiales** (scanner, IRM) qu'on fait défiler, avec la ligne de coupe sur la carte. Les lésions y sont dessinées selon leur
  aspect réel (hématome extradural en lentille, sous-dural en croissant, AVC clair en diffusion, pneumothorax, hémopéritoine…).
- **Régions médianes** (tête, thorax, abdomen, rachis) : le côté se précise lésion par lésion (« du lobe temporal droit »).
- **Classifications** proposées selon la structure : Garden (col du fémur), Schatzker (plateau tibial), Danis-Weber (malléole),
  Le Fort (maxillaire), AO Spine (vertèbres), Young-Burgess (bassin), AAST (foie, rate, rein).
- **Compte rendu** : indication, technique (générée), résultats (générés depuis les lésions), conclusion ; PDF avec planche numérotée.

Code : `apps/web/src/lib/imaging/` — socle commun dans `anatomy.ts` (types, calques, navigation), une région par fichier dans
`regions/` (structures + coupes), lésions et techniques dans `catalog.ts`, niveaux de gris et lésions en coupe dans `render.ts` —
et `apps/web/src/components/imaging/`.

**Dessins** (crédits et licences : `apps/web/src/lib/imaging/atlas/source/SOURCES.md`) :
- os du membre supérieur, du membre inférieur, du thorax et du bassin : planche du squelette de **LadyofHats** (domaine public) ;
- muscles, nerfs, artères, organes, cerveau, crâne et rachis : **Servier Medical Art** (CC BY 4.0), recalés sur la planche ;
- silhouette de choix de zone : polygones de **react-body-highlighter** (MIT).

Fichiers générés (locaux uniquement, aucun accès à la base) :
- `atlas/skeleton-arm.ts`, `atlas/body-zones.ts` : `cd apps/web && npx tsx scripts/build-atlas.mts` ;
- tout le reste de `atlas/` : `cd apps/web && npx tsx scripts/build-body.mts <dossier des kits Servier décompressés>`. Les kits
  (fichiers PowerPoint de smart.servier.com, décompressés en dossiers `x-Muscles`, `x-Bones`…) ne sont pas dans le dépôt ;
  un second argument facultatif donne un dossier d'images de contrôle.
## Demandes entre services, transferts, notifications

Ce qui passait par Discord se fait sur le site (page **Demandes** de l'espace pro, ou depuis le dossier patient).

- **Demande à un service** (ex : la chirurgie vasculaire demande une analyse au labo). Chaque service a ses **types de demandes**,
  configurés par la direction ou son chef de service (« Types de demandes ») :
  - le **formulaire du demandeur** (analyses à cocher, zone à imager, réquisition…) ;
  - ce que le service remplit **pour accepter** (date d'intervention, n° de scellé…) — vide : un clic ;
  - ce qu'il remplit **pour répondre** (résultats, avis, score ASA…), et éventuellement le **document à rédiger** en réponse
    (ex : compte rendu d'imagerie), rédigé depuis la demande et rattaché à elle ;
  - les **prérequis** : documents que le patient doit avoir (ex : certificat de décès avant les pompes funèbres) et demandes déjà
    traitées (ex : consultation d'anesthésie avant une intervention).
  Des **modèles** adaptés à chaque service sont proposés (labo, imagerie, anesthésie, chirurgies, médecine légale, pompes funèbres,
  kiné, infirmiers, psy, avis spécialisés, administration) : on les ajoute en un clic puis on les adapte. Une « demande d'avis »
  libre reste toujours possible vers n'importe quel service.
- **Transfert de patient** (ex : la réa transfère en neuro) : état, diagnostic, soins en cours ; le service le **prend en charge**.
  Le dossier patient affiche le service où il se trouve.
- Une demande est adressée à **tout le service** (ou à un membre précis), avec une **priorité** (normale, urgente, vitale).
  Statuts : en attente → acceptée → terminée (ou refusée avec motif, ou annulée par le demandeur). Un **fil d'échanges** permet
  de se parler sur chaque demande. Le service destinataire accède au dossier du patient concerné.
- **Notifications** (cloche en haut du site, pour soignants et patients) : nouvelle demande pour son service, réponse, message,
  transfert pris en charge ; RDV réservé, déplacé ou annulé ; nouveau document dans son dossier (patient). Le nombre de
  demandes à traiter s'affiche aussi dans le menu « Demandes ».
## Données conservées

- Un personnage supprimé par un joueur qui a déjà eu des RDV est **archivé**, pas effacé : son dossier reste visible des soignants.
- Les RDV ne sont jamais supprimés par effet de bord (`onDelete: Restrict`).
- Le journal trace les actions sur le personnel, la configuration et les RDV gérés pour un autre soignant.

## Vérifications

```bash
npm run lint
npm run typecheck
```

Lancées automatiquement par GitHub Actions (`.github/workflows/ci.yml`) à chaque push sur `main` et sur les PR.

## Production (Vercel)

1. Projet Vercel → **Storage** → **Create Database** → **Neon** → connecter au projet (ajoute `DATABASE_URL`).
2. Copier cette `DATABASE_URL` dans `packages/db/.env` et `apps/web/.env.local`, puis `npm run db:push` (et `npm run db:seed` si besoin).
3. Vercel : variables de `.env.example`. **Ne pas mettre `AUTH_DEV_LOGIN`** en production (n'importe qui pourrait se connecter en démo).
4. `npm run admin -- <identifiant> <motdepasse>` (avec la `DATABASE_URL` de production) pour le premier compte.
