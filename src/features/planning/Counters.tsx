import { CalendarHeart } from 'lucide-react';
import { computeCounters, type CountableShift } from '../../lib/shifts.ts';
import { computeLeaveStats, type CountableLeave } from '../../lib/leaves.ts';
import { sumHncHours } from '../../lib/hnc.ts';
import type { HncEntry, Leave, Shift } from '../../backend/types.ts';

/**
 * Compteurs compacts du médecin connecté sur le mois affiché : vendredis /
 * samedis / dimanches de garde, heures week-end (ven+sam+dim), heures non
 * cliniques, heures totales (cliniques + HNC), congés annuels et formation.
 */
export function Counters({
  shifts,
  leaves,
  hnc,
  doctorId,
  monthLabel,
}: {
  shifts: Shift[];
  leaves: Leave[];
  hnc: HncEntry[];
  doctorId: string;
  monthLabel: string;
}) {
  const mineShifts: CountableShift[] = shifts
    .filter(s => s.doctor_id === doctorId)
    .map(s => ({ work_date: s.work_date, shift_type: s.shift_type }));
  const mineLeaves: CountableLeave[] = leaves
    .filter(l => l.doctor_id === doctorId)
    .map(l => ({ kind: l.kind, hours: l.hours }));
  const c = computeCounters(mineShifts);
  const l = computeLeaveStats(mineLeaves);
  const hncHours = sumHncHours(hnc.filter(h => h.doctor_id === doctorId));
  const totalHours = c.totalHours + hncHours;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <CalendarHeart className="size-4 text-teal-600" />
        Mes compteurs
        <span className="font-normal capitalize text-slate-400">
          · {monthLabel}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Pill label="Ven" value={c.fridays} />
        <Pill label="Sam" value={c.saturdays} />
        <Pill label="Dim" value={c.sundays} />
        <Pill label="WE" value={`${c.weekendHours} h`} accent />
        <Pill label="HNC" value={`${hncHours} h`} tone="sky" />
        <Pill label="Total" value={`${totalHours} h`} accent />
        <Pill label="Congés" value={`${l.annualDays} j`} tone="violet" />
        <Pill label="Formation" value={`${l.trainingHours} h`} tone="amber" />
      </div>
    </section>
  );
}

function Pill({
  label,
  value,
  accent,
  tone,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
  tone?: 'violet' | 'amber' | 'sky';
}) {
  const cls = tone
    ? tone === 'violet'
      ? 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300'
      : tone === 'sky'
        ? 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300'
        : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
    : accent
      ? 'border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-200'
      : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200';
  return (
    <span
      className={`inline-flex items-baseline gap-1 rounded-lg border px-2 py-1 text-xs ${cls}`}
    >
      <span className="text-[10px] uppercase opacity-70">{label}</span>
      <span className="text-sm font-bold tabular-nums">{value}</span>
    </span>
  );
}
