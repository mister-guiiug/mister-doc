import { addDays, fromISODate, toISODate } from './dates.ts';
import { activeShiftTypes, type ShiftType } from './shifts.ts';

/** Résultat de l'étalement d'un créneau sur plusieurs semaines. */
export interface RepeatPlan {
  /** Dates ISO réellement affectables, dans l'ordre chronologique. */
  dates: string[];
  /** Dates écartées parce que le créneau n'est pas à couvrir ce jour-là. */
  skippedInactive: number;
  /** Dates écartées parce que leur mois est verrouillé. */
  skippedLocked: number;
}

/**
 * Étale un créneau sur `weeks` semaines : le jour choisi, puis les mêmes jours
 * de semaine suivants (J+7, J+14, J+21). Deux motifs écartent une date, sans
 * empêcher les autres d'être affectées :
 *  - le créneau n'est pas à couvrir ce jour-là ({@link activeShiftTypes} gère
 *    week-ends, jours fériés et créneaux désactivés ou reconfigurés) ;
 *  - le mois de la date est verrouillé — la répétition peut déborder sur le
 *    mois suivant, regarder le seul mois affiché ne suffit donc pas.
 *
 * Le verrou est fourni par l'appelant (`isLockedMonth`, mois 0-indexé façon JS)
 * plutôt que lu ici : cette fonction reste pure et testable, et `lib/` n'a pas
 * à dépendre de la couche d'accès aux données.
 */
export function planWeeklyRepeat(
  iso: string,
  shiftType: ShiftType,
  weeks: number,
  isLockedMonth: (year: number, month: number) => boolean
): RepeatPlan {
  const start = fromISODate(iso);
  const plan: RepeatPlan = { dates: [], skippedInactive: 0, skippedLocked: 0 };
  for (let i = 0; i < Math.max(1, weeks); i++) {
    const day = addDays(start, i * 7);
    if (!activeShiftTypes(day).includes(shiftType)) plan.skippedInactive++;
    else if (isLockedMonth(day.getFullYear(), day.getMonth()))
      plan.skippedLocked++;
    else plan.dates.push(toISODate(day));
  }
  return plan;
}
