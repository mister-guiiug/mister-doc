import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CalendarPlus,
  Moon,
  Sun,
  Star,
  Clock3,
  CalendarOff,
} from 'lucide-react';
import { useAuth } from '../../auth/useAuth.ts';
import {
  monthDays,
  monthLabel,
  WEEKDAY_LABELS,
  type MonthDay,
} from '../../lib/dates.ts';
import { shiftLabel, shiftHours, isNightShift } from '../../lib/shifts.ts';
import { LEAVE_LABEL } from '../../lib/leaves.ts';
import { logError } from '../../lib/logger.ts';
import { useDebouncedCallback } from '../../lib/useDebouncedCallback.ts';
import type { HncEntry, Leave, Shift } from '../../backend/types.ts';
import { listMonthShifts, subscribeShifts } from '../../backend/planning.ts';
import { listMonthLeaves, subscribeLeaves } from '../../backend/leaves.ts';
import { listMonthHnc, subscribeHnc } from '../../backend/hnc.ts';
import { Counters } from './Counters.tsx';
import { CalendarDialog } from '../../components/CalendarDialog.tsx';
import { FullScreenSpinner } from '../../components/Spinner.tsx';

/** Un jour de l'agenda personnel : la date + ce que j'y ai (gardes/absences/HNC). */
interface DayItem {
  day: MonthDay;
  shifts: Shift[];
  leaves: Leave[];
  hnc: HncEntry[];
}

/**
 * Vue « Mon planning » : agenda personnel du médecin connecté sur le mois
 * (gardes, absences, HNC), en liste chronologique des seuls jours concernés,
 * avec ses compteurs en tête et un accès à l'abonnement calendrier .ics.
 */
export function MyPlanningView() {
  const { doctor } = useAuth();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [hnc, setHnc] = useState<HncEntry[]>([]);
  const [firstLoad, setFirstLoad] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [calendar, setCalendar] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, l, h] = await Promise.all([
        listMonthShifts(year, month),
        listMonthLeaves(year, month),
        listMonthHnc(year, month),
      ]);
      setShifts(s);
      setLeaves(l);
      setHnc(h);
      setReloadKey(k => k + 1);
    } catch (e) {
      logError('MyPlanning load', e);
    }
  }, [year, month]);

  useEffect(() => {
    load().finally(() => setFirstLoad(false));
  }, [load]);

  const reloadDebounced = useDebouncedCallback(() => void load(), 250);
  useEffect(() => subscribeShifts(reloadDebounced), [reloadDebounced]);
  useEffect(() => subscribeLeaves(reloadDebounced), [reloadDebounced]);
  useEffect(() => subscribeHnc(reloadDebounced), [reloadDebounced]);

  const items = useMemo<DayItem[]>(() => {
    if (!doctor) return [];
    const mineS = shifts.filter(s => s.doctor_id === doctor.id);
    const mineL = leaves.filter(l => l.doctor_id === doctor.id);
    const mineH = hnc.filter(h => h.doctor_id === doctor.id);
    return monthDays(year, month)
      .map(day => ({
        day,
        shifts: mineS.filter(s => s.work_date === day.iso),
        leaves: mineL.filter(l => l.work_date === day.iso),
        hnc: mineH.filter(h => h.work_date === day.iso),
      }))
      .filter(r => r.shifts.length || r.leaves.length || r.hnc.length);
  }, [doctor, shifts, leaves, hnc, year, month]);

  function shiftMonth(delta: number) {
    const dt = new Date(year, month + delta, 1);
    setYear(dt.getFullYear());
    setMonth(dt.getMonth());
  }

  if (!doctor) return null;
  if (firstLoad) return <FullScreenSpinner label="Chargement…" />;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-3 py-4 sm:px-4">
      <Counters
        shifts={shifts}
        leaves={leaves}
        hnc={hnc}
        doctorId={doctor.id}
        year={year}
        month={month}
        reloadKey={reloadKey}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
          <button
            onClick={() => shiftMonth(-1)}
            className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Mois précédent"
          >
            <ChevronLeft className="size-5" />
          </button>
          <span className="min-w-32 text-center text-sm font-semibold capitalize">
            {monthLabel(year, month)}
          </span>
          <button
            onClick={() => shiftMonth(1)}
            className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Mois suivant"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
        <button
          onClick={() => {
            setYear(today.getFullYear());
            setMonth(today.getMonth());
          }}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
        >
          Auj.
        </button>
        <button
          onClick={() => setCalendar(true)}
          className="ml-auto flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
        >
          <CalendarPlus className="size-4" /> Calendrier
        </button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400 dark:border-slate-800 dark:bg-slate-900">
          Rien de prévu ce mois-ci.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map(item => (
            <DayCard key={item.day.iso} item={item} />
          ))}
        </ul>
      )}

      {calendar && <CalendarDialog onClose={() => setCalendar(false)} />}
    </div>
  );
}

function DayCard({ item }: { item: DayItem }) {
  const { day, shifts, leaves, hnc } = item;
  return (
    <li
      className={`flex items-start gap-3 rounded-xl border p-3 ${
        day.reduced
          ? 'border-teal-200 bg-teal-50/60 dark:border-teal-900/60 dark:bg-teal-950/20'
          : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
      }`}
    >
      <div className="flex w-12 shrink-0 flex-col items-center leading-tight">
        <span className="text-[11px] uppercase text-slate-400">
          {WEEKDAY_LABELS[day.weekday].slice(0, 3)}
        </span>
        <span className="text-lg font-bold tabular-nums">
          {day.date.getDate()}
        </span>
        {day.holiday && (
          <Star
            className="size-3 text-amber-500"
            aria-label={day.holidayName ?? 'Férié'}
          />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 pt-0.5">
        {shifts.map(s => (
          <Badge
            key={s.id}
            tone={isNightShift(s.shift_type) ? 'indigo' : 'teal'}
            icon={
              isNightShift(s.shift_type) ? (
                <Moon className="size-3" />
              ) : (
                <Sun className="size-3" />
              )
            }
          >
            {shiftLabel(s.shift_type)} · {shiftHours(s.shift_type)} h
          </Badge>
        ))}
        {leaves.map(l => (
          <Badge
            key={l.id}
            tone={l.kind === 'training' ? 'amber' : 'violet'}
            icon={<CalendarOff className="size-3" />}
          >
            {LEAVE_LABEL[l.kind]}
            {l.kind === 'training' && l.hours != null ? ` · ${l.hours} h` : ''}
          </Badge>
        ))}
        {hnc.map(h => (
          <Badge key={h.id} tone="sky" icon={<Clock3 className="size-3" />}>
            HNC · {h.hours} h
          </Badge>
        ))}
      </div>
    </li>
  );
}

const TONES: Record<string, string> = {
  teal: 'border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-200',
  indigo:
    'border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200',
  violet:
    'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200',
  amber:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
  sky: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200',
};

function Badge({
  tone,
  icon,
  children,
}: {
  tone: keyof typeof TONES | string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${TONES[tone] ?? TONES.teal}`}
    >
      {icon}
      {children}
    </span>
  );
}
