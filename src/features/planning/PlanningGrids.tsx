import { MonthGrid } from './MonthGrid.tsx';
import { MonthCalendarGrid } from './MonthCalendarGrid.tsx';
import type { PlanningGridProps } from './gridTypes.ts';

interface PlanningGridsProps extends PlanningGridProps {
  /** Vrai pour la grille 7 colonnes (desktop), faux pour la liste. */
  calendar: boolean;
}

/**
 * Choisit le rendu du mois selon le mode d'affichage. Les deux grilles
 * partagent exactement les mêmes props (`PlanningGridProps`) : ce sélecteur
 * évite de les dupliquer dans `PlanningView`.
 */
export function PlanningGrids({ calendar, ...grid }: PlanningGridsProps) {
  return calendar ? <MonthCalendarGrid {...grid} /> : <MonthGrid {...grid} />;
}
