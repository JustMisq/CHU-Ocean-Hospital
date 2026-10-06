# Ocean Hospital

Site de prise de rendez-vous (style Doctolib) pour l'hôpital d'un serveur GTA RP, relié à Discord.
Ce n'est pas un MDT : la prise de service et le terrain restent en jeu. Le site gère les RDV, le suivi patient et l'organisation de l'hôpital.

```
apps/web      Site Next.js 16 (public, espace patient, espace pro, configuration)
packages/db   Schéma Prisma 7 + client + logique partagée (permissions, réglages, synchro Discord)
apps/bot      (à venir) Bot Discord
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
Avec `AUTH_DEV_LOGIN="true"`, `/connexion` propose des comptes de démo sans Discord.

## Première configuration

1. Discord Developer Portal → New Application → **OAuth2** : redirect `http://localhost:3000/api/auth/callback/discord`,
   puis Client ID / Secret dans `AUTH_DISCORD_ID` / `AUTH_DISCORD_SECRET`.
2. Mettre **ton ID Discord** dans `ADMIN_DISCORD_IDS` → accès total au site, même sans grade.
3. Se connecter, aller dans **Espace pro → Configuration** :
   - **Général & Discord** : nom de l'hôpital, ID du serveur Discord, règles de réservation ;
   - **Grades** : hiérarchie (ordre), couleur, permissions, réservable ou non, IDs de rôles Discord ;
   - **Services** : affichés sur le site public, IDs de rôles Discord ;
   - **Spécialités** : compétences en plus, IDs de rôles Discord.

## Synchronisation Discord

À chaque connexion (et plus tard via le bot), `syncDiscordMember` (`packages/db/src/discord-sync.ts`) :

- donne au membre le **grade le plus haut** parmi ceux liés à ses rôles Discord ;
- lui donne **tous** les services et spécialités liés à ses rôles ;
- retire ce qui est lié à un rôle qu'il n'a plus ;
- **ne touche pas** aux éléments sans ID Discord, qui s'attribuent à la main dans **Personnel**.

Avoir un grade = accès à l'espace pro. Pas de grade = patient.

## Permissions (cochées par grade)

| Permission | Effet |
|---|---|
| `patients.history` | Voir l'historique médical d'un patient sur un RDV |
| `agenda.view_all` | Voir l'agenda de tout l'hôpital |
| `appointments.manage_all` | Clôturer / annuler les RDV des autres soignants |
| `staff.manage` | Page Personnel (uniquement les grades **inférieurs** au sien) |
| `stats.view` | Page Statistiques |
| `settings.manage` | Page Configuration |

## Production (Vercel)

1. Projet Vercel → **Storage** → **Create Database** → **Neon** → connecter au projet (ajoute `DATABASE_URL`).
2. Copier cette `DATABASE_URL` dans `packages/db/.env` et `apps/web/.env.local`, puis `npm run db:push` (et `npm run db:seed` si besoin).
3. Vercel : variables de `.env.example` (`AUTH_DEV_LOGIN` seulement le temps de configurer Discord, puis la supprimer), et ajouter
   `https://<ton-domaine>/api/auth/callback/discord` dans les redirects OAuth2 Discord.

## Bot Discord (plus tard)

- Synchro en direct des nouveaux membres et des changements de rôles : appeler `syncDiscordMember` sur `guildMemberAdd` / `guildMemberUpdate`.
- Notifications : lire la table `BotEvent` (`appointment.created|cancelled|completed`), puis marquer `processedAt`.
