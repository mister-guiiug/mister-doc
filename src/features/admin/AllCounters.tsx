import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Users, Download } from 'lucide-react';
import { MONTH_LABELS, toISODate } from '../../lib/dates.ts';
import { computeCounters } from '../../lib/shifts.ts';
import { computeLeaveStats } from '../../lib/leaves.ts';
import type { Doctor, Leave, Shift } from '../../backend/types.ts';
import { listDoctors } from '../../backend/doctors.ts';
import { listShiftsBetween } from '../../backend/planning.ts';
import { listLeavesBetween } from '../../backend/leaves.ts';
import { FullScreenSpinner } from '../../components/Spinner.tsx';

type Period = 'month' | 'quadri' | 'year';

interface Row {
  doctor: Doctor;
  fridays: number;
  saturdays: number;
  sundays: number;
  weekendHours: number;
  totalHours: number;
  annualDays: number;
  trainingHours: number;
}

function bounds(period: Period, year: number, month: number): [string, string, string] {
  if (period === 'year') {
    return [toISODate(new Date(year, 0, 1)), toISODate(new Date(year, 11, 31)), `${year}`];
  }
  if (period === 'quadri') {
    // Quadrimestre : 3 périodes de 4 mois (janv.–avr., mai–août, sept.–déc.).
    const q = Math.floor(month / 4);
    const start = q * 4;
    return [
      toISODate(new Date(year, start, 1)),
      toISODate(new Date(year, start + 4, 0)),
      `Quad. ${q + 1} ${year}`,
    ];
  }
  return [
    toISODate(new Date(year, month, 1)),
    toISODate(new Date(year, month + 1, 0)),
    `${MONTH_LABELS[month]} ${year}`,
  ];
}

export function AllCounters() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [period, setPeriod] = useState<Period>('month');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [from, to, label] = useMemo(
    () => bounds(period, year, month),
    [period, year, month]
  );

  const load = useCallback(async () => {
    try {
      const [d, s, l] = await Promise.all([
        listDoctors(),
        listShiftsBetween(from, to),
        listLeavesBetween(from, to),
      ]);
      setDoctors(d);
      setShifts(s);
      setLeaves(l);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }, [from, to]);

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
        return {
          doctor,
          fridays: c.fridays,
          saturdays: c.saturdays,
          sundays: c.sundays,
          weekendHours: c.weekendHours,
          totalHours: c.totalHours,
          annualDays: lv.annualDays,
          trainingHours: lv.trainingHours,
        };
      })
      .sort(
        (a, b) =>
          b.totalHours - a.totalHours || a.doctor.name.localeCompare(b.doctor.name)
      );
  }, [doctors, shifts, leaves]);

  function shiftPeriod(delta: number) {
    if (period === 'year') {
      setYear(y => y + delta);
    } else if (period === 'quadri') {
      const dt = new Date(year, Math.floor(month / 4) * 4 + delta * 4, 1);
      setYear(dt.getFullYear());
      setMonth(dt.getMonth());
    } else {
      const dt = new Date(year, month + delta, 1);
      setYear(dt.getFullYear());
      setMonth(dt.getMonth());
    }
  }

  function exportCsv() {
    const header = [
      'Médecin',
      'Vendredis',
      'Samedis',
      'Dimanches',
      'Heures WE',
      'Heures totales',
      'Congés (j)',
      'Formation (h)',
    ];
    const lines = rows.map(r =>
      [
        r.doctor.name,
        r.fridays,
        r.saturdays,
        r.sundays,
        r.weekendHours,
        r.totalHours,
        r.annualDays,
        r.trainingHours,
      ]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(';')
    );
    const csv = '﻿' + [header.join(';'), ...lines].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compteurs-${label.replace(/\s+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <FullScreenSpinner label="Chargement…" />;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 px-3 py-4 sm:px-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <Users className="size-5 text-teal-600" /> Compteurs de l'équipe
        </h1>

        <div className="ml-auto flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-xs font-medium dark:bg-slate-800">
          {(['month', 'quadri', 'year'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-md px-2 py-1 transition ${period === p ? 'bg-white shadow-sm dark:bg-slate-700' : 'text-slate-500'}`}
            >
              {p === 'month' ? 'Mois' : p === 'quadri' ? 'Quadrimestre' : 'Année'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
          <button
            onClick={() => shiftPeriod(-1)}
            className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Précédent"
          >
            <ChevronLeft className="size-5" />
          </button>
          <span className="min-w-24 text-center text-sm font-semibold capitalize">
            {label}
          </span>
          <button
            onClick={() => shiftPeriod(1)}
            className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Suivant"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>

        <button
          onClick={exportCsv}
          className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
        >
          <Download className="size-4" /> CSV
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400 dark:border-slate-800">
              <th className="px-3 py-2 font-semibold">Médecin</th>
              <Th>Ven</Th>
              <Th>Sam</Th>
              <Th>Dim</Th>
              <Th>h WE</Th>
              <Th>h Total</Th>
              <Th>Congés</Th>
              <Th>Format.</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr
                key={r.doctor.id}
                className="border-b border-slate-50 last:border-0 dark:border-slate-800/60"
              >
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: r.doctor.color }}
                    />
                    <span className="truncate font-medium">{r.doctor.name}</span>
                  </span>
                </td>
                <Td>{r.fridays}</Td>
                <Td>{r.saturdays}</Td>
                <Td>{r.sundays}</Td>
                <Td strong>{r.weekendHours} h</Td>
                <Td strong>{r.totalHours} h</Td>
                <Td>{r.annualDays} j</Td>
                <Td>{r.trainingHours} h</Td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-slate-400">
                  Aucun médecin.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">
        Heures WE = créneaux du vendredi, samedi et dimanche. Période : {label}.
      </p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-2 py-2 text-right font-semibold">{children}</th>;
}
function Td({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <td
      className={`px-2 py-2 text-right tabular-nums ${strong ? 'font-semibold text-teal-700 dark:text-teal-300' : ''}`}
    >
      {children}
    </td>
  );
}
