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

### 1. Générer les clés VAPID

```bash
npx web-push generate-vapid-keys
# → Public Key:  BLxx...   (va dans le build, public)
# → Private Key: yyy...     (SECRET — jamais dans le bundle)
```

### 2. Côté build (front)

Dans `.env` (et le secret CI de déploiement) :

```
VITE_VAPID_PUBLIC_KEY=BLxx...   # la clé PUBLIQUE uniquement
```

### 3. Appliquer la migration

`supabase/migrations/0013_push_subscriptions.sql` (table + RLS). Via
`supabase db push` ou l'éditeur SQL.

### 4. Déployer l'Edge Function

```bash
supabase functions deploy push --no-verify-jwt

supabase secrets set \
  VAPID_PUBLIC_KEY=BLxxx... \
  VAPID_PRIVATE_KEY=yyy... \
  VAPID_SUBJECT=mailto:admin@votre-domaine.fr \
  APP_URL=https://mister-guiiug.github.io/mister-doc/ \
  WEBHOOK_SECRET=un-secret-aleatoire   # optionnel mais recommandé
```

`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis automatiquement.

### 5. Créer le webhook base de données

Supabase → **Database → Webhooks → Create** :

- Table : `public.notifications`, évènement : **INSERT**
- Type : **HTTP Request** → URL de la fonction `…/functions/v1/push`
- Header (si `WEBHOOK_SECRET` défini) : `x-webhook-secret: un-secret-aleatoire`

> Alternative sans UI : un trigger `pg_net` (`net.http_post`) sur
> `notifications` appelant l'URL de la fonction avec le même header.

## Utilisation

Chaque médecin active le push depuis **Profil → Notifications push** (un appareil
= un abonnement). Le refus d'autorisation navigateur est géré ; l'abonnement est
purgé automatiquement côté serveur quand il expire (404/410).

## Test rapide

1. Activer le push dans le profil (autoriser dans le navigateur).
2. Se faire attribuer une garde par un autre compte (ou insérer une ligne de test
   dans `notifications` pour son `doctor_id`).
3. Une notification OS doit apparaître ; un clic ouvre l'app sur le bon jour.

## Notes

- iOS : le push web exige que l'app soit **installée** (ajout à l'écran d'accueil,
  iOS 16.4+).
- Le service worker ne change pas la stratégie de cache : les handlers push sont
  chargés via `workbox.importScripts(['push-sw.js'])` (`public/push-sw.js`).
