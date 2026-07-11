import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { CalendarDays, LogOut, Shield, Pencil, BarChart3 } from 'lucide-react';
import { useAuth } from '../auth/useAuth.ts';
import { updateMyProfile } from '../backend/doctors.ts';
import { ProfileDialog } from './ProfileDialog.tsx';

export function Header() {
  const { doctor, signOut, refreshDoctor } = useAuth();
  const [editing, setEditing] = useState(false);

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
          <span className="hidden sm:inline">mister-doc</span>
        </div>

        <nav className="flex items-center gap-1">
          <NavLink to="/" end className={linkClass}>
            Planning
          </NavLink>
          {doctor?.is_admin && (
            <>
              <NavLink to="/compteurs" className={linkClass} title="Compteurs">
                <span className="flex items-center gap-1">
                  <BarChart3 className="size-4" />
                  <span className="hidden sm:inline">Compteurs</span>
                </span>
              </NavLink>
              <NavLink to="/admin" className={linkClass} title="Admin">
                <span className="flex items-center gap-1">
                  <Shield className="size-4" />
                  <span className="hidden sm:inline">Admin</span>
                </span>
              </NavLink>
            </>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {doctor && (
            <button
              onClick={() => setEditing(true)}
              title="Modifier mon nom / ma couleur"
              className="group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <span
                className="inline-block size-3 shrink-0 rounded-full"
                style={{ backgroundColor: doctor.color }}
              />
              <span className="hidden sm:inline">{doctor.name}</span>
              <Pencil className="size-3.5 text-slate-400 opacity-0 transition group-hover:opacity-100" />
            </button>
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

      {editing && doctor && (
        <ProfileDialog
          title="Mon profil"
          initialName={doctor.name}
          initialColor={doctor.color}
          onSave={async (name, color) => {
            await updateMyProfile(name, color);
            await refreshDoctor();
          }}
          onClose={() => setEditing(false)}
        />
      )}
    </header>
  );
}
