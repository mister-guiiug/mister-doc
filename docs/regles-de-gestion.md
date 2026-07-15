# mister-doc — Règles de gestion

Document de référence des règles métier de l'application **mister-doc**
(planning de gardes des médecins d'un hôpital). Rédigé le 2026-07-12, tenu à jour
avec le code (`src/lib/`, `supabase/migrations/`).

---

## 1. Comptes, rôles et accès

- **Inscription** par e-mail + mot de passe (Supabase). Un nouvel inscrit est
  **« en attente »** (`approved = false`) : il **ne voit rien** du planning.
- **Approbation** : un administrateur **approuve** ou **rejette** la demande.
  - Approuver → accès complet au planning (édition partagée).
  - Rejeter → suppression de la fiche **et** du compte (l'e-mail redevient libre).
  - Un compte en attente peut aussi **supprimer lui-même** sa demande.
- **Premier administrateur** : via un **code de bootstrap** secret (écran
  « en attente » → « J'ai un code d'administrateur »). Le code ne fonctionne que
  tant qu'aucun administrateur n'existe.
- **Rôle admin** : approuver/rejeter/promouvoir, gérer le roster, verrouiller un
  mois, voir les compteurs de l'équipe, sauvegarder/restaurer, régler les
  paramètres.
- **Aperçu « médecin »** : un admin peut, via le **bouclier** de l'en-tête,
  masquer temporairement ses fonctions admin et voir l'app comme un non-admin
  (purement visuel ; les droits serveur restent inchangés).
- **Roster** : un admin peut ajouter un médecin **sans compte** (entrée
  assignable au planning) ; ce médecin pourra créer son compte plus tard.
- **Édition partagée** : tout médecin **approuvé** peut affecter/désaffecter
  **n'importe quel** médecin (pas seulement lui-même). Tout le monde voit le
  planning de tout le monde. Synchronisation **temps réel**.

## 2. Créneaux et couverture

- **Créneaux cliniques** (occupant unique — 1 seul médecin par créneau et par
  jour) :

  | Créneau | Libellé | Heures |
  | ------- | ------- | ------ |
  | `S1J`   | S1 Jour | 10 h   |
  | `S1N`   | S1 Nuit | 15 h   |
  | `S2J`   | S2 Jour | 8 h    |

- **Couverture requise** : chaque créneau clinique du jour doit être pourvu ; les
  créneaux vides sont signalés **« à couvrir »**.
- **Exception week-end et jours fériés** — **couverture réduite** : seuls `S1J`
  et `S1N` existent (pas de `S2J`).
  - Week-end = **samedi et dimanche**.
  - Jours fériés = jours fériés **France métropole**, calculés automatiquement
    (Pâques/Ascension/Pentecôte via l'algorithme de Meeus, etc.).
  - Le **Lundi de Pentecôte** est configurable (réglage admin) : compté comme
    férié (couverture réduite) ou jour normal.
- **Semaines** : le planning est numéroté par **semaine ISO 8601** (la semaine
  commence le lundi ; la semaine 1 contient le premier jeudi de l'année).

## 3. Heures Non Cliniques (HNC)

- **HNC** (ancien « S3 ») ≠ garde. Ce sont des heures non cliniques que **un ou
  plusieurs** médecins **saisissent librement** :
  - **plusieurs médecins** peuvent en déclarer le **même jour** ;
  - **chacun son propre nombre d'heures** (valeur libre, > 0, ≤ 24) ;
  - **n'importe quel jour** (y compris week-ends et fériés) ;
  - **hors couverture** : une journée sans HNC est normale (jamais « à couvrir »).
- Les heures HNC **comptent dans le temps total** du médecin **et** dans un
  **compteur HNC dédié**.

## 4. Compteurs

Compteurs du **médecin connecté**, avec une **bascule Mois / Quadrimestre** : le
**mois affiché**, ou le **quadrimestre** (bloc de 4 mois) le contenant. Le choix
est mémorisé (localStorage). Dans les deux cas, les compteurs sont :

- **Vendredis / Samedis / Dimanches** : nombre de **jours distincts** de garde
  clinique tombant un vendredi / samedi / dimanche (un jour compte une seule
  fois même avec plusieurs créneaux).
- **Heures week-end** : somme des heures des créneaux **cliniques** tombant un
  **vendredi, samedi ou dimanche** (colonne « VSD »). Les HNC n'y entrent pas.
- **HNC** : somme des heures non cliniques du médecin sur le mois.
- **Heures totales** : heures cliniques **+ HNC**.
- **Congés (jours)** et **Formation (heures)** : cf. section 5.

Compteurs de **l'équipe** (admin, page « Compteurs ») : même logique, pour tous
les médecins, sur une période **Mois / Quadrimestre (4 mois) / Année**, avec
**export CSV, Excel (.xlsx) et PDF**. Les 3 quadrimestres de l'année : janv.–avr.,
mai–août, sept.–déc.

## 5. Congés et formations

- Une **absence** = un médecin, un jour, un **type** :
  - **Congé annuel** (`annual`) ;
  - **Formation** (`training`) — porte un **nombre d'heures par jour** (0 à 24).
- **1 absence par médecin et par jour** (une nouvelle pose remplace l'ancienne).
- Pose possible sur une **plage de dates** (une entrée par jour).

## 6. Vœux et indisponibilités

- Chaque médecin peut marquer, par jour, un **vœu** :
  - **Dispo** (préférence pour ce jour) ;
  - **Indispo** (à éviter) ;
  - ou aucun.
- **1 vœu par médecin et par jour** ; chacun gère les siens, visibles de tous
  (aide à construire un planning équitable). Sans effet contraignant.

## 7. Échange de gardes

- Un médecin peut **proposer d'échanger** une de ses gardes :
  - **ciblé** (à un collègue précis) ou **ouvert à tous** ;
  - avec un message facultatif.
- **Accepter** une proposition **réaffecte la garde** au repreneur ; les autres
  propositions en attente sur le même créneau sont automatiquement annulées.
- Statuts : en attente / acceptée / refusée / annulée. Notifications à chaque
  étape.

## 8. Notes de jour et verrouillage

- **Note de jour** : un texte libre attaché à une date (réunion, staff, RMM…),
  visible de tous.
- **Verrouillage de mois** (admin) : fige les écritures (gardes, absences, HNC)
  d'un mois validé. Déverrouillable par un admin.

## 9. Alertes de contrôle

Signalées automatiquement (non bloquantes) :

- **Repos de sécurité** : un médecin de garde le **lendemain d'une garde de nuit
  (`S1N`)**.
- **Conflit** : un médecin **de garde ET en absence** le même jour.
- **Cumul** : un médecin sur **plusieurs créneaux** le même jour.

## 10. Notifications

- **In-app** (cloche, temps réel), destinées au médecin concerné :
  garde attribuée / retirée, absence enregistrée, demande de compte (aux admins),
  compte approuvé.
- **Clic** sur une notification = **raccourci** vers le bon écran (planning au
  bon mois, ou Admin).
- **Glissement latéral** sur une notification = la marquer **lue**.

## 11. Historique des changements

- Chaque **affectation / réaffectation / libération** d'un créneau est
  **journalisée**. Au clic sur une case, l'app affiche les **10 derniers**
  changements (auteur + date).

## 12. Diffusion et robustesse

- **Calendrier `.ics`** : flux iCalendar (équipe ou personnel) protégé par un
  **token secret** révocable, à ajouter dans Apple/Google/Outlook Agenda.
- **Sauvegarde/restauration** (admin) + **sauvegarde automatique hebdomadaire**.
- **PWA installable**, utilisable hors-ligne (shell en cache), mise à jour
  automatique.

---

> Détails d'implémentation : voir `README.md` et les migrations
> `supabase/migrations/0001` → `0011`. Les compteurs et le numéro de semaine sont
> couverts par des tests (`src/lib/*.test.ts`).
