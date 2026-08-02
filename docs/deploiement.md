# Déploiement — récapitulatif

Guide pour mettre la base et l'Edge Function à jour avec les évolutions récentes.
Le **front est déjà en production** (déployé automatiquement sur GitHub Pages à
chaque push sur `main`) : **rien à faire côté front**.

Le **Supabase** (Edge Functions + migrations) se déploie désormais **par la CI/CD**
(workflow [`.github/workflows/supabase.yml`](../.github/workflows/supabase.yml)) —
voir [« Déploiement automatisé »](#déploiement-automatisé-cicd--recommandé) ci-dessous.
La [procédure manuelle](#procédure-manuelle-repli--première-mise-en-service) reste
documentée en repli.

## État

| Élément                                                 | État                                                                                                                                                           |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Front (GitHub Pages)                                    | ✅ à jour, en prod — <https://mister-guiiug.github.io/mister-doc/>                                                                                             |
| Variables Actions `VITE_SUPABASE_*`                     | ✅ déjà posées                                                                                                                                                 |
| Secrets CI (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_URL`) | ✅ posés (déploiement Supabase automatisé)                                                                                                                     |
| Schéma de base                                          | ✅ migrations `0014`→`0026` **appliquées** (via CI) ; `0001`→`0013` posées à la main, hors CI (dont `0013`, appliquée le 2026-08-02)                           |
| Edge Functions `calendar` / `push`                      | ✅ **déployées** (rate-limit + lookup par hash)                                                                                                                |
| Notifications push (Web Push)                           | ✅ **opérationnelles** depuis le 2026-08-02 — chaîne validée de bout en bout (cf. [section dédiée](#notifications-push--configuration-hors-dépôt-obligatoire)) |
| Passkeys (connexion par empreinte)                      | ✅ activées côté dashboard (RP ID `mister-guiiug.github.io`)                                                                                                   |

Le front est **rétro-compatible** : il fonctionne avant comme après ces migrations
(double-mode calendrier, génération de codes non bloquante, etc.). On peut donc
déployer la base tranquillement, sans fenêtre de coupure.

## Déploiement automatisé (CI/CD) — recommandé

Le workflow **[`supabase.yml`](../.github/workflows/supabase.yml)** déploie la base
et les Edge Functions. Il se déclenche **automatiquement quand un fichier
`supabase/**` change sur `main`** (un push qui ne touche que le front ne redéploie
donc pas la base) et **manuellement** via l'onglet **Actions → Déploiement Supabase
→ Run workflow**.

Ce qu'il fait, dans l'ordre (le même job, séquentiel) :

1. **Déploie les Edge Functions** `calendar` + `push` (`supabase functions deploy
--use-api`, sans Docker). Le `verify_jwt = false` de chaque fonction est
   déclaré dans [`supabase/config.toml`](../supabase/config.toml).
2. **Vérifie** que les tables des migrations `0001`→`0013` sont bien en base
   (garde-fou, cf. encadré ci-dessous) et **échoue en les nommant** sinon, avant
   d'appliquer quoi que ce soit.
3. **Applique les migrations** de préfixe **≥ 0014** via `psql`, **en une seule
   transaction atomique** (tout ou rien). Les migrations `0001`→`0013`, posées hors
   CLI (dont la suppression destructive S3 de `0009`), ne sont **jamais** rejouées.

L'ordre fonction-puis-migrations est **garanti par construction** — il résout la
contrainte de `0018` (cf. encadré plus bas). Les migrations étant **idempotentes**,
chaque exécution est sûre à rejouer : à chaque déclenchement, la CI ré-applique
**toute** la série `0014`→dernière, et déploie **toutes** les Edge Functions du
dossier `supabase/functions/` (`calendar` et `push`).

> ⚠️ **Angle mort à connaître : les migrations `0001`→`0013`.** Elles sont
> **hors CI** et doivent être appliquées **à la main** dans l'éditeur SQL. Rien ne
> le rappelait, et ça s'est vu : `0013_push_subscriptions` n'a jamais été posée sur
> la base réelle, si bien que l'Edge Function `push` répondait `500` à chaque
> notification. Les migrations suivantes ne citent cette table que dans un **corps
> de fonction plpgsql** — dont l'analyse est différée par Postgres — donc `psql`
> passait sans rien signaler. Le workflow embarque désormais un **contrôle de
> présence** des 13 tables concernées, qui échoue avec le nom de la manquante.
> Ce contrôle est à **étendre** si une table est un jour ajoutée sous le seuil.

### Secrets à créer (une fois)

Dépôt GitHub → **Settings → Secrets and variables → Actions → New repository secret** :

| Secret                  | Où le trouver                                                                        | Rôle                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_ACCESS_TOKEN` | Supabase → **Account → Access Tokens → Generate new token** (valeur `sbp_…`)         | Déployer les Edge Functions. **Créer un token dédié CI** — ne pas réutiliser le token de provisionnement `sbp_…` (qui, lui, reste à révoquer).                                                                                                                                                                                                                                   |
| `SUPABASE_DB_URL`       | Dashboard → **Project Settings → Database → onglet « Session pooler »** (format URI) | Connexion `psql` des migrations. **Session pooler** (IPv4, port 5432), PAS la connexion directe `db.<ref>.supabase.co` (IPv6, injoignable depuis un runner GitHub). ⚠️ Le mot de passe doit être **URL-encodé** s'il contient des caractères spéciaux (`£ ( ] + / @ : …`) — le plus sûr : un mot de passe **alphanumérique** (Dashboard → Database → _Reset database password_). |

> La **ref de projet** (`lgbuytinzukaxrqjwxme`) est publique (déjà dans l'URL de
> l'app) : elle est en clair dans le workflow, pas besoin de secret.

Une fois ces secrets créés, tout push modifiant `supabase/**` (ou un « Run
workflow » manuel) déclenche le déploiement. Vérifier le résultat dans l'onglet
**Actions**, puis dérouler les [vérifications post-déploiement](#vérifications-après-déploiement).

> ⚠️ Tant que les secrets ne sont pas posés, le workflow **échoue** (auth Supabase
> / connexion base manquantes) sans toucher la prod — pose-les **avant** de compter
> sur lui.

## Procédure manuelle (repli / première mise en service)

> Utile pour la toute première application, un rejeu ciblé, ou si l'on préfère
> piloter à la main. Sinon, préférer la [CI/CD](#déploiement-automatisé-cicd--recommandé).

### 1) Redéployer l'Edge Function `calendar` **en premier**

```bash
supabase functions deploy calendar --no-verify-jwt
```

(ou via l'API Management). La fonction lit `SUPABASE_URL` et
`SUPABASE_SERVICE_ROLE_KEY` (fournies automatiquement par Supabase). Réglages
optionnels du rate-limit : variables d'environnement `CALENDAR_RATE_MAX` (défaut
`60`) et `CALENDAR_RATE_WINDOW` (défaut `60` s).

> ⚠️ **Pourquoi la fonction AVANT la migration `0018`.** `0018` remplace les tokens
> calendrier en clair par leur seul hash. L'**ancienne** version de la fonction
> cherche le token _en clair_ : une fois le clair effacé, elle ne trouverait plus
> aucun abonnement. La **nouvelle** version compare par hash (avec repli sur le
> clair pendant la transition) : elle fonctionne donc **avant comme après** `0018`.
> D'où l'ordre : fonction d'abord, migrations ensuite.

### 2) Appliquer les migrations `0014` → `0026` **dans l'ordre**

Via **SQL Editor** du tableau de bord Supabase, copier-coller chaque fichier de
[`supabase/migrations/`](../supabase/migrations/) dans l'ordre croissant. Toutes
sont **idempotentes** (ré-applicables sans risque). Une fois la fonction redéployée
(étape 1), il n'y a **plus aucune contrainte d'ordre** entre elles au-delà de la
numérotation.

> **Première mise en service d'une base vierge** : commencer par `0001`→`0013`, du
> même geste (éditeur SQL, ordre croissant). La CI ne les applique jamais — elle se
> contente d'en vérifier le résultat. Ne **pas** passer par `supabase db push`.

| #                                | Contenu                                                                | Remarque                                            |
| -------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------- |
| `0014_calendar_rate_limit`       | rate-limit par IP de la fonction calendrier                            | la fonction est _fail-open_ si la RPC manque → sûre |
| `0015_calendar_token_privacy`    | `calendar_token` illisible par les autres médecins (privilège colonne) | le front (colonnes explicites) est déjà en prod     |
| `0016_extend_month_lock`         | verrou de mois étendu aux HNC / notes / vœux                           | sûre à tout moment                                  |
| `0017_audit_log`                 | journal d'audit admin                                                  | sûre à tout moment                                  |
| `0018_calendar_token_hash`       | tokens calendrier **hashés au repos** (efface le clair)                | **exige l'étape 1 faite avant**                     |
| `0019_anonymize_doctor`          | effacement RGPD par anonymisation                                      | sûre à tout moment                                  |
| `0020_admin_reset_mfa`           | réinitialisation 2FA par un admin                                      | sûre à tout moment                                  |
| `0021_mfa_recovery_codes`        | codes de secours 2FA self-service                                      | sûre à tout moment                                  |
| `0022_shift_types`               | créneaux configurables (table `shift_types`, CHECK → FK)               | seed = comportement historique à l'identique        |
| `0023_shift_reminders`           | rappels de garde quotidiens (job pg_cron)                              | **exige `0022`** (attribut « nuit »)                |
| `0024_weekly_digest`             | récapitulatif hebdomadaire (job pg_cron)                               | sûre à tout moment                                  |
| `0025_copy_previous_month`       | copie de mois (`assign_shifts_bulk`) + notifs d'affectation groupées   | remplace le trigger `shifts_notify` de `0006`       |
| `0026_weekly_digest_idempotence` | clé d'idempotence du récapitulatif ancrée sur le lundi de la semaine   | corrige un doublon possible au rattrapage manuel    |

## Jobs pg_cron

Les migrations planifient elles-mêmes leurs jobs (**best-effort** : si `pg_cron`
est indisponible, la migration passe avec un `notice` et le job est simplement
absent). `cron` s'exécute en **UTC** ; pour changer une heure, reprogrammer le
job avec le même nom.

| Job                             | Migration | Planification | Rôle                                        |
| ------------------------------- | --------- | ------------- | ------------------------------------------- |
| `mister-doc-weekly-backup`      | `0006`    | `0 3 * * 1`   | sauvegarde automatique hebdomadaire         |
| `mister-doc-rate-limit-cleanup` | `0014`    | `17 4 * * *`  | purge de la table de rate-limit             |
| `mister-doc-shift-reminders`    | `0023`    | `0 17 * * *`  | rappels « garde demain » / « nuit ce soir » |
| `mister-doc-weekly-digest`      | `0024`    | `0 17 * * 0`  | récapitulatif hebdomadaire des gardes       |

Les rappels et le récapitulatif s'envoient aussi **à la main** depuis `/admin` →
« Réglages » (RPC `admin_send_reminders` / `admin_send_weekly_digest`) ; ils sont
idempotents, un même envoi n'est jamais dupliqué. Détail :
[`notifications-push.md`](notifications-push.md).

## Vérifications après déploiement

1. **Flux calendrier (le plus important)** — valide bout-en-bout la fonction + le
   hachage (`0018`). Dans l'app : **Profil → Calendrier → Générer** un lien, puis :

   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" "<URL_d_abonnement_generee>"
   # attendu : 200
   ```

   Un abonnement déjà en place doit continuer de fonctionner (les hashes des tokens
   existants ont été calculés par la migration).

2. **Rate-limit** (optionnel) — enchaîner > 60 requêtes/min sur la même URL renvoie
   `429` (`Retry-After`).

3. **Confidentialité du token** — dans l'app, un médecin non-admin ne voit jamais le
   lien d'un autre (le token n'est plus ré-affichable : _montré une fois_).

4. **Journal d'audit** — `/admin` → carte « Journal d'activité » : une approbation ou
   un verrou de mois y apparaît.

5. **Verrou étendu** — verrouiller un mois puis tenter de modifier une HNC / note /
   vœu de ce mois : refusé.

6. **RGPD** — Profil → « Confidentialité & mes données » : export JSON OK ; «
   Supprimer mon compte » anonymise (à tester sur un compte de test).

7. **2FA** — activer la 2FA génère des codes de secours ; un code permet de récupérer
   l'accès depuis l'écran de défi ; un admin peut réinitialiser la 2FA d'un médecin.

8. **Créneaux configurables** — `/admin` → carte « Types de créneaux » : la liste
   affiche `S1J` / `S1N` / `S2J` (+ `S3` inactif) ; renommer un créneau se reflète
   aussitôt dans le planning et les notifications.

9. **Rappels et récapitulatif** — `/admin` → « Réglages » → boutons « Envoyer » :
   le compte rendu indique le nombre d'envois (0 si déjà faits pour la période).
   Les jobs planifiés sont visibles dans `cron.job`.

10. **Notifications push** — **Profil → Notifications push → activer**, puis
    déclencher un envoi (bouton « Réglages » ci-dessus, ou une affectation de garde
    par un autre compte). Une notification OS doit apparaître ; un clic ouvre l'app
    sur le bon jour. En cas de silence, la [sonde
    externe](#notifications-push--configuration-hors-dépôt-obligatoire) situe la
    panne en un appel.

## Connexion par empreinte (passkeys) — **config dashboard OBLIGATOIRE**

Le front expose la connexion par empreinte / Face ID / Windows Hello (passkeys
WebAuthn : bouton au login + carte « Connexion par empreinte » dans le profil).
C'est **inopérant tant que les passkeys ne sont pas activées côté Supabase** — le
bouton afficherait alors une erreur. À faire **avant** d'annoncer la fonctionnalité :

1. Dashboard → **Authentication → Passkeys** → **activer**.
2. Renseigner le _relying party_ :
   - **Display name** : `mister-doc`
   - **RP ID** : `mister-guiiug.github.io`
   - **Origins** : `https://mister-guiiug.github.io`
3. (Si passage à un **domaine personnalisé** un jour : changer RP ID + origine →
   les passkeys existantes, liées à l'ancien domaine, devront être réenregistrées.)

> API passkeys Supabase en **beta** (peut évoluer). C'est **additif** : le mot de
> passe reste le moyen de connexion principal, la passkey est opt-in par appareil.
> Aucune migration base : les passkeys sont gérées par Supabase Auth.

## Notifications push — **configuration hors dépôt OBLIGATOIRE**

**État : ✅ opérationnel depuis le 2026-08-02** (notification OS reçue, chaîne
complète validée). Mise en place détaillée : [`notifications-push.md`](notifications-push.md).

Quatre conditions doivent être vraies **en même temps**, et aucune ne se signale
dans l'application. Elles ont toutes manqué au premier essai — d'où ce tableau, qui
associe chaque maillon à son symptôme :

| Où                                                                   | Quoi                                                                    | Symptôme si absent                                                                                                                                                                |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Variable Actions `VITE_VAPID_PUBLIC_KEY`                             | clé **publique** VAPID, lue **au build** (donc un redéploiement suffit) | carte « Notifications push » **invisible** dans le profil. Pire avec une valeur bidon : la carte s'affiche (`pushConfigured()` ne teste que la longueur) mais l'abonnement échoue |
| Secrets de l'Edge Function                                           | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `APP_URL`     | `500 VAPID non configuré`                                                                                                                                                         |
| Secret `WEBHOOK_SECRET` **et** en-tête `x-webhook-secret` du webhook | authentifie la fonction, déployée `--no-verify-jwt`                     | `500 WEBHOOK_SECRET non configuré` ; ou `401 forbidden` **silencieux** si les deux valeurs diffèrent                                                                              |
| Table `push_subscriptions` (migration `0013`)                        | stockage des abonnements                                                | `500` générique (la lecture REST échoue) **et** activation impossible depuis le profil                                                                                            |

La clé publique doit être **identique** dans la variable Actions et dans les
secrets de la fonction : une paire dépareillée fait rejeter les envois (403) par
les services de push.

### Sonde externe

Un seul appel valide les **trois maillons serveur** (secret, VAPID, table), sans
rien écrire ni envoyer le moindre push : le `doctor_id` est un UUID nul, donc
aucun abonnement ne correspond.

```bash
curl -i -X POST "https://lgbuytinzukaxrqjwxme.supabase.co/functions/v1/push" -H "Content-Type: application/json" -H "x-webhook-secret: VOTRE_SECRET" -d '{"record":{"doctor_id":"00000000-0000-0000-0000-000000000000","type":"test","title":"t"}}'
```

`200 {"sent":0,"expired":0,"failed":0}` = tout est bon côté serveur ; il ne reste
que le webhook et l'abonnement du navigateur à vérifier. Les autres réponses sont
listées dans le tableau ci-dessus.

⚠️ **Le `doctor_id` est indispensable à ce diagnostic.** Avec un corps vide
(`-d '{}'`), la fonction répond `200 no record` **avant** de lire
`push_subscriptions` : la réponse est verte alors que la table peut manquer. C'est
exactement ce qui a masqué le problème le 2026-08-02. Un corps vide reste utile
pour tester le secret seul : sans en-tête, la réponse attendue est
`401 forbidden` — un `500` signale alors un `WEBHOOK_SECRET` manquant.

Le premier maillon (la variable de build) n'est pas testable par cette sonde : il
se vérifie à l'œil, la carte « Notifications push » étant visible dans le profil.

> ⚠️ **Les valeurs ne sont nulle part dans le dépôt.** Convention locale : un
> fichier `push-secrets.local` à la racine (ignoré par git via `*.local`),
> applicable d'un coup avec `supabase secrets set --env-file`. Recopiez-le dans un
> gestionnaire de mots de passe : il détient l'**unique copie** de la clé privée
> VAPID, et la perdre impose de régénérer la paire — ce qui invalide tous les
> abonnements déjà enregistrés par les médecins.

## Configuration externe (hors code, optionnel)

Réglage du **tableau de bord Supabase** (Authentication → Settings) :

- Confirmation d'e-mail : actuellement `mailer_autoconfirm = true` (désactivée) —
  à réévaluer selon le besoin.

## Rédactionnel

- **Politique de confidentialité** : compléter les mentions `[À compléter]`
  (responsable du traitement, base légale, durées de conservation, contact) dans
  [`src/features/legal/PrivacyPolicy.tsx`](../src/features/legal/PrivacyPolicy.tsx)
  **avant mise en service réelle**.

## Sécurité — à ne pas oublier

- ✅ **Token Management `sbp_…` de provisionnement révoqué** (2026-07-18). Le
  déploiement CI utilise un **PAT dédié** dans le secret `SUPABASE_ACCESS_TOKEN`
  (révocable / rotable indépendamment).
- Ne jamais committer la clé `service_role` ni un token `sbp_…` (le `.env` est
  ignoré par git).
