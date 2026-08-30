import type { ComponentType } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  CalendarDays,
  CalendarCheck,
  Repeat,
  BarChart3,
  Shield,
  UserRound,
} from 'lucide-react';
import { BottomNav as DwcBottomNav } from '@mister-guiiug/dev-wpa-config/react/bottom-nav';
import { useAuth } from '../auth/useAuth.ts';
import { useI18n } from '../i18n/index.ts';

/**
 * Barre d'onglets basse (mobile uniquement ; sur ≥ sm la navigation est dans
 * l'en-tête). Les destinations et la garde « médecin approuvé » restent ici ;
 * le rendu est délégué au socle (`react/bottom-nav`), qui apporte le nom du
 * repère de navigation, `aria-current`, le trait de l'onglet courant et un
 * « Page actuelle » lu mais non vu — la barre locale ne distinguait l'onglet
 * courant que par l'encre (WCAG 1.4.1).
 *
 * `currentPath` est INDISPENSABLE : l'app est montée sous `HashRouter`, où le
 * `location.pathname` global (le défaut du socle) vaut `/mister-doc/` et ne
 * voit jamais la route. Sans lui, aucun onglet ne serait jamais courant.
 *
 * `maxVisible={6}` : au-delà de 5 destinations, le socle bascule les
 * suivantes sous un bouton « Plus ». Un admin en a six — le repli
 * enverrait « Profil » dans un tiroir, ce que la barre actuelle ne fait pas.
 */
export function BottomNav() {
  const { doctor, isAdmin } = useAuth();
  const { t } = useI18n();
  const { pathname } = useLocation();
  if (!doctor) return null;

  const items = [
    {
      href: '/',
      label: t('nav.planning'),
      icon: <CalendarDays className="size-5" />,
      end: true,
    },
    {
      href: '/mon-planning',
      label: t('nav.me'),
      icon: <CalendarCheck className="size-5" />,
    },
    {
      href: '/echanges',
      label: t('nav.swaps'),
      icon: <Repeat className="size-5" />,
    },
    ...(isAdmin
      ? [
          {
            href: '/compteurs',
            label: t('nav.counters'),
            icon: <BarChart3 className="size-5" />,
          },
          {
            href: '/admin',
            label: t('nav.admin'),
            icon: <Shield className="size-5" />,
          },
        ]
      : []),
    {
      href: '/profil',
      label: t('nav.profile'),
      icon: <UserRound className="size-5" />,
    },
  ];

  return (
    <DwcBottomNav
      items={items}
      currentPath={pathname}
      label={t('nav.main')}
      maxVisible={6}
      // `linkComponent` est typé `ComponentType<Record<string, unknown>>`, qui
      // refuse un composant à prop obligatoire — donc `Link` et son `to`,
      // alors que c'est l'usage documenté du socle. La conversion est sûre :
      // `hrefProp` fournit précisément `to`. `Link` et non `NavLink` : l'état
      // courant est calculé par le socle à partir de `currentPath`, il n'y a
      // qu'une seule source de vérité.
      linkComponent={Link as unknown as ComponentType<Record<string, unknown>>}
      hrefProp="to"
      className="fixed inset-x-0 bottom-0 z-30 bg-white/95 backdrop-blur sm:hidden dark:bg-slate-900/95"
    />
  );
}
