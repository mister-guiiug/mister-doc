# Notifications push (Web Push)

Les notifications in-app (cloche) fonctionnent **sans configuration**. Les
notifications **push** (reçues même app fermée, sur mobile/desktop) sont
**optionnelles** : tant que la clé VAPID n'est pas configurée, la section
« Notifications push » du profil reste masquée et l'app fonctionne normalement.

L'envoi repose sur : une table `push_subscriptions`, un service worker qui reçoit
le push, et une Edge Function `push` déclenchée par un **webhook base de données**
à chaque nouvelle ligne dans `notifications`.

```
notifications (INSERT) ──webhook──▶ Edge Function « push » ──Web Push──▶ navigateur ─▶ SW ─▶ notif OS
```

## Mise en place (une fois)

> **Sur l'instance de production, tout ceci est fait** — le push est opérationnel
> depuis le 2026-08-02. Cette section sert à une nouvelle instance, ou à une
> rotation de clés. État et diagnostic :
> [`deploiement.md`](deploiement.md#notifications-push--configuration-hors-dépôt-obligatoire).

### 1. Générer les clés VAPID et le secret du webhook

Une paire VAPID est un simple couple de clés **P-256**, et `WEBHOOK_SECRET` une
chaîne aléatoire : `node:crypto` suffit, sans installer quoi que ce soit
(cohérent avec le reste du dépôt). La sortie est au format `.env`, directement
applicable à l'étape 4 :

```bash
node -e "const c=require('crypto');const {privateKey}=c.generateKeyPairSync('ec',{namedCurve:'prime256v1'});const j=privateKey.export({format:'jwk'});const b=s=>Buffer.from(s,'base64url');console.log('VAPID_PUBLIC_KEY='+Buffer.concat([Buffer.from([4]),b(j.x),b(j.y)]).toString('base64url'));console.log('VAPID_PRIVATE_KEY='+b(j.d).toString('base64url'));console.log('WEBHOOK_SECRET='+c.randomBytes(32).toString('base64url'))" > push-secrets.local
```

- `VAPID_PUBLIC_KEY` — point non compressé de 65 octets en base64url. **Publique** :
  elle part dans le bundle (étape 2) _et_ dans les secrets de la fonction (étape 4).
- `VAPID_PRIVATE_KEY` — 32 octets. **Jamais** dans le bundle ni dans le dépôt.
- `WEBHOOK_SECRET` — 32 octets aléatoires, partagés entre la fonction et l'en-tête
  du webhook (étape 5).

Le fichier `push-secrets.local` est ignoré par git (motif `*.local`) ; recopiez-le
dans un gestionnaire de mots de passe, c'est l'unique copie de la clé privée.
`npx web-push generate-vapid-keys` produit une paire équivalente si vous préférez.

### 2. Côté build (front)

Dans `.env` en local :

```
VITE_VAPID_PUBLIC_KEY=BLxx...   # la clé PUBLIQUE uniquement
```

⚠️ **Et en production** : cette valeur est lue **au moment du build**. Elle doit
donc exister comme **variable Actions** (Settings → Secrets and variables →
Actions → _Variables_, nom `VITE_VAPID_PUBLIC_KEY`), car
[`deploy.yml`](../.github/workflows/deploy.yml) l'injecte à `npm run build`.
Sans elle, `pushConfigured()` est faux et **la carte « Notifications push » du
profil reste invisible** : la fonctionnalité paraît absente alors que tout le
reste (secrets Supabase, webhook) est correctement configuré. C'est une
_variable_, pas un secret : la clé publique est destinée au bundle.

### 3. Appliquer la migration — **à la main**

`supabase/migrations/0013_push_subscriptions.sql` (table + RLS), à copier dans
l'**éditeur SQL** du tableau de bord.

⚠️ Cette migration est **sous le seuil de la CI** : le workflow
[`supabase.yml`](../.github/workflows/supabase.yml) n'applique que les préfixes
`>= 0014` (`MIN_MIGRATION`), les précédentes étant réputées déjà posées. C'est une
étape facile à oublier, et son oubli est **silencieux** : sans la table
`push_subscriptions`, l'Edge Function répond `500` à chaque notification et
l'activation du push échoue depuis le profil, sans que rien ne l'explique. Le
fichier est idempotent (`create table if not exists`, `drop policy if exists`) :
le rejouer ne coûte rien. Depuis, le workflow **vérifie la présence de ces tables
avant toute migration** et échoue en nommant celle qui manque.

> **N'utilisez pas `supabase db push` sur ce projet.** Le CLI, ne voyant aucune
> migration appliquée, rejouerait `0001`→`0013` sur la base réelle — dont la
> suppression destructive de `0009` (cf. [`supabase/config.toml`](../supabase/config.toml)).

### 4. Poser les secrets de l'Edge Function

La fonction elle-même est déployée **par la CI** à chaque changement de
`supabase/**` ([`supabase.yml`](../.github/workflows/supabase.yml)) ; seuls les
secrets restent à poser. Complétez `push-secrets.local` (étape 1) avec les deux
valeurs qui n'ont rien d'aléatoire, puis appliquez le tout :

```
VAPID_SUBJECT=mailto:admin@votre-domaine.fr
APP_URL=https://mister-guiiug.github.io/mister-doc/
```

```bash
supabase secrets set --project-ref lgbuytinzukaxrqjwxme --env-file push-secrets.local
```

Ou, à la main : **Project Settings → Edge Functions → Secrets**. `SUPABASE_URL` et
`SUPABASE_SERVICE_ROLE_KEY` sont fournis automatiquement. Un déploiement manuel
reste possible en repli : `supabase functions deploy push --no-verify-jwt`.

⚠️ `WEBHOOK_SECRET` est **obligatoire** : la fonction étant déployée sans
vérification de JWT, c'est sa seule authentification. Sans lui elle refuse **tout**
appel, webhook compris (`500`, fail-closed).

### 5. Créer le webhook base de données

Supabase → **Database → Webhooks → Create** :

- Table : `public.notifications`, évènement : **INSERT**
- Type : **HTTP Request** → URL de la fonction `…/functions/v1/push`
- Header (**obligatoire**) : `x-webhook-secret`, valeur = le `WEBHOOK_SECRET` de
  l'étape 4, **au caractère près** — la comparaison côté fonction est stricte et à
  temps constant. Un espace parasite donne un `401` que rien ne signale dans l'app :
  le webhook s'exécute, la notification apparaît dans la cloche, mais aucun push ne
  part.

S'il existe déjà un hook sur `notifications`, **éditez-le** plutôt que d'en créer
un second : deux hooks enverraient deux push par notification.

> Alternative sans UI : un trigger `pg_net` (`net.http_post`) sur
> `notifications` appelant l'URL de la fonction avec le même header.

## Utilisation

Chaque médecin active le push depuis **Profil → Notifications push** (un appareil
= un abonnement). Le refus d'autorisation navigateur est géré ; l'abonnement est
purgé automatiquement côté serveur quand il expire (404/410).

## Envois programmés (pg_cron)

Deux jobs insèrent des lignes dans `notifications` : ces lignes empruntent donc
le **même pipeline** (webhook → Edge Function `push`) et apparaissent aussi dans
la cloche. Aucune Edge Function ni configuration supplémentaire.

| Job                          | Migration | Planification (UTC) | Contenu                                                                                           |
| ---------------------------- | --------- | ------------------- | ------------------------------------------------------------------------------------------------- |
| `mister-doc-shift-reminders` | `0023`    | `0 17 * * *`        | **« Garde demain »** (gardes du lendemain) et **« Nuit ce soir »** (garde du jour, type « nuit ») |
| `mister-doc-weekly-digest`   | `0024`    | `0 17 * * 0`        | **récapitulatif hebdomadaire** : toutes les gardes des 7 jours suivants, en une notification      |

- Seuls les médecins **ayant un compte** sont notifiés (les entrées de roster
  sans `auth_id` sont ignorées).
- **Idempotence** : un rappel n'est jamais recréé pour un même (médecin, type,
  date) ; le récapitulatif est daté du **lundi de la semaine couverte**, ce qui
  interdit le doublon.
