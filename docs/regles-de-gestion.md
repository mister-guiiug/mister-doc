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

- **Créneaux configurables** (table `shift_types`, migration `0022`) : les types
  de garde ne sont **plus figés dans le code**. Un **admin** les gère depuis
  l'onglet Admin (créer, éditer, réordonner, (dés)activer). Le **code** (`S1J`…)
  est l'identifiant stable, immuable après création ; la suppression n'est
  permise que si aucune garde ni proposition d'échange ne l'utilise — sinon on
  **désactive**. Au moins **un créneau clinique actif** doit toujours subsister.
- **Sémantique des attributs** :

  | Attribut                        | Effet métier                                                             |
  | ------------------------------- | ------------------------------------------------------------------------ |
  | Libellé                         | affichage (planning, notifications, `.ics`, PDF)                         |
  | Heures                          | compteurs (heures totales / week-end), équité, `.ics`                    |
  | **Clinique**                    | le créneau entre dans la **couverture** (« à couvrir »)                  |
  | **Requis le week-end**          | il reste requis le samedi, le dimanche et les jours fériés               |
  | **Nuit**                        | déclenche le **repos de sécurité** le lendemain et le **compteur nuits** |
  | Horaires + « fin le lendemain » | événements horodatés du flux `.ics`                                      |
  | Couleur, ordre, actif           | affichage, ordre des colonnes, cycle de vie                              |

- **Occupant unique** : 1 seul médecin par créneau et par jour.
- **Configuration par défaut** (= comportement historique) :

  | Créneau | Libellé | Heures | Week-end | Nuit |
  | ------- | ------- | ------ | -------- | ---- |
  | `S1J`   | S1 Jour | 10 h   | oui      | non  |
  | `S1N`   | S1 Nuit | 15 h   | oui      | oui  |
  | `S2J`   | S2 Jour | 8 h    | non      | non  |

- **Couverture requise** : chaque créneau clinique actif du jour doit être
  pourvu ; les créneaux vides sont signalés **« à couvrir »**.
