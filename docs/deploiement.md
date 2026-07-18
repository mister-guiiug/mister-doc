# Déploiement — récapitulatif

Guide pour mettre la base et l'Edge Function à jour avec les évolutions récentes.
Le **front est déjà en production** (déployé automatiquement sur GitHub Pages à
chaque push sur `main`) : **rien à faire côté front**. Restent des changements
**Supabase** à appliquer à la main.

## État

| Élément | État |
| --- | --- |
| Front (GitHub Pages) | ✅ à jour, en prod — <https://mister-guiiug.github.io/mister-doc/> |
| Variables Actions `VITE_SUPABASE_*` | ✅ déjà posées |
| Schéma de base | appliqué jusqu'à `0013` — **migrations `0014` → `0021` à appliquer** |
| Edge Function `calendar` | **à redéployer** (nouvelle version : rate-limit + lookup par hash) |

Le front est **rétro-compatible** : il fonctionne avant comme après ces migrations
(double-mode calendrier, génération de codes non bloquante, etc.). On peut donc
déployer la base tranquillement, sans fenêtre de coupure.

## Procédure — 2 étapes, dans cet ordre

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
> cherche le token *en clair* : une fois le clair effacé, elle ne trouverait plus
> aucun abonnement. La **nouvelle** version compare par hash (avec repli sur le
> clair pendant la transition) : elle fonctionne donc **avant comme après** `0018`.
> D'où l'ordre : fonction d'abord, migrations ensuite.

### 2) Appliquer les migrations `0014` → `0021` **dans l'ordre**

Via **SQL Editor** du tableau de bord Supabase, copier-coller chaque fichier de
[`supabase/migrations/`](../supabase/migrations/) dans l'ordre croissant. Toutes
sont **idempotentes** (ré-applicables sans risque). Une fois la fonction redéployée
(étape 1), il n'y a **plus aucune contrainte d'ordre** entre elles au-delà de la
numérotation.

| # | Contenu | Remarque |
| --- | --- | --- |
| `0014_calendar_rate_limit` | rate-limit par IP de la fonction calendrier | la fonction est *fail-open* si la RPC manque → sûre |
| `0015_calendar_token_privacy` | `calendar_token` illisible par les autres médecins (privilège colonne) | le front (colonnes explicites) est déjà en prod |
| `0016_extend_month_lock` | verrou de mois étendu aux HNC / notes / vœux | sûre à tout moment |
| `0017_audit_log` | journal d'audit admin | sûre à tout moment |
| `0018_calendar_token_hash` | tokens calendrier **hashés au repos** (efface le clair) | **exige l'étape 1 faite avant** |
| `0019_anonymize_doctor` | effacement RGPD par anonymisation | sûre à tout moment |
| `0020_admin_reset_mfa` | réinitialisation 2FA par un admin | sûre à tout moment |
| `0021_mfa_recovery_codes` | codes de secours 2FA self-service | sûre à tout moment |

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
   lien d'un autre (le token n'est plus ré-affichable : *montré une fois*).

4. **Journal d'audit** — `/admin` → carte « Journal d'activité » : une approbation ou
   un verrou de mois y apparaît.

5. **Verrou étendu** — verrouiller un mois puis tenter de modifier une HNC / note /
   vœu de ce mois : refusé.

6. **RGPD** — Profil → « Confidentialité & mes données » : export JSON OK ; «
   Supprimer mon compte » anonymise (à tester sur un compte de test).

7. **2FA** — activer la 2FA génère des codes de secours ; un code permet de récupérer
   l'accès depuis l'écran de défi ; un admin peut réinitialiser la 2FA d'un médecin.

## Configuration externe (hors code, optionnel)

Réglages du **tableau de bord Supabase** (Authentication → Policies / Settings) :

- **Protection des mots de passe compromis (HIBP)** : nécessite le **plan Pro**
  (renvoyait `402` en plan gratuit).
- **Captcha** au login/inscription : nécessite un **compte tiers** (hCaptcha /
  Cloudflare Turnstile) et sa clé, à renseigner côté Supabase Auth.
- Confirmation d'e-mail : actuellement `mailer_autoconfirm = true` (désactivée) —
  à réévaluer selon le besoin.

## Rédactionnel

- **Politique de confidentialité** : compléter les mentions `[À compléter]`
  (responsable du traitement, base légale, durées de conservation, contact) dans
  [`src/features/legal/PrivacyPolicy.tsx`](../src/features/legal/PrivacyPolicy.tsx)
  **avant mise en service réelle**.

## Sécurité — à ne pas oublier

- **Révoquer / tourner le token Management `sbp_…`** utilisé pour le provisionnement
  initial, s'il ne l'a pas déjà été.
- Ne jamais committer la clé `service_role` ni un token `sbp_…` (le `.env` est
  ignoré par git).
