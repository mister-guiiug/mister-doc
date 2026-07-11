/**
 * Utilitaires de dates, sans dépendance externe. Toutes les dates « métier »
 * sont manipulées en heure locale et sérialisées au format ISO `YYYY-MM-DD`
 * (clé stable, indépendante du fuseau).
 */

export const WEEKDAY_LABELS = [
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
  'Dimanche',
] as const;

export const WEEKDAY_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;

export const MONTH_LABELS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
] as const;

/** Clé ISO locale `YYYY-MM-DD` (sans décalage de fuseau). */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse une clé `YYYY-MM-DD` en Date locale (minuit local). */
export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Jour de la semaine « lundi = 0 … dimanche = 6 ». */
export function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function isFriday(d: Date): boolean {
  return d.getDay() === 5;
}
export function isSaturday(d: Date): boolean {
  return d.getDay() === 6;
}
export function isSunday(d: Date): boolean {
  return d.getDay() === 0;
}
/** Samedi ou dimanche (week-end « calendaire », couverture réduite). */
export function isSatSun(d: Date): boolean {
  const g = d.getDay();
  return g === 0 || g === 6;
}
/** Vendredi, samedi ou dimanche — base des compteurs week-end (colonne VSD). */
export function isVsd(d: Date): boolean {
  const g = d.getDay();
  return g === 5 || g === 6 || g === 0;
}

// ----------------------------- Jours fériés -----------------------------

/** Dimanche de Pâques (algorithme grégorien anonyme / Meeus). */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = mars, 4 = avril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const holidayCache = new Map<number, Map<string, string>>();

/** Jours fériés France métropole pour une année, indexés par clé ISO. */
export function frenchHolidays(year: number): Map<string, string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;
  const easter = easterSunday(year);
  const m = new Map<string, string>();
  const add = (d: Date, name: string) => m.set(toISODate(d), name);
  add(new Date(year, 0, 1), "Jour de l'An");
  add(addDays(easter, 1), 'Lundi de Pâques');
  add(new Date(year, 4, 1), 'Fête du Travail');
  add(new Date(year, 4, 8), 'Victoire 1945');
  add(addDays(easter, 39), 'Ascension');
  add(addDays(easter, 50), 'Lundi de Pentecôte');
  add(new Date(year, 6, 14), 'Fête nationale');
  add(new Date(year, 7, 15), 'Assomption');
  add(new Date(year, 10, 1), 'Toussaint');
  add(new Date(year, 10, 11), 'Armistice 1918');
  add(new Date(year, 11, 25), 'Noël');
  holidayCache.set(year, m);
  return m;
}

export function holidayName(d: Date): string | null {
  return frenchHolidays(d.getFullYear()).get(toISODate(d)) ?? null;
}
export function isHoliday(d: Date): boolean {
  return frenchHolidays(d.getFullYear()).has(toISODate(d));
}

// ------------------------------ Mois / semaines ------------------------------

/**
 * Numéro de semaine ISO 8601 (les semaines commencent le lundi ; la semaine 1
 * est celle contenant le premier jeudi de l'année).
 */
export function isoWeek(d: Date): number {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day + 3);
  const firstThursday = new Date(date.getFullYear(), 0, 4);
  const firstDay = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDay + 3);
  const diff = date.getTime() - firstThursday.getTime();
  return 1 + Math.round(diff / (7 * 24 * 3600 * 1000));
}

export interface MonthDay {
  date: Date;
  iso: string;
  weekday: number; // 0 = lundi … 6 = dimanche
  week: number; // numéro de semaine ISO
  weekend: boolean; // samedi ou dimanche
  holiday: boolean;
  holidayName: string | null;
  /** Couverture réduite (S1J/S1N seulement) : week-end OU jour férié. */
  reduced: boolean;
}

/** Liste ordonnée des jours d'un mois donné (année, mois 0-indexé). */
export function monthDays(year: number, month: number): MonthDay[] {
  const days: MonthDay[] = [];
  const holidays = frenchHolidays(year);
  const cursor = new Date(year, month, 1);
  while (cursor.getMonth() === month) {
    const iso = toISODate(cursor);
    const hName = holidays.get(iso) ?? null;
    const weekend = isSatSun(cursor);
    days.push({
      date: new Date(cursor),
      iso,
      weekday: mondayIndex(cursor),
      week: isoWeek(cursor),
      weekend,
      holiday: hName !== null,
      holidayName: hName,
      reduced: weekend || hName !== null,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

/** Groupe les jours d'un mois par numéro de semaine ISO (ordre chronologique). */
export function weeksOfMonth(
  year: number,
  month: number
): { week: number; days: MonthDay[] }[] {
  const groups: { week: number; days: MonthDay[] }[] = [];
  for (const day of monthDays(year, month)) {
    const last = groups[groups.length - 1];
    if (last && last.week === day.week) last.days.push(day);
    else groups.push({ week: day.week, days: [day] });
  }
  return groups;
}

export function monthLabel(year: number, month: number): string {
  return `${MONTH_LABELS[month]} ${year}`;
}
