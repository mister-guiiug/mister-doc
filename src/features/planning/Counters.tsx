import { useEffect, useState, type ReactNode } from 'react';
import { CalendarHeart, Loader2 } from 'lucide-react';
import { computeCounters, type CountableShift } from '../../lib/shifts.ts';
import { computeLeaveStats, type CountableLeave } from '../../lib/leaves.ts';
import { sumHncHours } from '../../lib/hnc.ts';
import {
  monthLabel,
  quadrimesterBounds,
  quadrimesterLabel,
} from '../../lib/dates.ts';
import { listShiftsBetween } from '../../backend/planning.ts';
import { listLeavesBetween } from '../../backend/leaves.ts';
import { listHncBetween } from '../../backend/hnc.ts';
import type { HncEntry, Leave, Shift } from '../../backend/types.ts';

/** Portée des compteurs : mois affiché ou quadrimestre (bloc de 4 mois). */
type Scope = 'month' | 'quad';

const SCOPE_KEY = 'mister-doc:counters-scope';

/**
 * Compteurs compacts du médecin connecté : vendredis / samedis / dimanches de
 * garde, heures week-end (ven+sam+dim), heures non cliniques, heures totales
 * (cliniques + HNC), congés annuels et formation. Une bascule permet de calculer
 * ces compteurs sur le mois affiché ou sur le quadrimestre (4 mois) le contenant.
 */
export function Counters({
  shifts,
  leaves,
  hnc,
  doctorId,
  year,
  month,
}: {
  shifts: Shift[];
  leaves: Leave[];
  hnc: HncEntry[];
  doctorId: string;
  year: number;
  month: number;
}) {
  const [scope, setScope] = useState<Scope>(() => {
    try {
      return localStorage.getItem(SCOPE_KEY) === 'quad' ? 'quad' : 'month';
    } catch {
      return 'month';
    }
  });
  // Données du quadrimestre, chargées à la demande (mode « quadri. » seulement).
  const [quad, setQuad] = useState<{
    shifts: Shift[];
    leaves: Leave[];
    hnc: HncEntry[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const [from, to] = quadrimesterBounds(year, month);

  // Charge (et recharge) le quadrimestre quand la portée passe à « quadri. »,
  // que le bloc de 4 mois change, ou que le planning courant est rechargé
  // (les abonnements Realtime rafraîchissent les props `shifts`/`leaves`/`hnc`).
  useEffect(() => {
    if (scope !== 'quad') return;
    let alive = true;
    setLoading(true);
    Promise.all([
      listShiftsBetween(from, to),
      listLeavesBetween(from, to),
      listHncBetween(from, to),
    ])
      .then(([s, l, h]) => {
        if (alive) setQuad({ shifts: s, leaves: l, hnc: h });
      })
      .catch(() => {
        if (alive) setQuad({ shifts: [], leaves: [], hnc: [] });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [scope, from, to, shifts, leaves, hnc]);

  function changeScope(next: Scope) {
    setScope(next);
    try {
      localStorage.setItem(SCOPE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  // En attendant le chargement du quadrimestre, on retombe sur le mois courant.
  const src = scope === 'quad' && quad ? quad : { shifts, leaves, hnc };
  const mineShifts: CountableShift[] = src.shifts
    .filter(s => s.doctor_id === doctorId)
    .map(s => ({ work_date: s.work_date, shift_type: s.shift_type }));
  const mineLeaves: CountableLeave[] = src.leaves
    .filter(l => l.doctor_id === doctorId)
    .map(l => ({ kind: l.kind, hours: l.hours }));
  const c = computeCounters(mineShifts);
  const l = computeLeaveStats(mineLeaves);
  const hncHours = sumHncHours(src.hnc.filter(h => h.doctor_id === doctorId));
  const totalHours = c.totalHours + hncHours;

  const label =
    scope === 'quad' ? quadrimesterLabel(year, month) : monthLabel(year, month);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <CalendarHeart className="size-4 text-teal-600" />
        Mes compteurs
        <span className="font-normal capitalize text-slate-400">· {label}</span>
        {scope === 'quad' && loading && (
          <Loader2 className="size-3.5 animate-spin text-slate-400" />
        )}
        <div className="ml-auto flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-800 dark:bg-slate-800/60">
          <ScopeButton
            active={scope === 'month'}
            onClick={() => changeScope('month')}
          >
            Mois
          </ScopeButton>
          <ScopeButton
            active={scope === 'quad'}
            onClick={() => changeScope('quad')}
          >
            Quadri.
          </ScopeButton>
        </div>
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

/** Bouton d'une bascule segmentée (portée des compteurs). */
function ScopeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md px-2 py-0.5 text-xs font-medium transition ${
        active
          ? 'bg-teal-600 text-white shadow-sm'
          : 'text-slate-500 hover:bg-slate-200/70 dark:text-slate-400 dark:hover:bg-slate-700/70'
      }`}
    >
      {children}
    </button>
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
