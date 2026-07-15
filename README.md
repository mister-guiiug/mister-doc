# mister-doc — Planning de gardes (PWA)

Application web progressive (PWA) permettant à une équipe de **médecins d'un
hôpital** de **synchroniser leur planning de gardes** en dehors de l'outil
métier, à partir d'un modèle simple de créneaux mensuels.

> Reprend les bonnes pratiques de la famille d'applications `miss-*`/`mister-*`
> (React 19 + Vite + TypeScript strict, Tailwind 4, `vite-plugin-pwa`, CSP en
> défense en profondeur, Supabase avec RLS), en version **autonome** (aucune
> dépendance à un registre npm privé).

## Fonctionnalités

### Planning
- **Vue mensuelle** groupée par **numéro de semaine ISO**, avec **liste** (mobile)
  ou **grille 7 colonnes** (desktop, bascule mémorisée).
- **Créneaux cliniques** à occupant unique, base horaire métier :
  | Créneau | Libellé | Heures |
  | ------- | ------- | ------ |
  | `S1J`   | S1 Jour | 10 h   |
  | `S1N`   | S1 Nuit | 15 h   |
  | `S2J`   | S2 Jour | 8 h    |

  1 médecin par créneau et par jour ; les créneaux non pourvus sont signalés
  « à couvrir ». **Exception week-end / jours fériés** (fériés FR calculés) :
  seuls `S1J` et `S1N` sont requis.
- **Heures Non Cliniques (HNC, ex-« S3 »)** : plusieurs médecins par jour, chacun
  saisit son **propre nombre d'heures**, **n'importe quel jour**, hors couverture
  « à couvrir ». Comptées dans le temps total **et** dans un compteur HNC dédié.
- **Congés annuels et formations** (heures/jour pour les formations), **notes de
  jour**, **vœux / indisponibilités** (dispo / indispo par jour).
- **Édition partagée** temps réel (Supabase Realtime) : tout médecin approuvé
  affecte n'importe qui, avec **alertes** (repos de sécurité après une nuit,
  conflit garde/absence, cumul). **Confirmation avant chaque suppression.**
- **Échange de gardes** entre médecins (proposition ciblée ou ouverte,
  acceptation qui réaffecte la garde) — page **Échanges**.
- **Compteurs du médecin connecté** (bascule **mois** / **quadrimestre**) :
  vendredis / samedis / dimanches, heures de week-end, **HNC**, heures totales,
  congés, formation.
- **Verrouillage de mois** (admin) pour figer un planning validé.

### Comptes, rôles, admin
- **Authentification Supabase** + barrière d'approbation (voir Sécurité).
- **Profil dédié** (`/profil`) : nom, couleur, thème clair/sombre, abonnement
  calendrier, version + « forcer la mise à jour », déconnexion.
- Un compte **en attente** peut supprimer lui-même sa demande ; un **admin** peut
  l'**approuver** ou la **rejeter**.
- **Vue admin `/compteurs`** : compteurs de toute l'équipe par mois / quadrimestre
  (4 mois) / année, export **CSV**.
- **Aperçu « médecin »** : un admin peut, via le **bouclier** de l'en-tête,
  masquer temporairement ses fonctions admin pour voir l'app comme un non-admin.

### Notifications & sauvegardes
- **Notifications in-app** (cloche, temps réel) : garde attribuée/retirée, absence,
  demande de compte (aux admins), approbation. **Clic = raccourci** vers le bon
  menu (planning au bon mois, ou Admin) ; **glissement latéral = marquer lu**.
- **Sauvegarde/restauration** (admin) + **sauvegarde auto hebdomadaire** (pg_cron).

