import { fromISODate, isSatSun, isHoliday } from './dates.ts';
import { shiftHours, isNightShift, type ShiftType } from './shifts.ts';

/**
 * Équité de répartition des gardes : compare la « charge pénible » de chaque
 * médecin sur une période (week-ends, nuits, jours fériés, heures cliniques).
 * Sert à repérer d'un coup d'œil les déséquilibres et à défendre un planning.
 */

/** Affectation clinique minimale nécessaire au calcul. */
export interface EquityShift {
  doctor_id: string;
  work_date: string; // YYYY-MM-DD
  shift_type: ShiftType;
}

export interface EquityDoctor {
  id: string;
  name: string;
  color?: string;
}

export type EquityMetricKey =
  | 'weekendDays'
  | 'nights'
  | 'holidays'
  | 'totalHours';

/** Indicateurs de pénibilité, dans l'ordre d'affichage. */
export const EQUITY_METRICS: {
  key: EquityMetricKey;
  label: string;
  short: string;
}[] = [
  { key: 'weekendDays', label: 'Jours de week-end', short: 'WE' },
  { key: 'nights', label: 'Nuits', short: 'Nuits' },
  { key: 'holidays', label: 'Jours fériés', short: 'Fériés' },
  { key: 'totalHours', label: 'Heures cliniques', short: 'Heures' },
];

export interface EquityRow {
  doctorId: string;
  name: string;
  color?: string;
  /** Jours DISTINCTS de garde tombant un samedi/dimanche. */
  weekendDays: number;
  /** Nombre de gardes de nuit (types marqués « nuit »). */
  nights: number;
  /** Jours DISTINCTS de garde tombant un jour férié. */
  holidays: number;
  /** Heures cliniques (somme des bases horaires). */
  totalHours: number;
}

export interface EquityReport {
  rows: EquityRow[];
  mean: Record<EquityMetricKey, number>;
  max: Record<EquityMetricKey, number>;
}

const KEYS: EquityMetricKey[] = EQUITY_METRICS.map(m => m.key);

/**
 * Calcule la charge comparée par médecin sur un ensemble de gardes cliniques,
 * plus la moyenne et le maximum par indicateur (pour situer chacun et mettre les
 * barres à l'échelle). Les médecins sans garde apparaissent avec des zéros.
 */
export function computeEquity(
  doctors: EquityDoctor[],
  shifts: EquityShift[]
): EquityReport {
  const byDoctor = new Map<string, EquityShift[]>();
  for (const s of shifts) {
    const bucket = byDoctor.get(s.doctor_id);
    if (bucket) bucket.push(s);
    else byDoctor.set(s.doctor_id, [s]);
  }

  const rows: EquityRow[] = doctors.map(d => {
    const mine = byDoctor.get(d.id) ?? [];
    const weekendDates = new Set<string>();
    const holidayDates = new Set<string>();
    let nights = 0;
    let totalHours = 0;
    for (const s of mine) {
      const date = fromISODate(s.work_date);
      totalHours += shiftHours(s.shift_type);
      if (isNightShift(s.shift_type)) nights += 1;
      if (isSatSun(date)) weekendDates.add(s.work_date);
      if (isHoliday(date)) holidayDates.add(s.work_date);
    }
    return {
      doctorId: d.id,
      name: d.name,
      color: d.color,
      weekendDays: weekendDates.size,
      nights,
      holidays: holidayDates.size,
      totalHours,
    };
  });

  const n = rows.length || 1;
  const mean = {} as Record<EquityMetricKey, number>;
  const max = {} as Record<EquityMetricKey, number>;
  for (const key of KEYS) {
    const values = rows.map(r => r[key]);
    mean[key] = values.reduce((a, b) => a + b, 0) / n;
    max[key] = Math.max(0, ...values);
  }

  return { rows, mean, max };
}
