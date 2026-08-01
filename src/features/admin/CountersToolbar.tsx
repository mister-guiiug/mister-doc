import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { useI18n } from '../../i18n/index.ts';
import { SegmentedControl } from '../../components/ui/SegmentedControl.tsx';
import { CountersExportButtons } from './CountersExportButtons.tsx';
import type { CounterRow } from './countersExport.ts';

/** Période d'agrégation des compteurs. */
export type Period = 'month' | 'quadri' | 'year';

/** Vue active de l'écran des compteurs. */
export type CountersView = 'table' | 'equity';

interface CountersToolbarProps {
  view: CountersView;
  onViewChange: (view: CountersView) => void;
  period: Period;
  onPeriodChange: (period: Period) => void;
  /** Libellé de la période affichée (ex. « juillet 2026 »). */
  label: string;
  /** Décale la période affichée : -1 précédente, +1 suivante. */
  onShiftPeriod: (delta: number) => void;
  /** Lignes exportables ; les exports n'ont de sens qu'en vue Tableau. */
  exportRows: CounterRow[];
}

/**
 * Barre d'outils de l'écran « Compteurs de l'équipe » : bascule Tableau/Équité,
 * choix de la période, navigation d'une période à l'autre et exports.
 */
export function CountersToolbar({
  view,
  onViewChange,
  period,
  onPeriodChange,
  label,
  onShiftPeriod,
  exportRows,
}: CountersToolbarProps) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <h1 className="flex items-center gap-2 text-lg font-bold">
        <Users className="size-5 text-teal-600" /> {t('counters.team')}
      </h1>

      <SegmentedControl
        size="sm"
        ariaLabel={t('counters.viewAria')}
        value={view}
        onChange={onViewChange}
        options={[
          { value: 'table', label: t('counters.table') },
          { value: 'equity', label: t('counters.equity') },
        ]}
      />

      <SegmentedControl
        className="ml-auto"
        size="sm"
        ariaLabel={t('counters.periodAria')}
        value={period}
        onChange={onPeriodChange}
        options={[
          { value: 'month', label: t('counters.periodMonth') },
          { value: 'quadri', label: t('counters.periodQuad') },
          { value: 'year', label: t('counters.periodYear') },
        ]}
      />

      <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
        <button
          onClick={() => onShiftPeriod(-1)}
          className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label={t('common.previous')}
        >
          <ChevronLeft className="size-5" />
        </button>
        <span className="min-w-24 text-center text-sm font-semibold capitalize">
          {label}
        </span>
        <button
          onClick={() => onShiftPeriod(1)}
          className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label={t('common.next')}
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      {view === 'table' && (
        <CountersExportButtons rows={exportRows} label={label} />
      )}
    </div>
  );
}
