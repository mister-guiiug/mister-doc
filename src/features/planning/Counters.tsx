import { CalendarClock, CalendarHeart, Clock, Sigma } from 'lucide-react';
import { computeCounters, type CountableShift } from '../../lib/shifts.ts';
import type { Shift } from '../../backend/types.ts';

/**
 * Compteurs du médecin connecté sur le mois affiché : nombre de vendredis,
 * samedis, dimanches de garde, total d'heures de week-end (ven+sam+dim) et
 * total d'heures.
 */
export function Counters({
  shifts,
  doctorId,
  monthLabel,
}: {
  shifts: Shift[];
  doctorId: string;
  monthLabel: string;
}) {
  const mine: CountableShift[] = shifts
    .filter(s => s.doctor_id === doctorId)
    .map(s => ({ work_date: s.work_date, shift_type: s.shift_type }));
  const c = computeCounters(mine);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center gap-2">
        <CalendarHeart className="size-5 text-teal-600" />
        <h2 className="font-semibold">Mes compteurs — {monthLabel}</h2>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Vendredis" value={c.fridays} icon={<CalendarClock />} />
        <Stat label="Samedis" value={c.saturdays} icon={<CalendarClock />} />
        <Stat label="Dimanches" value={c.sundays} icon={<CalendarClock />} />
        <Stat
          label="Heures week-end"
          hint="ven + sam + dim"
          value={`${c.weekendHours} h`}
          icon={<Clock />}
          accent
        />
        <Stat
          label="Heures totales"
          value={`${c.totalHours} h`}
          icon={<Sigma />}
          accent
        />
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-0.5 rounded-xl border p-3 ${
        accent
          ? 'border-teal-200 bg-teal-50 dark:border-teal-900 dark:bg-teal-950/40'
          : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40'
      }`}
    >
      <span className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
        <span className="[&>svg]:size-3.5">{icon}</span>
        {label}
      </span>
      <span className="text-2xl font-bold tabular-nums">{value}</span>
      {hint && <span className="text-[10px] text-slate-400">{hint}</span>}
    </div>
  );
}
