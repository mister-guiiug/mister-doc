import { NavLink } from 'react-router-dom';
import {
  CalendarDays,
  Repeat,
  BarChart3,
  Shield,
  UserRound,
} from 'lucide-react';
import { useAuth } from '../auth/useAuth.ts';

interface Item {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
}

/**
 * Barre d'onglets basse (mobile uniquement). Sur ≥ sm, la navigation est dans
 * l'en-tête. Centralise les destinations principales pour une navigation
 * cohérente au pouce.
 */
export function BottomNav() {
  const { doctor } = useAuth();
  if (!doctor) return null;

  const items: Item[] = [
    { to: '/', label: 'Planning', icon: <CalendarDays className="size-5" />, end: true },
    { to: '/echanges', label: 'Échanges', icon: <Repeat className="size-5" /> },
    ...(doctor.is_admin
      ? [
          { to: '/compteurs', label: 'Compteurs', icon: <BarChart3 className="size-5" /> },
          { to: '/admin', label: 'Admin', icon: <Shield className="size-5" /> },
        ]
      : []),
    { to: '/profil', label: 'Profil', icon: <UserRound className="size-5" /> },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden dark:border-slate-800 dark:bg-slate-900/95">
      <div className="mx-auto flex max-w-md items-stretch justify-around">
        {items.map(it => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition ${
                isActive
                  ? 'text-teal-600 dark:text-teal-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`
            }
          >
            {it.icon}
            {it.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
