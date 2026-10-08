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
| `agenda.view_all` | Voir l'agenda de tout l'hôpital |
| `appointments.manage_all` | Clôturer / annuler les RDV des autres soignants |
| `staff.manage` | Page Personnel (uniquement les grades **inférieurs** au sien) |
| `staff.manage_peers` | En plus de `staff.manage` : modifier son propre profil et ceux de **même grade** (services, spécialités, annuaire — jamais le grade). Pour la co-direction. |
| `stats.view` | Page Statistiques |
| `audit.view` | Page Journal (changements de grade, annulations, configuration) |
| `settings.manage` | Page Configuration |

## Rendez-vous

- **Déplacer** : le patient choisit un autre créneau libre du même soignant depuis son espace (mêmes délais que l'annulation en ligne) ;
  le soignant (ou `appointments.manage_all`) peut fixer librement une nouvelle date depuis la fiche du RDV. Tracé dans le journal.
- **Absences** : un RDV marqué « Patient absent » compte dans le dossier. Le nombre de RDV, d'honorés et d'absences s'affiche
  sur le dossier patient, la fiche du RDV et dans « Mes personnages ». Un avertissement est affiché au patient avant de réserver.

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
