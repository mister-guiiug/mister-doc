import { ShieldCheck } from 'lucide-react';
import { useI18n } from '../../i18n/index.ts';
import type { Doctor } from '../../backend/types.ts';

/**
 * En-tête du profil : pastille colorée avec l'initiale, nom, e-mail et badge
 * « admin » le cas échéant. Purement présentationnel.
 */
export function ProfileHeader({
  doctor,
  isAdmin,
}: {
  doctor: Doctor;
  isAdmin: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <span
        className="grid size-14 shrink-0 place-items-center rounded-full text-xl font-bold text-white"
        style={{ backgroundColor: doctor.color }}
      >
        {doctor.name.charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-bold">{doctor.name}</h1>
        {doctor.email && (
          <p className="truncate text-sm text-slate-500 dark:text-slate-400">
            {doctor.email}
          </p>
        )}
      </div>
      {isAdmin && (
        <span className="flex items-center gap-1 rounded-full bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
          <ShieldCheck className="size-3.5" /> {t('profile.admin')}
        </span>
      )}
    </div>
  );
}
