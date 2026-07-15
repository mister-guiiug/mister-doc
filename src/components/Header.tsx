import { NavLink } from 'react-router-dom';
import {
  CalendarDays,
  CalendarCheck,
  Shield,
  ShieldCheck,
  ShieldOff,
  BarChart3,
  Repeat,
} from 'lucide-react';
import { useAuth } from '../auth/useAuth.ts';
import { NotificationsBell } from './NotificationsBell.tsx';

export function Header() {
  const { doctor, isAdmin, previewMember, togglePreviewMember } = useAuth();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
      isActive
        ? 'bg-teal-600 text-white'
        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
    }`;

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 pt-[env(safe-area-inset-top)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/85">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4">
        <div className="flex items-center gap-2 font-bold">
          <span className="grid size-8 place-items-center rounded-lg bg-teal-600 text-white">
            <CalendarDays className="size-5" />
          </span>
          <span>mister-doc</span>
        </div>

        {/* Navigation principale : en-tête sur ≥ sm, barre basse sur mobile. */}
        <nav className="hidden items-center gap-1 sm:flex">
          <NavLink to="/" end className={linkClass}>
            Planning
          </NavLink>
          {doctor && (
            <NavLink to="/mon-planning" className={linkClass} title="Mon planning">
              <span className="flex items-center gap-1">
                <CalendarCheck className="size-4" />
                Moi
              </span>
            </NavLink>
          )}
          {doctor && (
            <NavLink to="/echanges" className={linkClass} title="Échanges">
              <span className="flex items-center gap-1">
                <Repeat className="size-4" />
                Échanges
              </span>
            </NavLink>
          )}
          {isAdmin && (
            <>
              <NavLink to="/compteurs" className={linkClass} title="Compteurs">
                <span className="flex items-center gap-1">
                  <BarChart3 className="size-4" />
                  Compteurs
                </span>
              </NavLink>
              <NavLink to="/admin" className={linkClass} title="Admin">
                <span className="flex items-center gap-1">
                  <Shield className="size-4" />
                  Admin
                </span>
              </NavLink>
            </>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {doctor?.is_admin && (
            <button
              onClick={togglePreviewMember}
              aria-pressed={!previewMember}
              title={
                previewMember
                  ? 'Aperçu médecin actif — revenir en vue admin'
                  : 'Voir le planning comme un médecin (sans les fonctions admin)'
              }
              className={`flex items-center gap-1 rounded-lg p-1.5 text-sm font-medium transition ${
                previewMember
                  ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                  : 'text-teal-600 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {previewMember ? (
                <>
                  <ShieldOff className="size-5" />
                  <span className="hidden sm:inline">Aperçu médecin</span>
                </>
              ) : (
                <ShieldCheck className="size-5" />
              )}
            </button>
          )}
          {doctor && <NotificationsBell />}
          {doctor && (
            <NavLink
              to="/profil"
              title="Mon profil"
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition ${
                  isActive
                    ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`
              }
            >
              <span
                className="grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
                style={{ backgroundColor: doctor.color }}
              >
                {doctor.name.charAt(0).toUpperCase()}
              </span>
              <span className="hidden max-w-32 truncate sm:inline">
                {doctor.name}
              </span>
            </NavLink>
          )}
        </div>
      </div>
    </header>
  );
}