- **Exception week-end et jours fériés** — **couverture réduite** : seuls les
  créneaux marqués **« requis le week-end »** sont attendus (avec la
  configuration par défaut : `S1J` et `S1N`, donc pas de `S2J`).
  - Week-end = **samedi et dimanche**.
  - Jours fériés = jours fériés **France métropole**, calculés automatiquement
    (Pâques/Ascension/Pentecôte via l'algorithme de Meeus, etc.).
  - Le **Lundi de Pentecôte** est configurable (réglage admin) : compté comme
    férié (couverture réduite) ou jour normal.
- **Semaines** : le planning est numéroté par **semaine ISO 8601** (la semaine
  commence le lundi ; la semaine 1 contient le premier jeudi de l'année).
- Conception détaillée de la configuration des créneaux :
  `docs/spec-creneaux-configurables.md`.

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

Ils s'affichent dans un **carrousel** de deux vues (également mémorisé) : les
**pastilles** chiffrées ci-dessus, ou un **mini-calendrier** du mois affiché
reprenant ses jours de garde.

Compteurs de **l'équipe** (admin, page « Compteurs ») : même logique, pour tous
les médecins, sur une période **Mois / Quadrimestre (4 mois) / Année**, avec
**export CSV, Excel (.xlsx) et PDF**. Les 3 quadrimestres de l'année : janv.–avr.,
mai–août, sept.–déc.

La page « Compteurs » propose deux vues : **Tableau** (détail chiffré ci-dessus,
**chaque colonne triable**) et **Équité**, qui compare la charge « pénible » par
médecin — **jours de week-end**, **nuits** (créneaux marqués « nuit »), **jours
fériés**, **heures cliniques** — avec une barre proportionnelle au maximum de
l'équipe et l'**écart à la moyenne** (▲/▼), pour repérer les déséquilibres de
répartition.

**Mon planning** (`/mon-planning`, accessible à tout médecin) : agenda
**personnel** du mois (mes gardes, absences et HNC) en liste chronologique, avec
mes compteurs en tête et l'accès à l'abonnement calendrier `.ics`.

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

## 7. Échange de gardes (Bourse aux gardes)

- Un médecin peut **proposer d'échanger** une de ses gardes :
  - depuis la **Bourse aux gardes** — bouton « Proposer une garde », qui liste ses
    gardes cliniques à venir (60 j) — ou depuis le planning ;
  - **ciblé** (à un collègue précis) ou **ouvert à tous** ;
  - avec un message facultatif.
- La page **Bourse aux gardes** regroupe : les propositions **pour moi**, celles
  **ouvertes à tous** (triées par date, avec « dans N j »), **mes propositions**
  (annulables) et un **historique** des propositions résolues.
- **Accepter** une proposition **réaffecte la garde** au repreneur ; les autres
  propositions en attente sur le même créneau sont automatiquement annulées.
- Statuts : en attente / acceptée / refusée / annulée. Notifications à chaque
  étape.

## 8. Notes de jour et verrouillage

- **Note de jour** : un texte libre attaché à une date (réunion, staff, RMM…),
  visible de tous.
- **Verrouillage de mois** (admin) : fige les écritures (gardes, absences, HNC)
  d'un mois validé. Déverrouillable par un admin.

## 9. Affectation en série (répétition, copie de mois)

Deux raccourcis affectent plusieurs jours d'un coup. Ils passent par les mêmes
contrôles serveur que l'affectation unitaire (RLS, verrou de mois, historique).

- **Répéter sur plusieurs semaines** (dialogue d'affectation) : le même médecin,
  sur le **même créneau**, de **1 à 4 semaines** — le jour choisi puis les mêmes
  jours de semaine suivants (J+7, J+14, J+21). Une date est **ignorée**, sans
  empêcher les autres, si le créneau n'est pas à couvrir ce jour-là (week-end,
  férié, créneau désactivé) ou si son **mois est verrouillé** — la répétition
  peut déborder sur le mois suivant. Le jour **choisi** se comporte comme une
  affectation simple et **remplace** l'occupant éventuel — c'est le créneau que
  l'on vient d'ouvrir. Les semaines **suivantes**, elles, n'écrasent jamais : un
  créneau déjà attribué y est ignoré, pour ne pas déloger un collègue à son
  insu. Le décompte des dates retenues et des dates ignorées (avec leur motif)
  est affiché après coup.
- **Copier le mois précédent** (barre d'outils du planning) : reprend les
  **gardes seules** du mois précédent — ni absences, ni HNC, ni notes, ni vœux.
  - **Alignement sur le jour de semaine**, pas sur le quantième : le 1er du mois
    source se projette sur le premier jour du mois cible ayant le **même jour de
    semaine**, puis jour par jour (un mardi reste un mardi). Ce décalage pousse
    mécaniquement les derniers jours du mois source **hors** du mois cible : ils
    sont ignorés.
  - Sont aussi **ignorées** les dates où le créneau n'est pas à couvrir
    (week-end, férié, créneau désactivé) et les créneaux **déjà attribués** dans
    le mois cible — la copie n'écrase **jamais** rien, elle n'ajoute que.
  - **Mois cible verrouillé** : la copie est refusée.
  - Un **récapitulatif** (nombre de gardes à créer, nombre d'ignorées et motif)
    est présenté **avant** toute écriture ; rien n'est écrit sans confirmation.
  - Le lot est inséré en **une transaction** et ne produit qu'**une seule
    notification par médecin** (cf. §11).

## 10. Alertes de contrôle

Signalées automatiquement (non bloquantes) :

- **Repos de sécurité** : un médecin de garde le **lendemain d'un créneau marqué
  « nuit »** (par défaut `S1N`).
- **Conflit** : un médecin **de garde ET en absence** le même jour.
- **Cumul** : un médecin sur **plusieurs créneaux** le même jour.

## 11. Notifications

- **In-app** (cloche, temps réel), destinées au médecin concerné : garde
  attribuée / retirée, absence enregistrée / supprimée, heures non cliniques,
  échange proposé / accepté / décliné, rappel de garde (« demain », « nuit ce
  soir »), récapitulatif hebdomadaire, mois verrouillé / déverrouillé, demande
  de compte (aux admins) et compte approuvé.
- **Groupage à l'affectation** : une **insertion en lot** de gardes (copie de
  mois) ne produit qu'**une notification par médecin** — une garde isolée
  conserve le message habituel, un petit lot liste les dates, un gros lot donne
  la plage couverte. Retrait et réaffectation restent notifiés **garde par
  garde**.
- **Rappels automatiques** : « garde demain » et « nuit ce soir » chaque jour,
  et un **récapitulatif hebdomadaire** des gardes des 7 jours à venir. Un même
  rappel n'est jamais envoyé deux fois pour la même date.
- **Clic** sur une notification = **raccourci** vers le bon écran (planning au
  bon mois, ou Admin).
- **Glissement latéral** sur une notification = la marquer **lue**.

## 12. Historique des changements

- Chaque **affectation / réaffectation / libération** d'un créneau est
  **journalisée**. Au clic sur une case, l'app affiche les **10 derniers**
  changements (auteur + date).

## 13. Diffusion et robustesse

- **Calendrier `.ics`** : flux iCalendar (équipe ou personnel) protégé par un
  **token secret** révocable, à ajouter dans Apple/Google/Outlook Agenda.
- **Sauvegarde/restauration** (admin) + **sauvegarde automatique hebdomadaire**.
- **PWA installable**, utilisable hors-ligne (shell en cache), mise à jour
  automatique.

---

> Détails d'implémentation : voir `README.md` et les migrations
> `supabase/migrations/0001` → `0025`. Les compteurs, le numéro de semaine, les
> créneaux configurables, la répétition hebdomadaire et la copie de mois sont
> couverts par des tests (`src/lib/*.test.ts`).
