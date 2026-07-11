# mister-doc — Planning anesthésie (PWA)

Application web progressive (PWA) permettant à une équipe de médecins
anesthésistes de **synchroniser leur planning de gardes** en dehors de l'outil
métier, à partir d'un modèle simple de créneaux mensuels.

> Reprend les bonnes pratiques de la famille d'applications `miss-*`/`mister-*`
> (React 19 + Vite + TypeScript strict, Tailwind 4, `vite-plugin-pwa`, CSP en
> défense en profondeur, Supabase avec RLS), en version **autonome** (aucune
> dépendance à un registre npm privé).

## Fonctionnalités

- **Vue mensuelle** groupée par **numéro de semaine ISO**.
- **4 créneaux par jour** avec base horaire métier :
  | Créneau | Libellé  | Heures |
  | ------- | -------- | ------ |
  | `S1J`   | S1 Jour  | 10 h   |
  | `S1N`   | S1 Nuit  | 15 h   |
  | `S2J`   | S2 Jour  | 8 h    |
  | `S3`    | S3       | 8 h    |

  1 médecin par créneau et par jour ; les jours sans garde principale (`S1J`)
  sont signalés « à couvrir ».
- **Multi-médecins** : tout le monde voit le planning de tout le monde.
- **Édition partagée** : tout médecin approuvé peut affecter n'importe quel
  médecin (soi-même en un clic) et libérer un créneau. Mises à jour **en temps
  réel** (Supabase Realtime).
- **Compteurs du médecin connecté** (sur le mois affiché) : nombre de vendredis,
  samedis, dimanches de garde, **heures de week-end** (ven + sam + dim) et
  **heures totales**.
- **Authentification Supabase** (e-mail / mot de passe) + **PWA installable**,
  utilisable hors-ligne (shell applicatif mis en cache).

## Sécurité (important)

Le dépôt est **public** et la clé `anon` Supabase est présente dans le bundle
(c'est prévu : elle est publique). Toute la sécurité repose donc sur les
**policies RLS** côté serveur et sur une **barrière d'approbation** :

- un nouvel inscrit est **« en attente »** (`approved = false`) et **ne voit
  rien** du planning tant qu'un administrateur ne l'a pas approuvé ;
- le **premier administrateur** se débloque via un **code de bootstrap** secret
  (stocké dans `app_config`, jamais exposé au client) : écran « Compte en
  attente » → « J'ai un code d'administrateur ». Le code ne fonctionne que tant
  qu'aucun admin n'existe ;
- toutes les écritures sensibles (approbation, rôles, roster) passent par des
  fonctions Postgres `SECURITY DEFINER`.

Ne committez **jamais** la clé `service_role` ni un token `sbp_…` (Management
API). Le fichier `.env` est ignoré par git.

## Développement local

```bash
npm install
cp .env.example .env      # puis renseignez URL + clé anon (Supabase → Settings → API)
npm run icons             # génère les icônes PWA (public/icons)
npm run dev               # http://localhost:5173
```

Scripts utiles : `npm run build`, `npm run preview`, `npm run test`,
`npm run lint`, `npm run type-check`.

## Base de données Supabase

Le schéma versionné se trouve dans [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
(tables `doctors`, `shifts`, `app_config` + RLS + RPC). Pour l'appliquer sur un
nouveau projet, collez-le dans le **SQL Editor** du tableau de bord Supabase,
puis renseignez le code de bootstrap :

```sql
update public.app_config set bootstrap_code = 'VOTRE-CODE-SECRET' where id = 1;
```

## Déploiement (GitHub Pages)

Le workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
construit et publie sur GitHub Pages avec `base = /mister-doc/`. Renseignez au
préalable, dans **Settings → Secrets and variables → Actions → Variables** :

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

puis activez **Settings → Pages → Source : GitHub Actions**.

## Architecture

```
src/
  lib/        env (zod) · client Supabase · dates (semaine ISO) · créneaux + compteurs
  backend/    types · accès doctors (RPC) · accès planning (shifts + realtime)
  auth/       contexte + porte d'authentification + page de connexion
  features/   planning/ (grille, compteurs, dialogue) · admin/ · pending/
  components/  en-tête · spinner
```

Logique métier des compteurs et du numéro de semaine couverte par des tests
(`src/lib/shifts.test.ts`).
