import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  quadrimesterBounds,
  quadrimesterIndex,
  toISODate,
} from '../../lib/dates.ts';
import { useI18n } from '../../i18n/index.ts';
import { computeCounters } from '../../lib/shifts.ts';
import { computeLeaveStats } from '../../lib/leaves.ts';
import { sumHncHours } from '../../lib/hnc.ts';
import { computeEquity } from '../../lib/equity.ts';
import type { Doctor, HncEntry, Leave, Shift } from '../../backend/types.ts';
import { listDoctors } from '../../backend/doctors.ts';
import { listShiftsBetween } from '../../backend/planning.ts';
import { listLeavesBetween } from '../../backend/leaves.ts';
import { listHncBetween } from '../../backend/hnc.ts';
import { SkeletonTable } from '../../components/ui/Skeleton.tsx';
import {
  CountersToolbar,
  type CountersView,
  type Period,
} from './CountersToolbar.tsx';
import {
  CountersTable,
  type Row,
  type SortKey,
  type SortState,
} from './CountersTable.tsx';
import { EquityView } from './EquityView.tsx';
import type { CounterRow } from './countersExport.ts';

function bounds(period: Period, year: number, month: number): [string, string] {
  if (period === 'year') {
    return [toISODate(new Date(year, 0, 1)), toISODate(new Date(year, 11, 31))];
  }
  if (period === 'quadri') {
    // Quadrimestre : 3 périodes de 4 mois (janv.–avr., mai–août, sept.–déc.).
    return quadrimesterBounds(year, month);
  }
  return [
    toISODate(new Date(year, month, 1)),
    toISODate(new Date(year, month + 1, 0)),
  ];
}

/**
 * Comparaison de deux lignes sur la colonne demandée, toujours en ordre
 * croissant : le sens est appliqué ensuite par l'appelant. Hors `name`, la clé
 * de tri est exactement le nom du champ numérique de `Row`.
 */
function compareRows(a: Row, b: Row, key: SortKey): number {
  if (key === 'name') return a.doctor.name.localeCompare(b.doctor.name);
  return a[key] - b[key];
}

export function AllCounters() {
  const { t, m } = useI18n();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [period, setPeriod] = useState<Period>('month');
  const [view, setView] = useState<CountersView>('table');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [hnc, setHnc] = useState<HncEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Tri par défaut : heures totales décroissantes puis nom croissant, soit
  // exactement l'ordre historique de l'écran (rien ne change à l'ouverture).
  const [sort, setSort] = useState<SortState>({
    key: 'totalHours',
    dir: 'desc',
  });

  const [from, to] = useMemo(
    () => bounds(period, year, month),
    [period, year, month]
  );
  const label = useMemo(() => {
    if (period === 'year') return `${year}`;
    if (period === 'quadri')
      return t('counters.quadLabel', {
        n: quadrimesterIndex(month) + 1,
        year,
      });
    return `${m.common.months[month]} ${year}`;
  }, [period, year, month, t, m]);

  const load = useCallback(async () => {
    try {
      const [d, s, l, h] = await Promise.all([
        listDoctors(),
        listShiftsBetween(from, to),
        listLeavesBetween(from, to),
        listHncBetween(from, to),
      ]);
      setDoctors(d);
      setShifts(s);
      setLeaves(l);
      setHnc(h);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  }, [from, to, t]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const rows = useMemo<Row[]>(() => {
    return doctors
      .map(doctor => {
        const c = computeCounters(
          shifts
            .filter(s => s.doctor_id === doctor.id)
            .map(s => ({ work_date: s.work_date, shift_type: s.shift_type }))
        );
        const lv = computeLeaveStats(
          leaves
            .filter(l => l.doctor_id === doctor.id)
            .map(l => ({ kind: l.kind, hours: l.hours }))
        );
        const hncHours = sumHncHours(
          hnc.filter(h => h.doctor_id === doctor.id)
        );
        return {
          doctor,
          fridays: c.fridays,
          saturdays: c.saturdays,
          sundays: c.sundays,
          weekendHours: c.weekendHours,
          hncHours,
          totalHours: c.totalHours + hncHours,
          annualDays: lv.annualDays,
          trainingHours: lv.trainingHours,
        };
      })
      .sort(
        (a, b) =>
          // Sens demandé sur la colonne, puis nom croissant : l'égalité se
          // départage toujours pareil, l'ordre reste stable et prévisible.
          (sort.dir === 'asc' ? 1 : -1) * compareRows(a, b, sort.key) ||
          a.doctor.name.localeCompare(b.doctor.name)
      );
  }, [doctors, shifts, leaves, hnc, sort]);

  // Un clic sur la colonne déjà triée inverse le sens ; sinon on ouvre sur le
  // sens le plus parlant : décroissant pour un compteur, croissant pour un nom.
  const changeSort = useCallback((key: SortKey) => {
    setSort(prev =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'name' ? 'asc' : 'desc' }
    );
  }, []);

  function shiftPeriod(delta: number) {
    if (period === 'year') {
      setYear(y => y + delta);
    } else if (period === 'quadri') {
      const dt = new Date(year, quadrimesterIndex(month) * 4 + delta * 4, 1);
      setYear(dt.getFullYear());
      setMonth(dt.getMonth());
    } else {
      const dt = new Date(year, month + delta, 1);
      setYear(dt.getFullYear());
      setMonth(dt.getMonth());
    }
  }

  // Équité : charge comparée par médecin (WE / nuits / fériés / heures).
  const equity = useMemo(
    () =>
      computeEquity(
        doctors,
        shifts.map(s => ({
          doctor_id: s.doctor_id,
          work_date: s.work_date,
          shift_type: s.shift_type,
        }))
      ),
    [doctors, shifts]
  );

  // Lignes exportables (nom du médecin + compteurs), partagées par CSV/Excel/PDF.
  // Dérivées de `rows` : l'export suit donc toujours le tri affiché.
  const exportRows = useMemo<CounterRow[]>(
    () =>
      rows.map(r => ({
        name: r.doctor.name,
        fridays: r.fridays,
        saturdays: r.saturdays,
        sundays: r.sundays,
        weekendHours: r.weekendHours,
        hncHours: r.hncHours,
        totalHours: r.totalHours,
        annualDays: r.annualDays,
        trainingHours: r.trainingHours,
      })),
    [rows]
  );

  // Squelette plutôt qu'un spinner plein écran : l'écran charge 4 requêtes
  // (médecins, gardes, absences, HNC) et la mise en page reste stable.
  if (loading) return <SkeletonTable label={t('common.loading')} />;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 px-3 py-4 sm:px-4">
      <CountersToolbar
        view={view}
        onViewChange={setView}
        period={period}
        onPeriodChange={setPeriod}
        label={label}
        onShiftPeriod={shiftPeriod}
        exportRows={exportRows}
      />

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {view === 'equity' ? (
        <EquityView report={equity} label={label} />
      ) : (
        <CountersTable
          rows={rows}
          label={label}
          sort={sort}
          onSortChange={changeSort}
        />
      )}
    </div>
  );
}
