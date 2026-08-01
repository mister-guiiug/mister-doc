import { ArrowRight } from 'lucide-react';
import { shiftLabel } from '../../lib/shifts.ts';
import { useI18n } from '../../i18n/index.ts';
import type { SwapRequest } from '../../backend/types.ts';
import { useSwapDateLabels } from './SwapDateLabels.ts';

/**
 * Ligne d'une proposition d'échange (garde, date, émetteur → destinataire).
 * Les boutons sont injectés via `actions` : l'état `busy` et les appels
 * `backend/swaps.ts` restent pilotés par SwapBoard. `nameById` est passé
 * explicitement car la résolution des noms dépend de la liste des médecins
 * chargée par le parent.
 */
export function SwapItem({
  swap,
  nameById,
  actions,
}: {
  swap: SwapRequest;
  nameById: ReadonlyMap<string, string>;
  actions: React.ReactNode;
}) {
  const { t } = useI18n();
  const { dayLabel, relativeDay } = useSwapDateLabels();

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {shiftLabel(swap.shift_type)} ·{' '}
          <span className="capitalize">{dayLabel(swap.work_date)}</span>
          <span className="ml-1 font-normal text-slate-400">
            · {relativeDay(swap.work_date)}
          </span>
        </p>
        <p className="flex items-center gap-1 text-xs text-slate-500">
          {nameById.get(swap.from_doctor) ?? '?'}
          <ArrowRight className="size-3" />
          {swap.to_doctor
            ? (nameById.get(swap.to_doctor) ?? '?')
            : t('swaps.openTarget')}
        </p>
        {swap.message && (
          <p className="mt-0.5 truncate text-xs italic text-slate-400">
            « {swap.message} »
          </p>
        )}
      </div>
      <div className="flex items-center gap-1">{actions}</div>
    </li>
  );
}