### Technique
- **PWA installable** (invite d'installation), shell applicatif en cache, mise à
  jour automatique du service worker + bouton de mise à jour forcée.
- Accessibilité (modales Échap + piège de focus), thème clair/sombre,
  optimisations mobile (safe-area, barre d'onglets basse).

## Sécurité (important)

Le dépôt est **public** et la clé `anon` Supabase est présente dans le bundle
(c'est prévu : elle est publique). Toute la sécurité repose donc sur les
**policies RLS** côté serveur et sur une **barrière d'approbation** :

- un nouvel inscrit est **« en attente »** (`approved = false`) et **ne voit
  rien** du planning tant qu'un administrateur ne l'a pas approuvé ; il peut
  supprimer lui-même sa demande, et un admin peut l'**approuver** ou la
  **rejeter** (suppression de la fiche + du compte auth) ;
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
npm run dev               # http://localhost:5173
```

Les icônes PWA sont versionnées dans `public/icons/`. Pour les régénérer
(optionnel), installez `sharp` puis lancez le script :
`npm i -D sharp && npm run icons`.

Scripts utiles : `npm run build`, `npm run preview`, `npm run test`,
`npm run lint`, `npm run type-check`.

## Base de données Supabase

Le schéma versionné est découpé en migrations dans
[`supabase/migrations/`](supabase/migrations/), à appliquer **dans l'ordre**
(`0001` → `0010`) via le **SQL Editor** du tableau de bord Supabase :

| Migration | Contenu |
| --------- | ------- |
| `0001_init` | tables `doctors` / `shifts` / `app_config`, RLS, barrière d'approbation, RPC de base |
| `0002_admin_update_doctor` | édition profil (soi / admin) |
| `0003_leaves` | congés annuels & formations |
| `0004_calendar_feed` · `0005_improvements` | flux .ics (token), tokens par médecin, notes de jour, verrou de mois, réglages |
| `0006_notifications_backups` | notifications (triggers) + sauvegarde/restauration + pg_cron |
| `0007_swaps_wishes` | échanges de gardes + vœux |
| `0008_self_service` | suppression de sa demande en attente |
| `0009_hnc` | **Heures Non Cliniques** (table `hnc_hours`, migration des ex-`S3`) |
| `0010_admin_reject` | rejet admin d'une demande en attente |

Après `0001`, renseignez le code de bootstrap :

```sql
update public.app_config set bootstrap_code = 'VOTRE-CODE-SECRET' where id = 1;
```

## Calendrier (flux .ics)

Un flux **iCalendar** récapitule tout le planning (gardes + congés + formations),
servi par l'Edge Function Supabase [`supabase/functions/calendar`](supabase/functions/calendar/index.ts) :

```
https://<ref>.supabase.co/functions/v1/calendar?token=SECRET          # toute l'équipe
https://<ref>.supabase.co/functions/v1/calendar?token=SECRET&doctor=ID # un médecin
```

L'accès est protégé par un token secret (colonne `app_config.calendar_token`) ;
la fonction lit les données via la clé `service_role` et est déployée avec
`verify_jwt = false` (les agendas ne peuvent pas envoyer de JWT). Dans l'app, le
bouton **Calendrier** de l'en-tête affiche l'URL d'abonnement (équipe ou
personnelle) avec liens webcal / Google Agenda / téléchargement. Les médecins
approuvés récupèrent le token via la RPC `calendar_token()`.

Déploiement de la fonction : `supabase functions deploy calendar --no-verify-jwt`
(ou via l'API Management). Définir ensuite le token :
`update public.app_config set calendar_token = 'SECRET' where id = 1;`

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
  lib/        env (validation JS) · client Supabase · dates (semaine ISO) ·
              créneaux + compteurs · congés · HNC · validation/alertes · thème · couleurs
  backend/    types · doctors · planning (shifts) · leaves · hnc · notes · wishes ·
              swaps · hnc · notifications · backup · locks · settings · calendar
  auth/       contexte + porte d'authentification + page de connexion
  features/   planning/ (liste + grille, compteurs, dialogues affect./congé/note/HNC) ·
              swaps/ · admin/ (panel, compteurs équipe, sauvegarde) · profile/ · pending/
  components/ en-tête · barre d'onglets basse · cloche notifications · modale ·
              toast · thème · calendrier · profil · invite d'installation · spinner
```

Tests (`src/lib/*.test.ts`) : compteurs, semaine ISO, créneaux actifs, congés,
alertes de validation.
