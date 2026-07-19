# Spec — Créneaux (types de garde) configurables

> Statut : **IMPLÉMENTÉ** (migration `0022_shift_types` + Phases 1→4). Ce document
> décrit la conception ET l'état livré. Objet : rendre les types de créneaux
> `S1J / S1N / S2J` — auparavant codés en dur — gérables par un administrateur,
> sans casser l'existant. Les 6 décisions (§16) ont été retenues telles que
> recommandées.

## 1. Contexte & objectif

Les types de garde et leurs propriétés (libellé, base horaire, couverture
week-end, statut « nuit », horaires) étaient **figés dans le code** à trois
créneaux cliniques `S1J` / `S1N` / `S2J` (+ `S3` legacy, remplacé par les HNC).
Objectif : permettre à un **admin** de définir ses propres créneaux (en ajouter,
renommer, changer les heures, marquer « nuit », désactiver…), pour ouvrir l'app à
d'autres services que celui d'origine.

## 2. Objectifs / Non-objectifs

**Objectifs (atteints)**

- Modèle de données pour des types de créneaux **paramétrables** (CRUD admin).
- Généraliser les dérivations métier qui dépendent du type : **couverture** (« à
  couvrir »), **repos de sécurité** (« nuit »), **compteurs**, **équité**, **PDF**,
  **flux .ics**.
- **Rétrocompatibilité totale** : les données `S1J/S1N/S2J/S3` existantes restent
  valides ; par défaut le comportement est identique à avant.

**Non-objectifs (hors périmètre)**

- Rendre configurables les **jours fériés** ou la définition du **week-end**
  (restent : fériés FR + samedi/dimanche).
- **Multi-services / multi-équipes** avec des jeux de créneaux distincts.
- Couverture **variable** (toujours 1 occupant par créneau et par jour).
- Modèle **HNC** (inchangé, table `hnc_hours` séparée).

## 3. État initial — couplage en dur (généralisé)

| Emplacement | Avant | Après |
| --- | --- | --- |
| [`src/lib/shifts.ts`](../src/lib/shifts.ts) | `SHIFT_TYPES`, `ShiftType` (union), `SHIFT_HOURS`, `SHIFT_LABEL` | `ShiftType = string`, config de module + `shiftHours()`/`shiftLabel()`/`isNightShift()` |
| id. | `CLINICAL/WEEKEND/PRIMARY_SHIFT`, `activeShiftTypes` | dérivés de la config (`clinicalShiftTypes()`, `activeShiftTypes()`) |
| [`validation.ts`](../src/lib/validation.ts) | littéral `'S1N'` | `isNightShift(code)` (repos de sécurité) |
| [`equity.ts`](../src/lib/equity.ts) | littéral `'S1N'` + `SHIFT_HOURS` | `isNightShift()` + `shiftHours()` |
| [`monthPdf.ts`](../src/features/planning/monthPdf.ts) | colonnes S1J/S1N/S2J fixes | **colonnes dynamiques** = cliniques actifs |
| [`calendar/index.ts`](../supabase/functions/calendar/index.ts) | maps figées | charge `shift_types` (cache 5 min) + repli |
| `0001`/`0007` | **CHECK** `in (...)` | **FK** vers `shift_types(code)` |
| `0006` | `shift_label(t)` = CASE | lit la table `shift_types` |

`ShiftType` est passé d'une **union littérale** à `string` : la validité vient
désormais de la base (FK) et de la config runtime, plus d'une union figée.

## 4. Modèle de données

Table `public.shift_types` (migration `0022`). Le **`code` reste la clé** (=
`shifts.shift_type`) → aucune ligne existante n'est réécrite.

```sql
create table public.shift_types (
  code, label, hours, sort_order, clinical, is_night, weekend,
  start_time, end_time, end_day_offset, color, active, created_at
);
```

**FK au lieu des CHECK** : `shifts.shift_type` et `swap_requests.shift_type`
référencent `shift_types(code)` `on delete restrict` — un type utilisé ne peut
plus être supprimé, seulement désactivé.

## 5. Sémantique des attributs

| Champ | Remplace | Effet |
| --- | --- | --- |
| `code` | valeur `shift_type` | Identifiant stable (immuable une fois créé). |
| `label` | `SHIFT_LABEL` | Affichage. |
| `hours` | `SHIFT_HOURS` | Compteurs, heures totales/WE, équité, .ics. |
| `clinical` | `CLINICAL_SHIFT_TYPES` | `true` ⇒ compte dans la **couverture**. |
| `weekend` | `WEEKEND_SHIFT_TYPES` | `true` ⇒ requis aussi samedi/dimanche/férié. |
| `is_night` | littéral `'S1N'` | `true` ⇒ **repos de sécurité** le lendemain + **compteur nuits**. |
| `start/end_time`, `end_day_offset` | `SHIFT_TIMES` (edge) | Événements horodatés du flux .ics. |
| `sort_order` | ordre implicite | Ordre des colonnes (grille, PDF, dialogues). |
| `color`, `active` | — | Confort / cycle de vie. |

