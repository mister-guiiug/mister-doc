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
- **Créneaux cliniques configurables** à occupant unique : les types de garde ne
  sont plus codés en dur, un **admin** les crée, édite, réordonne et désactive
  (libellé, heures, « clinique », « requis le week-end », « nuit », horaires du
  flux .ics, couleur) — voir
  [docs/spec-creneaux-configurables.md](docs/spec-creneaux-configurables.md).
  Configuration par défaut :

  | Créneau | Libellé | Heures | Week-end | Nuit |
  | ------- | ------- | ------ | -------- | ---- |
  | `S1J`   | S1 Jour | 10 h   | oui      | non  |
  | `S1N`   | S1 Nuit | 15 h   | oui      | oui  |
  | `S2J`   | S2 Jour | 8 h    | non      | non  |

  1 médecin par créneau et par jour ; les créneaux non pourvus sont signalés
  « à couvrir ». **Exception week-end / jours fériés** (fériés FR calculés) :
  seuls les créneaux marqués « requis le week-end » le sont.

- **Heures Non Cliniques (HNC, ex-« S3 »)** : plusieurs médecins par jour, chacun
  saisit son **propre nombre d'heures**, **n'importe quel jour**, hors couverture
  « à couvrir ». Comptées dans le temps total **et** dans un compteur HNC dédié.
- **Congés annuels et formations** (heures/jour pour les formations), **notes de
  jour**, **vœux / indisponibilités** (dispo / indispo par jour).
- **Édition partagée** temps réel (Supabase Realtime) : tout médecin approuvé
  affecte n'importe qui, avec **alertes** (repos de sécurité après une nuit,
  conflit garde/absence, cumul). **Confirmation avant chaque suppression.**
- **Affectation sur plusieurs semaines** : depuis le dialogue d'affectation,
  répéter le même médecin sur le même créneau **1 à 4 semaines** consécutives
  (mêmes jours de semaine).
- **Copier le mois précédent** : reprend ses gardes dans le mois affiché,
  **alignées sur le jour de semaine** ; **récapitulatif** (gardes à créer,
  ignorées et pourquoi) avant toute écriture, et aucun créneau déjà attribué
  n'est écrasé.
- **Bourse aux gardes** : proposer une de ses gardes (ciblée ou ouverte à tous)
  depuis la bourse (« Proposer une garde ») ou le planning ; **accepter réaffecte
  la garde** ; tri par date, « dans N j » et **historique** — page **Échanges**.
- **Mon planning** (`/mon-planning`) : agenda **personnel** du mois (mes gardes,
  absences, HNC) en liste, avec compteurs perso et abonnement calendrier.
- **Compteurs du médecin connecté** (bascule **mois** / **quadrimestre**) :
  vendredis / samedis / dimanches, heures de week-end, **HNC**, heures totales,
  congés, formation. Deux vues en **carrousel** : pastilles ou **mini-calendrier**
  du mois.
- **Verrouillage de mois** (admin) pour figer un planning validé.

### Comptes, rôles, admin

- **Authentification Supabase** + barrière d'approbation (voir Sécurité).
- **Profil dédié** (`/profil`) : nom, couleur, thème clair/sombre, **langue
  (français / anglais)**, abonnement calendrier, **partage du lien de l'app**,
  **notifications push** (opt-in), version + « forcer la mise à jour »,
  déconnexion.
- Un compte **en attente** peut supprimer lui-même sa demande ; un **admin** peut
  l'**approuver** ou la **rejeter**.
- **Vue admin `/compteurs`** : compteurs de toute l'équipe (bascule **Tableau /
  Équité**) par mois / quadrimestre (4 mois) / année, colonnes **triables** dans
  la vue Tableau, export **CSV**, **Excel (.xlsx)** et **PDF**.
