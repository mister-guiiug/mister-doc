import { fromISODate, isFriday, isSaturday, isSunday, isWeekend } from './dates.ts';

/**
 * Créneaux de garde et leur base horaire (donnée par le métier) :
 *   S1J = 10 h (jour), S1N = 15 h (nuit), S2J = 8 h, S3 = 8 h.
 */
export const SHIFT_TYPES = ['S1J', 'S1N', 'S2J', 'S3'] as const;
export type ShiftType = (typeof SHIFT_TYPES)[number];

export const SHIFT_HOURS: Record<ShiftType, number> = {
  S1J: 10,
  S1N: 15,
  S2J: 8,
  S3: 8,
};

export const SHIFT_LABEL: Record<ShiftType, string> = {
  S1J: 'S1 Jour',
  S1N: 'S1 Nuit',
  S2J: 'S2 Jour',
  S3: 'S3',
};

/** Créneau « principal » qui doit être couvert chaque jour (1 médecin/jour). */
export const PRIMARY_SHIFT: ShiftType = 'S1J';

export function isShiftType(v: string): v is ShiftType {
  return (SHIFT_TYPES as readonly string[]).includes(v);
}

/** Une affectation minimale nécessaire au calcul des compteurs. */
export interface CountableShift {
  work_date: string; // YYYY-MM-DD
  shift_type: ShiftType;
}

export interface DoctorCounters {
  fridays: number;
  saturdays: number;
  sundays: number;
  weekendHours: number;
  totalHours: number;
  shiftCount: number;
}

/**
 * Compteurs pour un médecin sur un ensemble d'affectations (typiquement le mois
 * affiché) :
 *  - vendredis/samedis/dimanches = nombre de JOURS distincts de garde ;
 *  - heures week-end = somme des heures des créneaux tombant un ven/sam/dim ;
 *  - heures totales = somme de toutes les heures.
 */
export function computeCounters(shifts: CountableShift[]): DoctorCounters {
  const fri = new Set<string>();
  const sat = new Set<string>();
  const sun = new Set<string>();
  let weekendHours = 0;
  let totalHours = 0;

  for (const s of shifts) {
    const d = fromISODate(s.work_date);
    const h = SHIFT_HOURS[s.shift_type] ?? 0;
    totalHours += h;
    if (isWeekend(d)) weekendHours += h;
    if (isFriday(d)) fri.add(s.work_date);
    if (isSaturday(d)) sat.add(s.work_date);
    if (isSunday(d)) sun.add(s.work_date);
  }

  return {
    fridays: fri.size,
    saturdays: sat.size,
    sundays: sun.size,
    weekendHours,
    totalHours,
    shiftCount: shifts.length,
  };
}
