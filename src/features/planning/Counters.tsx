import { useEffect, useState, type ReactNode } from 'react';
import { CalendarHeart, Loader2 } from 'lucide-react';
import { computeCounters, type CountableShift } from '../../lib/shifts.ts';
import { TONE_CLASSES, type Tone } from '../../lib/tones.ts';
import { computeLeaveStats, type CountableLeave } from '../../lib/leaves.ts';
import { sumHncHours } from '../../lib/hnc.ts';
import { quadrimesterBounds, quadrimesterIndex } from '../../lib/dates.ts';
import { listShiftsBetween } from '../../backend/planning.ts';
import { listLeavesBetween } from '../../backend/leaves.ts';
import { listHncBetween } from '../../backend/hnc.ts';
import { logError } from '../../lib/logger.ts';
import { useI18n } from '../../i18n/index.ts';
import { SwipeDeck, type DeckView } from '../../components/ui/SwipeDeck.tsx';
import { CountersCalendar } from './CountersCalendar.tsx';
import type { HncEntry, Leave, Shift } from '../../backend/types.ts';

/** Portée des compteurs : mois affiché ou quadrimestre (bloc de 4 mois). */
type Scope = 'month' | 'quad';

const SCOPE_KEY = 'mister-doc:counters-scope';
/** Vue affichée dans le carrousel : 0 = pastilles, 1 = calendrier. */
const VIEW_KEY = 'mister-doc:counters-view';

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
  reloadKey,
}: {
  shifts: Shift[];
  leaves: Leave[];
  hnc: HncEntry[];
  doctorId: string;
  year: number;
  month: number;
  /** Incrémenté à chaque vrai rechargement du planning (pas aux éditions
   * optimistes) : sert de déclencheur unique au refetch du quadrimestre. */
  reloadKey: number;
}) {
  const { t, m } = useI18n();
  const [scope, setScope] = useState<Scope>(() => {
    try {
      return localStorage.getItem(SCOPE_KEY) === 'quad' ? 'quad' : 'month';
    } catch {
      return 'month';
    }
  });
  // Même patron de persistance que la portée : le médecin retrouve la vue qu'il
  // consultait (pastilles ou calendrier) d'une session à l'autre.
  const [view, setView] = useState(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === '1' ? 1 : 0;
    } catch {
      return 0;
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
  // que le bloc de 4 mois change, ou qu'un vrai rechargement du planning a lieu
  // (`reloadKey`). On ne dépend PAS des tableaux `shifts`/`leaves`/`hnc` : leur
  // identité change aussi aux éditions optimistes, ce qui doublait les refetch.
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
      .catch(e => {
        logError('Counters quadrimestre', e);
        if (alive) setQuad({ shifts: [], leaves: [], hnc: [] });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [scope, from, to, reloadKey]);

  function changeScope(next: Scope) {
    setScope(next);
    try {
      localStorage.setItem(SCOPE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  function changeView(next: number) {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, String(next));
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

  const quadStart = quadrimesterIndex(month) * 4;
  const label =
    scope === 'quad'
      ? `${m.common.months[quadStart]} – ${m.common.months[quadStart + 3]} ${year}`
      : `${m.common.months[month]} ${year}`;

  // Le calendrier n'affiche QUE le mois `year`/`month` : en portée « quadri. »,
  // `src.shifts` couvre 4 mois. On filtre donc sur le préfixe ISO `YYYY-MM`,
  // sinon on colorerait des jours appartenant à un autre mois du bloc.
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthShifts = mineShifts.filter(s =>
    s.work_date.startsWith(monthPrefix)
  );

  // Vue 1 = la rangée de pastilles historique (inchangée) ; vue 2 = le
  // mini-calendrier du mois. Les compteurs eux-mêmes ne changent pas.
  const views: DeckView[] = [
    {
      key: 'pills',
      label: t('counters.viewPills'),
      content: (
        <div className="flex flex-wrap gap-1.5">
          <Pill label={t('counters.fri')} value={c.fridays} />
          <Pill label={t('counters.sat')} value={c.saturdays} />
          <Pill label={t('counters.sun')} value={c.sundays} />
          <Pill
            label={t('counters.we')}
            value={`${c.weekendHours} ${t('common.hoursUnit')}`}
            tone="teal"
          />
          <Pill
            label={t('counters.hnc')}
            value={`${hncHours} ${t('common.hoursUnit')}`}
            tone="sky"
          />
          <Pill
            label={t('counters.total')}
            value={`${totalHours} ${t('common.hoursUnit')}`}
            tone="teal"
          />
          <Pill
            label={t('counters.leave')}
            value={`${l.annualDays} ${t('common.daysUnit')}`}
            tone="violet"
          />
          <Pill
            label={t('counters.training')}
            value={`${l.trainingHours} ${t('common.hoursUnit')}`}
            tone="amber"
          />
        </div>
      ),
    },
    {
      key: 'calendar',
      label: t('counters.viewCalendar'),
      content: (
        <CountersCalendar year={year} month={month} shifts={monthShifts} />
      ),
    },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <CalendarHeart className="size-4 text-teal-600" />
        {t('counters.mine')}
        <span className="font-normal capitalize text-slate-500 dark:text-slate-400">
          · {label}
        </span>
        {scope === 'quad' && loading && (
          <Loader2 className="size-3.5 animate-spin text-slate-400" />
        )}
        <div className="ml-auto flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-800 dark:bg-slate-800/60">
          <ScopeButton
            active={scope === 'month'}
            onClick={() => changeScope('month')}
          >
            {t('counters.scopeMonth')}
          </ScopeButton>
          <ScopeButton
            active={scope === 'quad'}
            onClick={() => changeScope('quad')}
          >
            {t('counters.scopeQuad')}
          </ScopeButton>
        </div>
      </div>
      <SwipeDeck
        views={views}
        index={view}
        onIndexChange={changeView}
        ariaLabel={t('counters.deckAria')}
        dotLabel={(n, total) => t('counters.viewDot', { n, total })}
      />
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
          ? 'bg-teal-700 text-white shadow-sm'
          : 'text-slate-600 hover:bg-slate-200/70 dark:text-slate-400 dark:hover:bg-slate-700/70'
      }`}
    >
      {children}
    </button>
  );
}

function Pill({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number | string;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex items-baseline gap-1 rounded-lg border px-2 py-1 text-xs ${TONE_CLASSES[tone]}`}
    >
      {/* Sans opacité réduite : le ratio de contraste AA doit rester ≥ 4.5. */}
      <span className="text-[10px] uppercase">{label}</span>
      <span className="text-sm font-bold tabular-nums">{value}</span>
    </span>
  );
}
