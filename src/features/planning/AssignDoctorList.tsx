import { useMemo, useState } from 'react';
import {
  Loader2,
  Check,
  AlertTriangle,
  Moon,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { shiftHours } from '../../lib/shifts.ts';
import { useI18n } from '../../i18n/index.ts';
import {
  doctorsOnLeave,
  doctorsWorking,
  violatesRest,
} from '../../lib/validation.ts';
import type { Doctor, Leave, Shift, WishKind } from '../../backend/types.ts';

interface AssignDoctorListProps {
  /** Jour du créneau (ISO `YYYY-MM-DD`). */
  iso: string;
  doctors: Doctor[];
  currentShift: Shift | undefined;
  selfDoctorId: string;
  /** Gardes du mois : servent au calcul des heures, du repos et du « de garde ». */
  monthShifts: Shift[];
  leaves: Leave[];
  dayWishes: Map<string, WishKind>;
  /** Mutation en cours : verrouille les lignes (état porté par le dialogue). */
  busy: boolean;
  /** Affecte le créneau au médecin choisi (déjà enveloppé par `run`). */
  onPick: (doctorId: string) => void;
}

/**
 * Recherche + liste des médecins affectables, triée par charge horaire
 * croissante, avec les badges repos / congé / de garde / vœux et la légende.
 *
 * Le filtre et les index dérivés (congés, gardes du jour, heures) ne servent
 * qu'à cette liste : ils vivent donc ici plutôt que dans `AssignDialog`.
 */
export function AssignDoctorList({
  iso,
  doctors,
  currentShift,
  selfDoctorId,
  monthShifts,
  leaves,
  dayWishes,
  busy,
  onPick,
}: AssignDoctorListProps) {
  const [query, setQuery] = useState('');
  const { t } = useI18n();

  const onLeave = useMemo(() => doctorsOnLeave(iso, leaves), [iso, leaves]);
  const working = useMemo(
    () => doctorsWorking(iso, monthShifts),
    [iso, monthShifts]
  );
  const hoursByDoctor = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of monthShifts)
      m.set(s.doctor_id, (m.get(s.doctor_id) ?? 0) + shiftHours(s.shift_type));
    return m;
  }, [monthShifts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return doctors
      .filter(doc => doc.name.toLowerCase().includes(q))
      .sort(
        (a, b) =>
          (hoursByDoctor.get(a.id) ?? 0) - (hoursByDoctor.get(b.id) ?? 0)
      );
  }, [doctors, query, hoursByDoctor]);

  return (
    <>
      <div className="p-3">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('assign.searchPlaceholder')}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-600 dark:bg-slate-800"
        />
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {filtered.length === 0 && (
          <li className="px-2 py-6 text-center text-sm text-slate-400">
            {t('assign.noDoctors')}
          </li>
        )}
        {filtered.map(doc => {
          const active = currentShift?.doctor_id === doc.id;
          const leave = onLeave.has(doc.id);
          const rest = violatesRest(doc.id, iso, monthShifts);
          const busyDay = working.has(doc.id) && !active;
          const hours = hoursByDoctor.get(doc.id) ?? 0;
          return (
            <li key={doc.id}>
              <button
                disabled={busy}
                onClick={() => onPick(doc.id)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"
              >
                <span
                  className="inline-block size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: doc.color }}
                />
                <span className="flex-1 truncate">
                  {doc.name}
                  {doc.id === selfDoctorId && (
                    <span className="ml-1 text-[10px] font-semibold uppercase text-teal-600">
                      {t('common.me')}
                    </span>
                  )}
                </span>
                {rest && (
                  <span
                    title={t('assign.restTitle')}
                    className="flex items-center gap-0.5 rounded bg-red-100 px-1 text-[10px] font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-300"
                  >
                    <Moon className="size-3" /> {t('assign.restBadge')}
                  </span>
                )}
                {leave && (
                  <span
                    title={t('assign.leaveTitle')}
                    className="rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                  >
                    {t('assign.leaveBadge')}
                  </span>
                )}
                {busyDay && (
                  <span
                    title={t('assign.onDutyTitle')}
                    className="rounded bg-slate-200 px-1 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                  >
                    {t('assign.onDutyBadge')}
                  </span>
                )}
                {dayWishes.get(doc.id) === 'prefer' && (
                  <ThumbsUp
                    className="size-3.5 text-emerald-500"
                    aria-label={t('assign.prefersDay')}
                  />
                )}
                {dayWishes.get(doc.id) === 'avoid' && (
                  <ThumbsDown
                    className="size-3.5 text-rose-500"
                    aria-label={t('assign.avoidsDay')}
                  />
                )}
                <span className="tabular-nums text-[11px] text-slate-400">
                  {hours}h
                </span>
                {active &&
                  (busy ? (
                    <Loader2 className="size-4 animate-spin text-teal-600" />
                  ) : (
                    <Check className="size-4 text-teal-600" />
                  ))}
              </button>
            </li>
          );
        })}
      </ul>

      {(onLeave.size > 0 ||
        filtered.some(doc => violatesRest(doc.id, iso, monthShifts))) && (
        <p className="flex items-center gap-1 border-t border-slate-100 px-3 py-2 text-[11px] text-slate-400 dark:border-slate-800">
          <AlertTriangle className="size-3 shrink-0" />
          {t('assign.badgeLegend')}
        </p>
      )}
    </>
  );
}
