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
/** Week-end « métier » = vendredi, samedi ou dimanche (cf. colonne VSD du sheet). */
export function isWeekend(d: Date): boolean {
  const g = d.getDay();
  return g === 5 || g === 6 || g === 0;
}

/**
 * Numéro de semaine ISO 8601 (les semaines commencent le lundi ; la semaine 1
 * est celle contenant le premier jeudi de l'année).
 */
export function isoWeek(d: Date): number {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // Jeudi de la semaine courante : détermine l'année ISO.
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
  weekend: boolean;
}

/** Liste ordonnée des jours d'un mois donné (année, mois 0-indexé). */
export function monthDays(year: number, month: number): MonthDay[] {
  const days: MonthDay[] = [];
  const cursor = new Date(year, month, 1);
  while (cursor.getMonth() === month) {
    days.push({
      date: new Date(cursor),
      iso: toISODate(cursor),
      weekday: mondayIndex(cursor),
      week: isoWeek(cursor),
      weekend: isWeekend(cursor),
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
