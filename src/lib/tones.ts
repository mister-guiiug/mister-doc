/**
 * Tons de couleur des « chips » (badges, pastilles) du design system — source
 * unique, cohérente en clair ET en sombre. Évite la duplication des maps de
 * classes Tailwind éparpillées dans les composants (`Counters`, `MyPlanningView`,
 * `ShiftTypesCard`…). Chaque ton = bordure + fond teinté + texte lisible.
 */
export type Tone =
  'neutral' | 'teal' | 'sky' | 'violet' | 'amber' | 'indigo' | 'red';

export const TONE_CLASSES: Record<Tone, string> = {
  neutral:
    'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200',
  teal: 'border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-200',
  sky: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200',
  violet:
    'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200',
  amber:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
  indigo:
    'border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200',
  red: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200',
};