- **Déclenchement manuel** (test / rattrapage), réservé aux admins : boutons
  « Rappels de garde » et « Récapitulatif hebdomadaire » dans `/admin` →
  « Réglages » (RPC `admin_send_reminders` et `admin_send_weekly_digest`, qui
  renvoient le nombre d'envois créés).
- La planification s'exécute en **UTC** : `17:00 UTC` ≈ 18–19 h à Paris. Pour
  changer l'heure, reprogrammer le job (`cron.schedule` avec le même nom).

## Notifications d'affectation groupées

Depuis la migration `0025`, le trigger d'**INSERT** sur `shifts` est de niveau
**instruction** (`for each statement`, table de transition) et non plus de niveau
ligne : une insertion en lot (copie de mois, semaines répétées) produit **une
notification — donc un seul push — par médecin**, au lieu d'une par garde. Le corps s'adapte au volume :
message habituel pour une garde, liste des dates pour un petit lot, plage
« du … au … » au-delà. `UPDATE` et `DELETE` restent en `for each row` (retrait et
réaffectation ne partent jamais en masse). Même patron que la migration `0012`
pour les congés.

## Test rapide

1. Activer le push dans le profil (autoriser dans le navigateur).
2. Se faire attribuer une garde par un autre compte (ou insérer une ligne de test
   dans `notifications` pour son `doctor_id`).
3. Une notification OS doit apparaître ; un clic ouvre l'app sur le bon jour.

En cas de silence, ne cherchez pas au hasard : la [sonde
externe](deploiement.md#sonde-externe) valide les quatre maillons serveur en un
appel, et les journaux de la fonction (`delivered`, `send_failed`) disent si le
webhook l'a seulement appelée.

## Notes

- iOS : le push web exige que l'app soit **installée** (ajout à l'écran d'accueil,
  iOS 16.4+).
- Le service worker ne change pas la stratégie de cache : les handlers push sont
  chargés via `workbox.importScripts(['push-sw.js'])` (`public/push-sw.js`).
