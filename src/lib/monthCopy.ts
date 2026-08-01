import { addDays, monthDays, toISODate } from './dates.ts';
import { activeShiftTypes, type ShiftType } from './shifts.ts';

/** Repère de mois (mois 0-indexé, convention JS : 0 = janvier). */
export interface MonthRef {
  year: number;
  month: number;
}

/** Affectation minimale nécessaire au calcul d'une copie de mois. */
export interface CopyableShift {
  work_date: string; // YYYY-MM-DD
  shift_type: ShiftType;
  doctor_id: string;
}

/** Ligne prête à être insérée dans le mois cible. */
export interface MonthCopyRow {
  work_date: string; // YYYY-MM-DD
  shift_type: ShiftType;
  doctor_id: string;
}

/** Plan de copie : ce qui sera écrit, et le décompte de ce qui est écarté. */
export interface MonthCopyPlan {
  /** Gardes à créer, dans l'ordre chronologique. */
  rows: MonthCopyRow[];
  /** Écartées : la date projetée tombe hors du mois cible (fin de mois). */
  skippedOutside: number;
  /** Écartées : le créneau n'est pas à couvrir ce jour-là (week-end, férié…). */
  skippedInactive: number;
  /** Écartées : le créneau est déjà attribué dans le mois cible. */
  skippedOccupied: number;
}

/** Clé d'un créneau (une seule affectation par date et par type). */
function slotKey(iso: string, shiftType: ShiftType): string {
  return `${iso}|${shiftType}`;
}

/**
 * Calcule la reprise des gardes d'un mois vers un autre, SANS rien écrire :
 * l'appelant affiche le récapitulatif, l'utilisateur confirme, puis les `rows`
 * partent en un seul lot.
 *
 * Alignement sur le JOUR DE SEMAINE, pas sur le quantième : les rotations sont
 * hebdomadaires, un mardi doit rester un mardi. Le 1er du mois source se
 * projette donc sur l'ANCRE = le premier jour du mois cible ayant le même jour
 * de semaine, et le jour d'index `i` du mois source sur « ancre + i jours ».
 * Ce décalage constant décale mécaniquement les 3–4 derniers jours du mois
 * source hors du mois cible : c'est attendu (`skippedOutside`).
 *
 * Trois motifs écartent une date, sans bloquer les autres :
 *  - la date projetée sort du mois cible ;
 *  - le créneau n'est pas à couvrir ce jour-là ({@link activeShiftTypes} gère
 *    week-ends, jours fériés et créneaux désactivés ou reconfigurés) ;
 *  - le créneau est DÉJÀ attribué dans le mois cible — on n'écrase jamais.
 *
 * Fonction pure et testable : ni accès réseau, ni dépendance à `backend/`. Les
 * gardes du mois cible sont fournies par l'appelant plutôt que relues ici.
 */
export function planMonthCopy(
  sourceShifts: readonly CopyableShift[],
  source: MonthRef,
  target: MonthRef,
  targetShifts: readonly { work_date: string; shift_type: ShiftType }[]
): MonthCopyPlan {
  const plan: MonthCopyPlan = {
    rows: [],
    skippedOutside: 0,
    skippedInactive: 0,
    skippedOccupied: 0,
  };

  const sourceDays = monthDays(source.year, source.month);
  const targetDays = monthDays(target.year, target.month);
  const firstSource = sourceDays[0];
  const anchor = firstSource
    ? targetDays.find(d => d.weekday === firstSource.weekday)
    : undefined;
  // Sans ancre (repère de mois invalide, donc mois vide) aucune date n'a
  // d'image : tout est « hors du mois cible ».
  if (!anchor) {
    plan.skippedOutside = sourceShifts.length;
    return plan;
  }

  // Position (0-indexée) de chaque jour dans le mois source : c'est elle, et
  // non le quantième, qui donne la date cible (`ancre + index`).
  const indexByIso = new Map(sourceDays.map((d, i) => [d.iso, i]));
  const isoInTarget = new Set(targetDays.map(d => d.iso));
  // Créneaux à ne pas toucher. Les lignes déjà planifiées y sont ajoutées au
  // fil de l'eau : deux gardes source identiques ne produiraient pas deux
  // insertions sur le même créneau.
  const occupied = new Set(
    targetShifts.map(s => slotKey(s.work_date, s.shift_type))
  );

  // Ordre chronologique stable : le récapitulatif et le lot écrit se lisent
  // dans l'ordre du calendrier, quel que soit l'ordre des lignes reçues.
  const ordered = [...sourceShifts].sort(
    (a, b) =>
      a.work_date.localeCompare(b.work_date) ||
      a.shift_type.localeCompare(b.shift_type)
  );

  for (const s of ordered) {
    const index = indexByIso.get(s.work_date);
    // Date hors du mois source (l'appelant ne devrait pas en fournir) : pas
    // d'image dans le mois cible non plus.
    if (index === undefined) {
      plan.skippedOutside++;
      continue;
    }
    const date = addDays(anchor.date, index);
    const iso = toISODate(date);
    if (!isoInTarget.has(iso)) {
      plan.skippedOutside++;
      continue;
    }
    if (!activeShiftTypes(date).includes(s.shift_type)) {
      plan.skippedInactive++;
      continue;
    }
    const key = slotKey(iso, s.shift_type);
    if (occupied.has(key)) {
      plan.skippedOccupied++;
      continue;
    }
    occupied.add(key);
    plan.rows.push({
      work_date: iso,
      shift_type: s.shift_type,
      doctor_id: s.doctor_id,
    });
  }

  return plan;
}
