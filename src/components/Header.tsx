import { NavLink } from 'react-router-dom';
import { CalendarDays, LogOut, Shield } from 'lucide-react';
import { useAuth } from '../auth/useAuth.ts';

export function Header() {
  const { doctor, signOut } = useAuth();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
      isActive
        ? 'bg-teal-600 text-white'
        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
    }`;

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-900/85">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-2 font-bold">
          <span className="grid size-8 place-items-center rounded-lg bg-teal-600 text-white">
            <CalendarDays className="size-5" />
          </span>
          <span className="hidden sm:inline">mister-doc</span>
        </div>

        <nav className="flex items-center gap-1">
          <NavLink to="/" end className={linkClass}>
            Planning
          </NavLink>
          {doctor?.is_admin && (
            <NavLink to="/admin" className={linkClass}>
              <span className="flex items-center gap-1">
                <Shield className="size-4" /> Admin
              </span>
            </NavLink>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {doctor && (
            <span className="hidden items-center gap-2 text-sm text-slate-600 dark:text-slate-300 sm:flex">
              <span
                className="inline-block size-3 rounded-full"
                style={{ backgroundColor: doctor.color }}
              />
              {doctor.name}
            </span>
          )}
          <button
            onClick={() => void signOut()}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
            title="Se déconnecter"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Quitter</span>
          </button>
        </div>
      </div>
    </header>
  );
}
