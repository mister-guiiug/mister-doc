import {
  fromISODate,
  isFriday,
  isSaturday,
  isSunday,
  isVsd,
  isSatSun,
  isHoliday,
} from './dates.ts';

/**
 * Créneaux de garde CLINIQUES et leur base horaire (donnée par le métier) :
 *   S1J = 10 h (jour), S1N = 15 h (nuit), S2J = 8 h.
 * (« S3 » est conservé dans le type pour la compatibilité, mais n'est plus un
 * créneau clinique : ce sont désormais des Heures Non Cliniques — cf. lib/hnc.ts.)
 */
export const SHIFT_TYPES = ['S1J', 'S1N', 'S2J', 'S3'] as const;
export type ShiftType = (typeof SHIFT_TYPES)[number];

/** Créneaux cliniques réellement affectables (occupant unique, à couvrir). */
export const CLINICAL_SHIFT_TYPES: readonly ShiftType[] = ['S1J', 'S1N', 'S2J'];

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
  S3: 'Heures non cliniques',
};

/** Créneau « principal » présent tous les jours. */
export const PRIMARY_SHIFT: ShiftType = 'S1J';

/** Créneaux cliniques actifs le week-end et les jours fériés (couverture réduite). */
export const WEEKEND_SHIFT_TYPES: readonly ShiftType[] = ['S1J', 'S1N'];

export function isShiftType(v: string): v is ShiftType {
  return (SHIFT_TYPES as readonly string[]).includes(v);
}

/**
 * Créneaux cliniques à couvrir pour une date donnée : S1J/S1N/S2J en semaine,
 * seulement S1J/S1N le samedi, le dimanche et les jours fériés. (Les heures non
 * cliniques ne font pas partie de la couverture et se saisissent tous les jours.)
 */
export function activeShiftTypes(date: Date): readonly ShiftType[] {
  return isSatSun(date) || isHoliday(date)
    ? WEEKEND_SHIFT_TYPES
    : CLINICAL_SHIFT_TYPES;
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
    if (isVsd(d)) weekendHours += h;
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
