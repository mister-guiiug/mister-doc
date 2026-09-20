import {
  createContext,
  useCallback,
  useContext,
  useState,
  useTransition,
  type ComponentProps,
  type MouseEvent,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';

/**
 * CE QUE CE MODULE CORRIGE : un clic de menu sans aucun effet visible.
 *
 * mister-doc a DEUX navigations — l'en-tête sur ≥ sm, la barre basse sur
 * mobile — et le même défaut les touchait toutes les deux. À la première
 * visite, cliquer sur une destination ne produit rien pendant que le morceau
 * `React.lazy` de la vue fait son aller-retour réseau. Mesuré à froid le
 * 20/09/2026 sur deux sites publiés du parc : 133 ms d'écran figé sur
 * mister-settle, 161 ms sur mister-molkky, `aria-busy` faux d'un bout à
 * l'autre.
 *
 * LA CAUSE N'EST PAS UNE LENTEUR ANORMALE. react-router 7 enveloppe tout
 * changement d'URL dans `startTransition` — littéralement, dans son
 * `HashRouter` — et React 19 garde alors délibérément l'écran déjà affiché
 * plutôt que de le remplacer par le repli de `<Suspense>`. Ce repli est donc du
 * CODE MORT AU CLIC : il ne paraît que sur un atterrissage direct sur l'URL.
 *
 * Ce qui marche : piloter la navigation dans SA PROPRE transition, ce que
 * react-router n'expose pas hors d'un routeur de données (`useNavigation()` est
 * réservé aux `RouterProvider`). `enCours` reste alors vrai tant que le morceau
 * n'est pas arrivé.
 */
export function useTransitionDeMenu() {
  const navigate = useNavigate();
  const [enCours, demarreLaTransition] = useTransition();
  const [ciblePendante, setCiblePendante] = useState<string | null>(null);

  const versLaVue = useCallback(
    (e: MouseEvent<HTMLAnchorElement>, to: string) => {
      // On laisse le navigateur faire son travail quand le visiteur le lui
      // demande : nouvel onglet, nouvelle fenêtre, enregistrement de la cible.
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      e.preventDefault();
      setCiblePendante(to);
      demarreLaTransition(() => navigate(to));
    },
    [navigate]
  );

  return {
    enCours,
    /** La destination qui charge, ou `null` : de quoi habiller UNE entrée. */
    enAttente: enCours ? ciblePendante : null,
    versLaVue,
  };
}

/**
 * Le geste de navigation, porté jusqu'au `linkComponent` de la barre du socle.
 *
 * POURQUOI UN CONTEXTE. `BottomNav` construit lui-même le `onClick` de chaque
 * lien — `onClick: () => { setMoreOpen(false); onNavigate?.(item); }`, SANS
 * l'événement — donc ni `preventDefault`, ni touche de modification, ni
 * transition ne peuvent passer par `onNavigate`. Le seul point d'entrée qui
 * reçoit l'événement est le composant de lien, et le socle ne lui transmet que
 * ce qu'il connaît. Un contexte l'atteint sans redéfinir le composant à chaque
 * rendu — ce qui le remonterait, et perdrait le focus au clavier.
 *
 * L'en-tête, lui, rend ses `NavLink` directement : il n'a pas besoin de ce
 * détour et appelle `versLaVue` depuis son propre `onClick`.
 */
export const NavigationDuMenu = createContext<{
  versLaVue: (e: MouseEvent<HTMLAnchorElement>, to: string) => void;
  enAttente: string | null;
} | null>(null);

export function LienDeMenu({
  to,
  onClick,
  ...reste
}: ComponentProps<typeof Link>) {
  const menu = useContext(NavigationDuMenu);
  const cible = typeof to === 'string' ? to : '';
  return (
    <Link
      to={to}
      aria-busy={menu?.enAttente === cible || undefined}
      onClick={e => {
        onClick?.(e);
        menu?.versLaVue(e, cible);
      }}
      {...reste}
    />
  );
}
