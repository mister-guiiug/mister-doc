import { History } from 'lucide-react';
import { shiftLabel } from '../../lib/shifts.ts';
import { useI18n } from '../../i18n/index.ts';
import type { SwapRequest } from '../../backend/types.ts';
import { SwapSection } from './SwapSection.tsx';
import { useSwapDateLabels } from './SwapDateLabels.ts';

/**
 * Historique des propositions résolues (acceptées / déclinées / annulées).
 * Lecture seule : aucune action, donc aucun besoin de l'état `busy` du parent.
 */
export function SwapHistory({
  resolved,
  nameById,
}: {
  resolved: SwapRequest[];
  nameById: ReadonlyMap<string, string>;
}) {
  const { t } = useI18n();
  const { dayLabel } = useSwapDateLabels();

  return (
    <SwapSection
      title={t('swaps.history')}
      count={resolved.length}
      icon={<History className="size-4 text-slate-400" />}
    >
      <ul className="flex flex-col gap-1.5">
        {resolved.map(s => (
          <li
            key={s.id}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 text-sm dark:border-slate-800/60"
          >
            <span className="min-w-0 flex-1">
              <span className="capitalize">{dayLabel(s.work_date)}</span> ·{' '}
              {shiftLabel(s.shift_type)}
              <span className="text-xs text-slate-400">
                {' '}
                — {nameById.get(s.from_doctor) ?? '?'} →{' '}
                {s.to_doctor
                  ? (nameById.get(s.to_doctor) ?? '?')
                  : t('swaps.allTarget')}
              </span>
            </span>
            <StatusBadge status={s.status} />
          </li>
        ))}
      </ul>
    </SwapSection>
  );
}

/** Pastille de statut : couleur et libellé dérivés du statut brut. */
function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const cls =
    status === 'accepted'
      ? 'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-300'
      : status === 'declined'
        ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
        : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400';
  const label =
    status === 'accepted'
      ? t('swaps.statusAccepted')
      : status === 'declined'
        ? t('swaps.statusDeclined')
        : status === 'cancelled'
          ? t('swaps.statusCancelled')
          : status;
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {label}
    </span>
  );
}
