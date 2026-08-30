import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { monthBounds } from '../../lib/dates.ts';
import { planMonthCopy, type MonthCopyRow } from '../../lib/monthCopy.ts';
import { listShiftsBetween } from '../../backend/planning.ts';
import type { Shift } from '../../backend/types.ts';
import { Sheet } from '@mister-guiiug/dev-wpa-config/react/sheet';
import { Button } from '@mister-guiiug/dev-wpa-config/react/button';
import { useI18n } from '../../i18n/index.ts';

/**
 * Confirmation de la reprise des gardes du mois précédent. Le dialogue charge
 * lui-même le mois source (il n'est pas dans les données du planning) puis
 * affiche le RÉCAPITULATIF calculé par `planMonthCopy` : combien de gardes
 * seront créées, combien sont écartées et pourquoi. Rien n'est écrit tant que
 * l'utilisateur n'a pas confirmé.
 */
export function CopyMonthDialog({
  year,
  month,
  targetShifts,
  onConfirm,
  onClose,
}: {
  /** Mois cible = mois affiché (mois 0-indexé). */
  year: number;
  month: number;
  /** Gardes déjà présentes dans le mois cible (jamais écrasées). */
  targetShifts: Shift[];
  onConfirm: (rows: MonthCopyRow[]) => Promise<void>;
  onClose: () => void;
}) {
  const { t, m } = useI18n();
  const [sourceShifts, setSourceShifts] = useState<Shift[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Mois précédent : `new Date` gère seul la bascule d'année (janvier → –1).
  const source = useMemo(() => {
    const d = new Date(year, month - 1, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  }, [year, month]);
  const sourceLabel = `${m.common.months[source.month]} ${source.year}`;
  const targetLabel = `${m.common.months[month]} ${year}`;

  // Chargement à la demande (à l'ouverture) : le mois précédent n'est pas
  // chargé avec le planning, inutile de le payer à chaque affichage de page.
  useEffect(() => {
    let alive = true;
    const [from, to] = monthBounds(source.year, source.month);
    listShiftsBetween(from, to)
      .then(s => {
        if (alive) setSourceShifts(s);
      })
      .catch(() => {
        if (alive) setError(t('copyMonth.loadError', { source: sourceLabel }));
      });
    return () => {
      alive = false;
    };
  }, [source, sourceLabel, t]);

  const plan = useMemo(
    () =>
      sourceShifts
        ? planMonthCopy(sourceShifts, source, { year, month }, targetShifts)
        : null,
    [sourceShifts, source, year, month, targetShifts]
  );

  async function handleConfirm() {
    if (!plan || plan.rows.length === 0) return;
    setBusy(true);
    try {
      await onConfirm(plan.rows);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const skipped = plan
    ? [
        plan.skippedOutside > 0 &&
          t('copyMonth.skippedOutside', {
            n: plan.skippedOutside,
            target: targetLabel,
          }),
        plan.skippedInactive > 0 &&
          t('copyMonth.skippedInactive', { n: plan.skippedInactive }),
        plan.skippedOccupied > 0 &&
          t('copyMonth.skippedOccupied', { n: plan.skippedOccupied }),
      ].filter((s): s is string => typeof s === 'string')
    : [];

  return (
    <Sheet
      open
      onClose={onClose}
      title={t('copyMonth.title')}
      closeLabel={t('common.close')}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            loading={busy}
            disabled={!plan || plan.rows.length === 0}
            onClick={() => void handleConfirm()}
          >
            {t('copyMonth.confirm')}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
        {t('copyMonth.intro', { source: sourceLabel, target: targetLabel })}
      </p>

      {error && (
        <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {!error && !plan && (
        <p className="mb-3 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 className="size-4 animate-spin text-teal-600" />
          {t('copyMonth.loading', { source: sourceLabel })}
        </p>
      )}

      {plan && (
        <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/50">
          {sourceShifts?.length === 0 ? (
            <p className="text-slate-600 dark:text-slate-300">
              {t('copyMonth.emptySource', { source: sourceLabel })}
            </p>
          ) : (
            <p className="font-medium text-teal-700 dark:text-teal-300">
              {plan.rows.length > 0
                ? t('copyMonth.willCreate', { n: plan.rows.length })
                : t('copyMonth.nothingToCreate')}
            </p>
          )}
          {skipped.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-500 dark:text-slate-400">
              {skipped.map(s => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="text-xs text-slate-400 dark:text-slate-500">
        {t('copyMonth.note')}
      </p>
    </Sheet>
  );
}
