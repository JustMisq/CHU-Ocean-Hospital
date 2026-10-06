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
npm install
npm run db:generate
npm run db:push        # crée packages/db/dev.db
npm run db:seed        # grades / services / spécialités d'exemple + comptes de démo
npm run dev            # http://localhost:3000
```

Variables : `packages/db/.env` (Prisma CLI) et `apps/web/.env.local` (voir `apps/web/.env.example`).
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

1. Créer une base Postgres (Neon / Supabase).
2. `packages/db/prisma/schema.prisma` : `provider = "postgresql"` ; dans `packages/db/src/index.ts`, remplacer l'adapter SQLite par `@prisma/adapter-pg`.
3. Vercel : Root Directory = `apps/web`, variables de `.env.example` (sans `AUTH_DEV_LOGIN`).

## Bot Discord (plus tard)

- Synchro en direct des nouveaux membres et des changements de rôles : appeler `syncDiscordMember` sur `guildMemberAdd` / `guildMemberUpdate`.
- Notifications : lire la table `BotEvent` (`appointment.created|cancelled|completed`), puis marquer `processedAt`.
