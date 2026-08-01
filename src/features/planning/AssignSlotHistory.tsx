import { useEffect, useMemo, useState } from 'react';
import { Loader2, History, ChevronDown, ChevronUp } from 'lucide-react';
import type { ShiftType } from '../../lib/shifts.ts';
import { useI18n } from '../../i18n/index.ts';
import type { Doctor, ShiftHistory } from '../../backend/types.ts';
import { listSlotHistory } from '../../backend/history.ts';
import { timeAgo } from '../../lib/relativeTime.ts';

interface AssignSlotHistoryProps {
  /** Jour du créneau (ISO `YYYY-MM-DD`). */
  iso: string;
  shiftType: ShiftType;
  /** Annuaire complet : sert à retrouver le nom des auteurs des changements. */
  doctors: Doctor[];
}

/**
 * Section repliable « historique des changements » du créneau.
 *
 * Bloc auto-suffisant : il porte lui-même son chargement (`listSlotHistory`),
 * son état d'ouverture et son index nom/médecin, car aucun autre morceau du
 * dialogue n'en dépend. Le conteneur reste monté en permanence (comme avant),
 * donc l'effet de chargement se déclenche à l'ouverture du dialogue.
 */
export function AssignSlotHistory({
  iso,
  shiftType,
  doctors,
}: AssignSlotHistoryProps) {
  const [history, setHistory] = useState<ShiftHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { t } = useI18n();

  const doctorsById = useMemo(
    () => new Map(doctors.map(doc => [doc.id, doc])),
    [doctors]
  );
  const nameOf = (id: string | null) =>
    id ? (doctorsById.get(id)?.name ?? t('assign.deletedAccount')) : '—';

  useEffect(() => {
    let alive = true;
    setLoadingHistory(true);
    listSlotHistory(iso, shiftType, 10)
      .then(h => alive && setHistory(h))
      .catch(() => {})
      .finally(() => alive && setLoadingHistory(false));
    return () => {
      alive = false;
    };
  }, [iso, shiftType]);

  return (
    <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800">
      <button
        type="button"
        onClick={() => setHistoryOpen(o => !o)}
        aria-expanded={historyOpen}
        className="flex w-full items-center gap-2 text-xs font-medium text-slate-500 transition hover:text-slate-700 dark:hover:text-slate-300"
      >
        <History className="size-3.5" />
        {t('assign.historyTitle')}
        {history.length > 0 && (
          <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800">
            {history.length}
          </span>
        )}
        {historyOpen ? (
          <ChevronUp className="ml-auto size-4" />
        ) : (
          <ChevronDown className="ml-auto size-4" />
        )}
      </button>
      {historyOpen && (
        <div className="mt-1.5">
          {loadingHistory ? (
            <p className="py-2 text-center text-slate-400">
              <Loader2 className="inline size-4 animate-spin" />
            </p>
          ) : history.length === 0 ? (
            <p className="py-1 text-xs text-slate-400">
              {t('assign.noHistory')}
            </p>
          ) : (
            <ul className="flex max-h-40 flex-col gap-1.5 overflow-y-auto pr-1">
              {history.map(h => (
                <li
                  key={h.id}
                  className="flex items-start gap-1.5 text-[11px] leading-tight"
                >
                  <span
                    className={`mt-1 inline-block size-1.5 shrink-0 rounded-full ${
                      h.action === 'removed'
                        ? 'bg-red-400'
                        : h.action === 'reassigned'
                          ? 'bg-amber-400'
                          : 'bg-teal-500'
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    {h.action === 'assigned' && (
                      <>
                        {h.changed_by
                          ? `${nameOf(h.changed_by)} ${t('assign.assignedTo')}`
                          : t('assign.assignedToShort')}
                        <span className="font-medium">
                          {nameOf(h.doctor_id)}
                        </span>
                      </>
                    )}
                    {h.action === 'reassigned' && (
                      <>
                        {h.changed_by ? `${nameOf(h.changed_by)} : ` : ''}
                        {nameOf(h.prev_doctor_id)} →{' '}
                        <span className="font-medium">
                          {nameOf(h.doctor_id)}
                        </span>
                      </>
                    )}
                    {h.action === 'removed' && (
                      <>
                        {h.changed_by
                          ? `${nameOf(h.changed_by)} ${t('assign.removedBy')}`
                          : t('assign.removedShort')}{' '}
                        ({nameOf(h.prev_doctor_id)})
                      </>
                    )}
                  </span>
                  <span className="shrink-0 text-slate-400">
                    {timeAgo(h.changed_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