## 6. Diffusion de la configuration côté front

**État de module + setter** (cohérent avec `setIncludePentecote`) :
`shifts.ts` expose `setShiftTypes(cfg)`, appelé **au login** par `AuthContext`
(via `backend/shiftTypes.listShiftTypes()`), et un **abonnement Realtime** sur
`shift_types` rafraîchit la config + force un re-render global si un admin la
modifie. Les fonctions dérivées lisent l'état de module ; les tests injectent une
config via `setShiftTypes(...)`.

## 7. Sécurité / RLS / RPC

- `shift_types` : **lecture** par les approuvés (`using (public.is_approved())`).
- **Écritures via RPC `SECURITY DEFINER`** réservées aux admins :
  `admin_upsert_shift_type`, `admin_set_shift_type_active`,
  `admin_reorder_shift_types`, `admin_delete_shift_type` (refuse si des
  `shifts`/`swap_requests` référencent le type → « désactivez plutôt »).
- Garde-fou : impossible de désactiver/déclasser le **dernier créneau clinique actif**.
- `shift_label(code)` / `shift_hours(code)` **lisent la table** → les triggers de
  notification restent corrects.
- `shift_types` ajoutée à la publication `supabase_realtime`.

## 8. UI d'administration

Carte **« Types de créneaux »** ([`ShiftTypesCard`](../src/features/admin/ShiftTypesCard.tsx))
dans l'AdminPanel : liste ordonnée (monter/descendre), édition (code verrouillé
après création, libellé, heures, cases Clinique/Week-end/Nuit/Actif, horaires .ics,
« fin le lendemain », couleur), (dés)activation, suppression (si inutilisé).

## 9. Edge Function `calendar`

Charge `shift_types` via REST (service_role) au début de la requête, construit les
maps libellé/heures/horaires dynamiquement, avec **cache mémoire (TTL 5 min)** et
**repli** sur les défauts historiques si la table est absente/incomplète.

## 10. Impact TypeScript

`ShiftType` = `string`. `Record<ShiftType, …>` (ex-`SHIFT_HOURS`) → fonctions de
lookup (`shiftHours`, `shiftLabel`, `isNightShift`) sur la config de module.
Validation renforcée à l'exécution (valeurs venues de la DB / FK).

## 11. Plan de déploiement (livré)

| Phase | Contenu | Comportement |
| --- | --- | --- |
| **0. Données** | Migration `0022` : table + seed + CHECK→FK + fonctions SQL | Aucun changement visible |
| **1. Config runtime** | `setShiftTypes` au login ; lookups dans `shifts/validation/equity` | Identique au seed |
| **2. Admin** | `ShiftTypesCard` + RPC | Admin peut créer/éditer/réordonner/désactiver |
| **3. Rendu** | PDF colonnes dynamiques + edge `calendar` DB-driven | Prise en compte de N types |
| **4. Doc** | Ce document | — |

## 12. Tests

- `shifts.test.ts` : config injectée (4ᵉ créneau en semaine, type `weekend=false`
  absent le samedi, inactif/non-clinique ignorés, heures fractionnaires, liste vide
  ⇒ défauts conservés).
- `equity.test.ts` : **deux** types `is_night` → `nights` cumulés.
- `monthPdf.test.ts` : colonnes = cliniques actifs, cellules par colonne, WE neutralisé.
- **Migration** : vérifiée sous **pglite** (seed exact, FK, `shift_label`, RPC,
  garde-fous) — 15 assertions.

## 13. Risques & mitigations

- **Perte d'exhaustivité TS** — mitigée par la validation runtime + tests.
- **Mise en page PDF** avec N colonnes — largeurs calculées ; **plafond ~6**
  journalisé (`logWarn`).
- **Recalcul rétroactif des heures** (décision D3) — changer `hours` recalcule les
  compteurs des gardes passées (assumé).
- **Edge dépendante de la DB** — cache + repli.

## 14. Décisions retenues

| # | Décision | Choix |
| --- | --- | --- |
| **D1** | Clé de jointure | **`code` texte** (pas de réécriture) |
| **D2** | Plafond de types cliniques | **~6** (soft, journalisé) |
| **D3** | Heures | **Recalcul rétroactif** depuis la config |
| **D4** | « Nuit » | **Booléen `is_night`** (repos = « lendemain ») |
| **D5** | Couleur par type | **Optionnelle** (champ `color`) |
| **D6** | `weekend`/`clinical` | **Suffisent** (clinique ⇒ requis) |