- **Types de créneaux** (carte d'admin) : créer, éditer, réordonner et
  (dés)activer les créneaux ; la suppression n'est possible que si aucune garde
  ni proposition d'échange ne les utilise.
- **Aperçu « médecin »** : un admin peut, via le **bouclier** de l'en-tête,
  masquer temporairement ses fonctions admin pour voir l'app comme un non-admin.

### Notifications & sauvegardes

- **Notifications in-app** (cloche, temps réel) : garde attribuée/retirée, absence
  (posée/supprimée, **groupée par plage**), HNC, échange proposé/accepté/décliné,
  mois verrouillé/déverrouillé, demande de compte (aux admins), approbation,
  **rappel de garde** et **récapitulatif hebdomadaire**.
  **Clic = raccourci** vers le bon menu ; **glissement latéral = marquer lu** ;
  **toast** à l'arrivée d'une notif app ouverte. Une **affectation en lot** (copie
  de mois) ne donne qu'**une seule** notification par médecin.
- **Rappels de garde** (pg_cron, quotidien) : « garde demain » et « nuit ce
  soir » ; **récapitulatif hebdomadaire** (pg_cron, dimanche) listant les gardes
  des 7 jours à venir. Les deux sont aussi déclenchables à la main depuis les
  réglages admin.
- **Notifications push** (optionnel) : reçues même app fermée, via service worker +
  VAPID. Opt-in depuis le profil. Configuration : [docs/notifications-push.md](docs/notifications-push.md).
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

**Connexion** : mot de passe (principal), avec deux options **opt-in** par médecin
depuis le profil — **double authentification** TOTP (code à 6 chiffres + codes de
secours) et **connexion par empreinte** / Face ID / Windows Hello (**passkeys**
WebAuthn natives de Supabase Auth, beta). Les passkeys exigent une activation côté
dashboard Supabase (RP ID + origine) — voir [`docs/deploiement.md`](docs/deploiement.md).

Ne committez **jamais** la clé `service_role` ni un token `sbp_…` (Management
API). Le fichier `.env` est ignoré par git.

**Confidentialité (RGPD)** : une **politique de confidentialité** est accessible
avant connexion (page de login) et depuis le profil — c'est un **modèle** dont les
mentions légales `[À compléter]` (responsable du traitement, base légale, durées,
contact) doivent être renseignées avant mise en service. Chaque médecin peut
**exporter ses données** (droit d'accès / portabilité, art. 15/20) en JSON depuis
son profil. **Effacement** (droit à l'oubli, art. 17) : un compte en attente se
supprime lui-même ; un compte **approuvé** peut **s'anonymiser** depuis son profil
(ou via un admin) — l'identité (nom, e-mail, connexion) est effacée tandis que les
gardes passées restent au planning sous une identité anonyme (intégrité préservée).

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
[`supabase/migrations/`](supabase/migrations/), appliquées **dans l'ordre**
(`0001` → `0026`). Pour une instance existante, le déploiement (Edge Functions +
migrations `≥ 0014`) est **automatisé par la CI** — workflow
[`.github/workflows/supabase.yml`](.github/workflows/supabase.yml), déclenché sur
tout changement `supabase/**` sur `main`. Détails, secrets requis et procédure
manuelle de repli : [`docs/deploiement.md`](docs/deploiement.md).

> ⚠️ Les migrations **`0001`→`0013` ne sont jamais appliquées par la CI** (l'une
> d'elles supprime des données) : sur une base neuve, il faut les passer **à la
> main** dans l'éditeur SQL, sans `supabase db push`. La CI en vérifie ensuite la
> présence et refuse de continuer s'il en manque une.

| Migration                                  | Contenu                                                                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `0001_init`                                | tables `doctors` / `shifts` / `app_config`, RLS, barrière d'approbation, RPC de base                                           |
| `0002_admin_update_doctor`                 | édition profil (soi / admin)                                                                                                   |
| `0003_leaves`                              | congés annuels & formations                                                                                                    |
| `0004_calendar_feed` · `0005_improvements` | flux .ics (token), tokens par médecin, notes de jour, verrou de mois, réglages                                                 |
| `0006_notifications_backups`               | notifications (triggers) + sauvegarde/restauration + pg_cron                                                                   |
| `0007_swaps_wishes`                        | échanges de gardes + vœux                                                                                                      |
| `0008_self_service`                        | suppression de sa demande en attente                                                                                           |
| `0009_hnc`                                 | **Heures Non Cliniques** (table `hnc_hours`, migration des ex-`S3`)                                                            |
| `0010_admin_reject`                        | rejet admin d'une demande en attente                                                                                           |
| `0011_shift_history`                       | historique des changements par créneau                                                                                         |
| `0012_notif_improvements`                  | améliorations des notifications                                                                                                |
| `0013_push_subscriptions`                  | abonnements Web Push                                                                                                           |
| `0014_calendar_rate_limit`                 | **rate-limit** de l'Edge Function calendrier (table `edge_rate_limit` + RPC `edge_rate_limit_hit`)                             |
| `0015_calendar_token_privacy`              | **confidentialité** du token calendrier (privilège colonne : `calendar_token` illisible par les autres médecins)               |
| `0016_extend_month_lock`                   | verrou de mois **étendu** aux HNC / notes / vœux (triggers `assert_month_unlocked`)                                            |
| `0017_audit_log`                           | **journal d'audit** admin (table `audit_log` + triggers sur `doctors` / `locked_months`)                                       |
| `0018_calendar_token_hash`                 | tokens calendrier **hashés au repos** (SHA-256 ; plus de token en clair en base ; lien montré une seule fois)                  |
| `0019_anonymize_doctor`                    | **effacement RGPD** des comptes approuvés par **anonymisation** (RPC `anonymize_doctor`, self-service ou admin)                |
| `0020_admin_reset_mfa`                     | **récupération 2FA** : un admin réinitialise la double authentification d'un médecin (RPC `admin_reset_mfa`)                   |
| `0021_mfa_recovery_codes`                  | **codes de secours 2FA** self-service (table `mfa_recovery_codes` hashés + RPC `generate_`/`use_mfa_recovery_code`)            |
| `0022_shift_types`                         | **créneaux configurables** (table `shift_types`, CHECK → FK, RPC admin `admin_upsert_/set_active_/reorder_/delete_shift_type`) |
| `0023_shift_reminders`                     | **rappels de garde** quotidiens (`enqueue_shift_reminders` + job pg_cron, RPC `admin_send_reminders`)                          |
| `0024_weekly_digest`                       | **récapitulatif hebdomadaire** (`enqueue_weekly_digest` + job pg_cron, RPC `admin_send_weekly_digest`)                         |
| `0025_copy_previous_month`                 | **copie de mois** (RPC `assign_shifts_bulk`) + notifications d'affectation **groupées** à l'INSERT                             |
| `0026_weekly_digest_idempotence`           | clé d'idempotence du récapitulatif ancrée sur le **lundi de la semaine** couverte (plus de doublon au rattrapage manuel)       |

Après `0001`, renseignez le code de bootstrap :

```sql
update public.app_config set bootstrap_code = 'VOTRE-CODE-SECRET' where id = 1;
```

## Calendrier (flux .ics)

Un flux **iCalendar** récapitule tout le planning (gardes + congés + formations),
servi par l'Edge Function Supabase [`supabase/functions/calendar`](supabase/functions/calendar/index.ts) :

```
https://<ref>.supabase.co/functions/v1/calendar?token=SECRET          # toute l'équipe
https://<ref>.supabase.co/functions/v1/calendar?token=TOKEN&scope=me   # ses propres gardes
```

L'accès est protégé par un token secret **propre à chaque médecin** (stocké
haché, cf. migration `0018`) ; la fonction lit les données via la clé
`service_role` et est déployée avec `verify_jwt = false` (les agendas ne peuvent
pas envoyer de JWT). Dans l'app, le bouton **Calendrier** de l'en-tête affiche
l'URL d'abonnement (équipe ou personnelle) avec liens webcal / Google Agenda /
téléchargement, et permet de **révoquer** le token en le régénérant
(`rotate_calendar_token()`).

Déploiement de la fonction : automatisé par la CI (workflow
[`supabase.yml`](.github/workflows/supabase.yml), `verify_jwt` déclaré dans
[`supabase/config.toml`](supabase/config.toml)) ; en manuel :
`supabase functions deploy calendar --no-verify-jwt`. Définir ensuite le token :
`update public.app_config set calendar_token = 'SECRET' where id = 1;`

**Tokens hashés au repos** (migration `0018`) : la base ne stocke plus que le
**SHA-256** des tokens (`calendar_token_hash`) — un dump ne révèle aucun lien
utilisable. La fonction hache le token reçu et compare au hash (repli sur le clair
le temps de la transition). Conséquence : un lien n'est **montré qu'une fois**, à
la génération/régénération (il n'est plus ré-affichable). ⚠️ Déployer la fonction
**avant** d'appliquer `0018` (qui efface le clair).

**Rate-limiting** (défense en profondeur — le flux est public et lit via
`service_role`) : la fonction borne le débit **par IP** avant toute requête en base
(migration `0014`, RPC atomique `edge_rate_limit_hit`). Défauts : `60` requêtes par
`60` s, largement au-dessus du rafraîchissement des agendas ; réglables via les
variables d'environnement de la fonction `CALENDAR_RATE_MAX` / `CALENDAR_RATE_WINDOW`.
Au-delà : réponse `429` avec `Retry-After`. En cas d'échec de la RPC, on **laisse
passer** (fail-open) pour ne jamais casser un abonnement légitime.

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
              créneaux + compteurs · congés · HNC · validation/alertes · équité ·
              répétition + copie de mois · PDF · XLSX · thème · couleurs
  backend/    types · doctors · planning (shifts) · leaves · hnc · notes · wishes ·
              swaps · shiftTypes · notifications · push · reminders · history ·
              audit · gdpr · mfa · passkey · backup · locks · settings · calendar
  auth/       contexte + porte d'authentification + page de connexion
  i18n/       catalogue FR/EN typé + fournisseur de traduction
  features/   planning/ (liste + grille, compteurs, dialogues affect./congé/note/HNC) ·
              swaps/ · admin/ (panel, compteurs équipe, créneaux, sauvegarde) ·
              profile/ · pending/ · legal/ (politique de confidentialité)
  components/ en-tête · barre d'onglets basse · cloche notifications · modale ·
              toast · thème · calendrier · profil · invite d'installation · spinner
```

Tests (`src/lib/*.test.ts`) : compteurs, semaine ISO, créneaux actifs, congés,
alertes de validation, répétition hebdomadaire, copie de mois.
