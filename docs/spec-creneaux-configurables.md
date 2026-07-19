# Spec — Créneaux (types de garde) configurables

> Statut : **proposition de conception** (aucune implémentation). Objet : rendre
> les types de créneaux `S1J / S1N / S2J` — aujourd'hui codés en dur — gérables
> par un administrateur, sans casser l'existant.

## 1. Contexte & objectif

Les types de garde et leurs propriétés (libellé, base horaire, couverture
week-end, statut « nuit », horaires) sont **figés dans le code** à trois créneaux
cliniques `S1J` / `S1N` / `S2J` (+ `S3` legacy, aujourd'hui remplacé par les HNC).
Objectif : permettre à un **admin** de définir ses propres créneaux (en ajouter,
renommer, changer les heures, marquer « nuit », désactiver…), pour ouvrir l'app à
d'autres services que celui d'origine.

## 2. Objectifs / Non-objectifs

**Objectifs**

- Modèle de données pour des types de créneaux **paramétrables** (CRUD admin).
- Généraliser les dérivations métier qui dépendent du type : **couverture** (« à
  couvrir »), **repos de sécurité** (« nuit »), **compteurs**, **équité**, **PDF**,
  **flux .ics**.
- **Rétrocompatibilité totale** : les données `S1J/S1N/S2J/S3` existantes restent
  valides ; par défaut le comportement est identique à aujourd'hui.

**Non-objectifs (hors périmètre, éventuelle suite)**

- Rendre configurables les **jours fériés** ou la définition du **week-end**
  (restent : fériés FR + samedi/dimanche).
- **Multi-services / multi-équipes** avec des jeux de créneaux distincts.
- Couverture **variable** (toujours 1 occupant par créneau et par jour).
- Modèle **HNC** (inchangé, table `hnc_hours` séparée).

## 3. État actuel — couplage en dur (à généraliser)

Recensement (`grep` sur `S1J|S1N|S2J|'S3'` → ~36 fichiers). Points **sémantiques**
(au-delà du simple libellé) :

| Emplacement | Constante / logique | Rôle |
| --- | --- | --- |
| [`src/lib/shifts.ts`](../src/lib/shifts.ts) | `SHIFT_TYPES`, `ShiftType` (union) | Liste + **type TS** |
| id. | `SHIFT_HOURS`, `SHIFT_LABEL` | Heures, libellé |
| id. | `CLINICAL_SHIFT_TYPES`, `WEEKEND_SHIFT_TYPES`, `PRIMARY_SHIFT` | Couverture normale vs réduite |
| id. | `activeShiftTypes(date)` | Créneaux à couvrir selon le jour |
| id. | `computeCounters` | Heures via `SHIFT_HOURS` |
| [`src/lib/validation.ts`](../src/lib/validation.ts) | littéral **`'S1N'`** | **Repos de sécurité** (lendemain de nuit) |
| [`src/lib/equity.ts`](../src/lib/equity.ts) | littéral **`'S1N'`** | Compteur **nuits** |
| [`src/features/planning/monthPdf.ts`](../src/features/planning/monthPdf.ts) | colonnes **S1J/S1N/S2J** fixes | Export PDF |
| [`supabase/functions/calendar/index.ts`](../supabase/functions/calendar/index.ts) | `SHIFT_LABEL`, `SHIFT_HOURS`, `SHIFT_TIMES` | Flux .ics (dont **horaires** début/fin) |
| [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) | `shifts.shift_type` **CHECK** `in ('S1J','S1N','S2J','S3')` | Contrainte DB |
| [`supabase/migrations/0007_swaps_wishes.sql`](../supabase/migrations/0007_swaps_wishes.sql) | `swap_requests.shift_type` **CHECK** | Contrainte DB |
| [`supabase/migrations/0006_notifications_backups.sql`](../supabase/migrations/0006_notifications_backups.sql) | fonction SQL `shift_label(t)` | Corps des notifications |
| Grille / dialogues | `MonthGrid`, `MonthCalendarGrid`, `AssignDialog`, `Counters`, `MyPlanningView`, `SwapBoard`, `ProposeSwapDialog` | Affichage, ordre des colonnes |

Conséquence de conception majeure : `ShiftType` est aujourd'hui une **union
littérale** (`'S1J' | 'S1N' | …`) offrant l'**exhaustivité à la compilation**.
Rendre les types dynamiques impose `ShiftType = string` (voir §12, risque).

## 4. Modèle de données proposé

Nouvelle table `public.shift_types` (migration proposée **`0022_shift_types`**).
On conserve **`code` comme clé** et comme valeur de `shifts.shift_type` : les
lignes existantes n'ont **pas** besoin d'être réécrites.

```sql
create table public.shift_types (
  code           text primary key,              -- 'S1J' — court, stable, = shifts.shift_type
  label          text not null,                 -- 'S1 Jour'
  hours          numeric(4,1) not null check (hours > 0 and hours <= 24),
  sort_order     int  not null default 0,       -- ordre d'affichage (colonnes)
  clinical       boolean not null default true, -- créneau à couvrir (vs technique/legacy)
  is_night       boolean not null default false,-- déclenche repos de sécurité + compteur nuits
  weekend        boolean not null default true, -- requis le week-end / férié (couverture réduite)
  start_time     time,                          -- pour le flux .ics (facultatif)
  end_time       time,
  end_day_offset int  not null default 0,       -- 1 = fin le lendemain (créneau de nuit)
  color          text,                          -- badge (facultatif)
  active         boolean not null default true, -- (dés)activable sans suppression
  created_at     timestamptz not null default now()
);
```

**FK au lieu des CHECK** : remplacer les contraintes `CHECK` de `shifts.shift_type`
et `swap_requests.shift_type` par une **clé étrangère** vers `shift_types(code)`
(`on delete restrict`) — un type utilisé ne peut plus être supprimé, seulement
désactivé.

## 5. Sémantique des attributs

| Champ | Remplace | Effet |
| --- | --- | --- |
| `code` | valeur `shift_type` | Identifiant stable (immuable une fois créé). |
| `label` | `SHIFT_LABEL` | Affichage. |
| `hours` | `SHIFT_HOURS` | Compteurs, heures totales/WE, équité, .ics. |
| `clinical` | `CLINICAL_SHIFT_TYPES` | `true` ⇒ compte dans la **couverture** (« à couvrir »). |
| `weekend` | `WEEKEND_SHIFT_TYPES` | `true` ⇒ requis aussi **samedi/dimanche/fériés**. |
| `is_night` | littéral `'S1N'` | `true` ⇒ **repos de sécurité** le lendemain + **compteur nuits** (équité). |
| `start/end_time`, `end_day_offset` | `SHIFT_TIMES` (edge) | Événements **horodatés** du flux .ics. |
| `sort_order` | ordre implicite | Ordre des colonnes (grille, PDF, dialogues). |
| `color`, `active` | — | Confort / cycle de vie. |

`PRIMARY_SHIFT` (« créneau présent tous les jours ») devient **dérivé** : le
premier créneau `clinical` par `sort_order` — ou supprimé si inutilisé.

## 6. Dérivations métier généralisées

- **Couverture** : `activeShiftTypes(date)` = `shiftTypes.filter(t => t.active && t.clinical && (estJourRéduit(date) ? t.weekend : true))`. (`estJourRéduit` = samedi/dimanche **ou** férié, inchangé.)
- **Repos de sécurité** ([`validation.ts`](../src/lib/validation.ts)) : « garde le lendemain d'une garde dont le type a `is_night` » (au lieu de `=== 'S1N'`).
- **Équité** ([`equity.ts`](../src/lib/equity.ts)) : `nights` = nb de gardes dont le type est `is_night`.
- **Compteurs / heures** : `SHIFT_HOURS[type]` → `hoursOf(type)` (lookup config).
- **PDF** ([`monthPdf.ts`](../src/features/planning/monthPdf.ts)) : colonnes **dynamiques** = types `clinical` actifs triés par `sort_order` (largeur de colonne calculée ; **plafond conseillé ~5** pour la lisibilité A4, cf. §14).
- **Flux .ics** (edge) : lit `shift_types` (libellé, heures, horaires) au lieu des maps figées.

## 7. Diffusion de la configuration côté front

La config est **petite et rarement modifiée**. Deux options :

1. **État de module + setter** (recommandé — cohérent avec `setIncludePentecote`
   de [`dates.ts`](../src/lib/dates.ts)) : `shifts.ts` expose `setShiftTypes(cfg)`
   appelé **une fois au login** (comme `applySettings` dans `AuthContext`), et les
   fonctions dérivées lisent l'état de module. Impact de signatures **minimal** ;
   les tests appellent `setShiftTypes(...)` pour injecter une config.
2. **Injection explicite** : passer la config en paramètre à `activeShiftTypes`,
   `computeCounters`, `computeEquity`, `computeIssues`. Plus « pur » mais **beaucoup
   plus de sites d'appel** à modifier.

→ **Recommandation : option 1**, avec un **abonnement Realtime** sur `shift_types`
pour rafraîchir la config si un admin la modifie (comme les autres tables).

## 8. Sécurité / RLS / RPC

- `shift_types` : **lecture** par les médecins approuvés (`using (public.is_approved())`).
- **Écritures via RPC `SECURITY DEFINER`** réservées aux admins (jamais d'écriture
  directe) : `admin_upsert_shift_type(...)`, `admin_set_shift_type_active(code, bool)`,
  `admin_reorder_shift_types(codes[])`, `admin_delete_shift_type(code)` (refuse si
  des `shifts`/`swap_requests` la référencent → message « désactivez plutôt »).
- Ajouter `shift_types` à la publication `supabase_realtime`.
- Fonctions SQL `shift_label(code)` / `shift_hours(code)` **lisent la table** (au
  lieu du `CASE` en dur) → les **triggers de notification** restent corrects.

## 9. UI d'administration

Nouvelle section **« Types de créneaux »** (dans `AdminPanel` ou page `/admin/creneaux`) :

- Liste ordonnée (glisser pour `sort_order`), avec pour chaque type : `code`
  (verrouillé après création), `label`, `hours`, cases **Clinique** / **Week-end**
  / **Nuit**, horaires début/fin (+ « fin le lendemain »), `color`, **actif**.
- Création / édition via un dialogue (réutilise la lib `components/ui/`).
- **Suppression** : proposée seulement si aucun `shift`/`swap` ne référence le
  type ; sinon bouton **Désactiver**.
- Garde-fous : au moins **1 type clinique actif** ; `code` unique et immuable.

## 10. Edge Function `calendar`

Aujourd'hui `SHIFT_LABEL/HOURS/TIMES` sont figés dans la fonction. → charger
`shift_types` via REST (clé service_role, déjà en place) au début de la requête,
construire les maps dynamiquement. Mettre un **petit cache** (mémoire process,
TTL court) pour éviter une requête par appel .ics.

## 11. Cycle de vie d'un type (suppression / renommage / désactivation)

- **Renommer** `label`/`hours`/horaires : sans impact sur les données (le `code`
  ne change pas). Les gardes passées prennent les nouvelles heures dans les
  compteurs recalculés → **choix à confirmer** (cf. §15, décision D3).
- **Désactiver** (`active=false`) : le type disparaît de la **couverture** et des
  dialogues d'affectation, mais les gardes existantes restent affichées/comptées.
- **Supprimer** : autorisé uniquement si **aucune** ligne ne le référence (FK
  `restrict`). Legacy `S3` : seed en `clinical=false, active=false` (conservé pour
  l'historique, jamais proposé).

## 12. Impact TypeScript

`ShiftType` passe d'une **union littérale** à `string` (ou un type marqué
`string & { readonly __brand: 'ShiftType' }`). Conséquences :

- Perte de l'**exhaustivité à la compilation** (plus de `switch` exhaustif garanti).
- `Record<ShiftType, …>` (ex. `SHIFT_HOURS`) → `Map<string, …>` ou `Record<string, …>`.
- `shift_type: ShiftType` dans [`types.ts`](../src/backend/types.ts) et le back → `string`.
- **Validation runtime** renforcée (les valeurs viennent de la DB / FK).

## 13. Plan de déploiement par phases (chaque phase livrable seule)

| Phase | Contenu | Comportement |
| --- | --- | --- |
| **0. Données** | Migration `0022` : table + seed (`S1J/S1N/S2J` clinique, `S3` inactif) + bascule CHECK → FK + fonctions SQL `shift_*` lisant la table | **Aucun** changement visible |
| **1. Config runtime** | Charger `shift_types` au login (`setShiftTypes`), remplacer les constantes de `shifts.ts`, `validation.ts`, `equity.ts` par des lookups | Identique au seed (défauts) |
| **2. Admin** | UI + RPC de gestion des types | Admin peut créer/éditer/désactiver |
| **3. Généralisation rendu** | PDF colonnes dynamiques + edge `calendar` DB-driven | Prise en compte de N types |
| **4. Valeur** | Documentation + activation | Nouveaux services possibles |

## 14. Tests

- **Unitaires** (avec une config injectée via `setShiftTypes`) :
  - `activeShiftTypes` : 4ᵉ type ajouté, un type `weekend=false` absent le samedi.
  - `computeCounters` / heures : type à `hours` fractionnaires.
  - `computeEquity` : **deux** types `is_night` → `nights` cumulés.
  - `computeIssues` : repos de sécurité déclenché par un type `is_night` autre que `S1N`.
- **PDF** : `renderMonthPdf` avec 4–5 colonnes (largeurs, pagination) ; **plafond**
  de colonnes journalisé si dépassé.
- **Migration** : appliquée sur une base avec gardes existantes → FK OK, seed exact.
- **E2E** ([`e2e/tests/planning.spec.ts`](../e2e/tests/planning.spec.ts)) : inchangé
  avec les défauts (non-régression).

## 15. Risques

- **Perte d'exhaustivité TS** (§12) — mitigée par la validation runtime + tests.
- **Mise en page PDF/grille** avec N colonnes variables (A4, mobile 7 colonnes).
- **Cohérence Realtime** de la config (rafraîchir sans recharger les vues ouvertes).
- **Désactivation/suppression** d'un type en cours d'usage (garde-fous + FK).
- **Edge function** désormais dépendante de la DB (latence .ics → cache).
- **Recalcul rétroactif** : changer les `hours` d'un type modifie les compteurs des
  **gardes passées** (voir décision D3).

## 16. Décisions à confirmer

| # | Décision | Recommandation |
| --- | --- | --- |
| **D1** | Clé de jointure : `code` texte (pas de réécriture) vs `id` surrogate | **`code` texte** |
| **D2** | Plafond de types cliniques (contrainte layout PDF/grille) | **~5** (soft, journalisé) |
| **D3** | Heures : instantané figé par garde, ou recalcul rétroactif depuis la config | **Recalcul** (simple) — sinon stocker `hours` sur `shifts` |
| **D4** | « Nuit » = simple booléen `is_night`, ou durée de repos configurable | **Booléen** (repos = « lendemain » comme aujourd'hui) |
| **D5** | Couleur par type dans la grille | Optionnel (phase 2+) |
| **D6** | `weekend`/`clinical` suffisent-ils, ou besoin d'un `required` distinct de `clinical` ? | **Suffisent** (clinique ⇒ requis) |

---

> Prochaine étape si validé : implémenter la **Phase 0** (migration `0022` + seed +
> FK + fonctions SQL), sans aucun changement de comportement, puis la **Phase 1**
> derrière les défauts. Estimation : Phase 0–1 = moyen ; Phases 2–3 = élevé.
