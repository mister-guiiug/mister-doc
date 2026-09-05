import { ConnectionBanner } from '@mister-guiiug/dev-pwa-config/react/connection-banner';
import { useI18n } from '../i18n/index.ts';

/**
 * Bandeau « hors connexion » : le bandeau du socle
 * (`react/connection-banner`), POSÉ — comme `UpdatePrompt` pose celui des
 * mises à jour.
 *
 * CE QUE L'APPLICATION N'AVAIT PAS. mister-doc savait dire « hors ligne », mais
 * seulement sur l'écran Planning, et seulement par DÉDUCTION : `usePlanningData`
 * lève son drapeau dans le `catch` d'un chargement raté, et uniquement s'il
 * trouve un cliché en cache pour le remplacer. Trois angles morts en
 * découlaient : rien sur les échanges, le profil, l'administration ou les
 * compteurs ; rien du tout quand le cache est vide (l'utilisateur voyait une
 * erreur générique) ; et rien tant que l'application n'essaie pas de charger —
 * le réseau pouvait tomber pendant qu'on regarde son mois sans que rien ne
 * bouge. Ici, l'information vient du navigateur, elle est immédiate, et elle
 * vaut pour toutes les pages.
 *
 * POURQUOI LE LIBELLÉ EST PASSÉ. Le défaut du socle est un texte français en
 * dur (« Hors ligne — reconnexion… ») : il ignore la locale, et il promet une
 * reconnexion que l'application n'orchestre pas. Le texte d'ici dit les deux
 * choses vraies pour un planning de gardes : ce qui est affiché peut être
 * périmé, et rien de ce qu'on modifiera ne partira.
 *
 * LA TEMPORISATION RESTE CELLE DU SOCLE (1,5 s hors ligne CONTINU). Un
 * médecin qui traverse un couloir de sous-sol ne doit pas voir une alerte
 * clignoter à chaque pas.
 */
export function OfflineBanner() {
  const { t } = useI18n();

  return (
    <ConnectionBanner
      label={t('connection.offline')}
      // `components.css` habille le bandeau (fond ambré, filet, rayon) mais pas
      // sa PLACE. Dans le flux, tout en haut du document : le bas de l'écran
      // est déjà occupé sur trois niveaux (BottomNav z-30, InstallPrompt z-40,
      // UpdatePrompt z-50) et un quatrième bandeau y passerait sous ou
      // par-dessus les autres. La marge haute inclut la zone sûre iOS, que
      // l'en-tête — désormais poussé plus bas — ne peut plus assurer seul.
      className="mx-3 mt-[calc(0.75rem+env(safe-area-inset-top))] sm:mx-4"
    />
  );
}
