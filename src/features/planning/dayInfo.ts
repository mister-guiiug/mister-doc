import type { MonthDay } from '../../lib/dates.ts';
import { activeShiftTypes, type ShiftType } from '../../lib/shifts.ts';
import type { Issue } from '../../lib/validation.ts';
import type { Shift, Wish, WishKind } from '../../backend/types.ts';

/**
 * Lecture métier d'une journée de planning, PARTAGÉE par les deux rendus
 * (`MonthGrid` en liste, `MonthCalendarGrid` en grille 7 colonnes). Ces deux
 * composants recalculaient à l'identique les créneaux à couvrir, les manquants,
 * l'atténuation d'un médecin filtré et le tri des vœux : toute correction
 * devait être faite deux fois. La logique vit désormais ici (fonction PURE,
 * donc testable sans rendu) ; les composants ne gardent que leur mise en page.
 */
export interface DayInfo {
  /** Créneaux cliniques à couvrir ce jour (selon la config des créneaux). */
  types: ShiftType[];
  /** Nombre de créneaux à couvrir encore sans médecin. */
  missing: number;
  /** Vrai si un médecin est filtré et que cette affectation n'est pas la sienne. */
  dim: (doctorId?: string) => boolean;
  /** Vœu du médecin connecté sur ce jour, s'il en a exprimé un. */
  myWish?: WishKind;
  /** Vœux « je préfère » des autres médecins. */
  prefers: Wish[];
  /** Vœux « j'évite » des autres médecins. */
  avoids: Wish[];
  /** Vrai si le jour porte au moins une anomalie bloquante. */
  hasError: boolean;
}

export function computeDayInfo({
  day,
  shiftIndex,
  issues,
  wishes,
  selfDoctorId,
  highlightId,
}: {
  day: MonthDay;
  shiftIndex: Map<string, Shift>;
  issues: Issue[];
  wishes: Wish[];
  selfDoctorId: string;
  highlightId: string | null;
}): DayInfo {
  const types = activeShiftTypes(day.date);
  return {
    types,
    missing: types.filter(ty => !shiftIndex.has(`${day.iso}|${ty}`)).length,
    dim: (doctorId?: string) => highlightId != null && doctorId !== highlightId,
    myWish: wishes.find(w => w.doctor_id === selfDoctorId)?.kind,
    prefers: wishes.filter(w => w.kind === 'prefer'),
    avoids: wishes.filter(w => w.kind === 'avoid'),
    hasError: issues.some(i => i.level === 'error'),
  };
}
