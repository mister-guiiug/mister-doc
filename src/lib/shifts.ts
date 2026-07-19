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
 * Types de créneaux (gardes) — désormais CONFIGURABLES (cf. table `shift_types`
 * + migration 0022). Le code n'impose plus la liste : elle est chargée au login
 * via {@link setShiftTypes}. Par défaut ({@link DEFAULT_SHIFT_TYPES}) le
 * comportement est identique à l'historique : S1J 10 h / S1N 15 h (nuit) /
 * S2J 8 h, plus S3 (heures non cliniques) conservé mais inactif.
 *
 * `ShiftType` est un simple `string` : la validité vient de la base (FK) et de
 * la config, plus d'une union figée à la compilation.
 */
export type ShiftType = string;

/** Définition d'un type de créneau (miroir front de `public.shift_types`). */
export interface ShiftTypeDef {
  code: ShiftType;
  label: string;
  /** Base horaire (compteurs, heures WE/totales, équité, .ics). */
  hours: number;
  /** Vrai ⇒ créneau à couvrir (colonne du planning). */
  clinical: boolean;
  /** Vrai ⇒ repos de sécurité le lendemain + compté comme « nuit ». */
  isNight: boolean;
  /** Vrai ⇒ requis aussi le samedi/dimanche/férié (sinon semaine seule). */
  weekend: boolean;
  /** Ordre d'affichage (colonnes de grille, PDF, dialogues). */
  sortOrder: number;
  /** Horaires pour le flux .ics (facultatifs). */
  startTime: string | null;
  endTime: string | null;
  /** 1 = le créneau se termine le lendemain (nuit). */
  endDayOffset: number;
  color: string | null;
  active: boolean;
}

/**
 * Configuration par défaut = comportement historique exact. Sert de repli tant
 * que la config n'est pas chargée depuis la base, et de valeur de référence des
 * tests. Doit rester alignée avec le seed de la migration 0022.
 */
export const DEFAULT_SHIFT_TYPES: readonly ShiftTypeDef[] = [
  { code: 'S1J', label: 'S1 Jour', hours: 10, clinical: true, isNight: false, weekend: true, sortOrder: 0, startTime: '08:00', endTime: '18:00', endDayOffset: 0, color: null, active: true },
  { code: 'S1N', label: 'S1 Nuit', hours: 15, clinical: true, isNight: true, weekend: true, sortOrder: 1, startTime: '18:00', endTime: '09:00', endDayOffset: 1, color: null, active: true },
  { code: 'S2J', label: 'S2 Jour', hours: 8, clinical: true, isNight: false, weekend: false, sortOrder: 2, startTime: '08:00', endTime: '16:00', endDayOffset: 0, color: null, active: true },
  { code: 'S3', label: 'Heures non cliniques', hours: 8, clinical: false, isNight: false, weekend: false, sortOrder: 3, startTime: null, endTime: null, endDayOffset: 0, color: null, active: false },
];

// ---------------------------- État de module ----------------------------
// Petit registre mutable rafraîchi une fois au login (cohérent avec
// `setIncludePentecote` de dates.ts). Les vues abonnées à `shift_types`
// (Realtime) peuvent le rafraîchir à chaud.

let current: ShiftTypeDef[] = sortDefs(DEFAULT_SHIFT_TYPES);
let byCode: Map<ShiftType, ShiftTypeDef> = index(current);

function sortDefs(defs: readonly ShiftTypeDef[]): ShiftTypeDef[] {
  return [...defs].sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
}
function index(defs: ShiftTypeDef[]): Map<ShiftType, ShiftTypeDef> {
  return new Map(defs.map(d => [d.code, d]));
}

/**
 * Remplace la configuration des types de créneaux (au login, ou sur événement
 * Realtime). Une liste vide est ignorée (on conserve les défauts) pour ne
 * jamais rendre le planning inutilisable sur une base incomplète.
 */
export function setShiftTypes(defs: readonly ShiftTypeDef[]): void {
  if (!defs || defs.length === 0) return;
  current = sortDefs(defs);
  byCode = index(current);
}

/** Configuration courante, triée par ordre d'affichage. */
export function getShiftTypes(): readonly ShiftTypeDef[] {
  return current;
}

/** Définition d'un code (ou `undefined` si inconnu). */
export function shiftDef(code: ShiftType): ShiftTypeDef | undefined {
  return byCode.get(code);
}

/** Libellé lisible d'un créneau (repli sur le code si inconnu). */
export function shiftLabel(code: ShiftType): string {
  return byCode.get(code)?.label ?? code;
}

/** Base horaire d'un créneau (0 si inconnu). */
export function shiftHours(code: ShiftType): number {
  return byCode.get(code)?.hours ?? 0;
}

/** Vrai si le créneau est une garde de NUIT (repos de sécurité, compteur nuits). */
export function isNightShift(code: ShiftType): boolean {
  return byCode.get(code)?.isNight ?? false;
}

/** Codes cliniques actifs, dans l'ordre d'affichage. */
export function clinicalShiftTypes(): ShiftType[] {
  return current.filter(d => d.active && d.clinical).map(d => d.code);
}

export function isShiftType(v: string): boolean {
  return byCode.has(v);
}

/**
 * Créneaux cliniques à couvrir pour une date donnée : tous les cliniques actifs
 * en semaine ; seulement ceux marqués « week-end » le samedi, le dimanche et les
 * jours fériés (couverture réduite). Les heures non cliniques (S3) ne font pas
 * partie de la couverture.
 */
export function activeShiftTypes(date: Date): ShiftType[] {
  const reduced = isSatSun(date) || isHoliday(date);
  return current
    .filter(d => d.active && d.clinical && (reduced ? d.weekend : true))
    .map(d => d.code);
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
    const h = shiftHours(s.shift_type);
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
