import { useEffect, useMemo, useState } from 'react';
import { Repeat, Loader2 } from 'lucide-react';
import { Sheet } from '@mister-guiiug/dev-pwa-config/react/sheet';
import { fromISODate, mondayIndex, toISODate } from '../../lib/dates.ts';
import { shiftLabel, type ShiftType } from '../../lib/shifts.ts';
import { logError } from '../../lib/logger.ts';
import { listShiftsBetween } from '../../backend/planning.ts';
import type { Doctor, Shift } from '../../backend/types.ts';
import { useI18n } from '../../i18n/index.ts';
import { ErrorMessage } from '../../components/ui/ErrorMessage.tsx';

/** Nombre de jours à venir dans lesquels chercher mes gardes proposables. */
const HORIZON_DAYS = 60;

/**
 * Dialogue « Proposer une garde » depuis la bourse : liste mes gardes cliniques
 * à venir (hors celles déjà proposées), me laisse en choisir une, cibler un
 * collègue ou ouvrir à tous, et ajouter un message. L'échange lui-même passe par
 * `proposeSwap` (fourni via `onSubmit`).
 */
export function ProposeSwapDialog({
  doctors,
  selfDoctorId,
  alreadyProposed,
  onSubmit,
  onClose,
}: {
  doctors: Doctor[];
  selfDoctorId: string;
  /** Clés `work_date|shift_type` déjà en cours de proposition (à exclure). */
  alreadyProposed: Set<string>;
  onSubmit: (
    workDate: string,
    shiftType: ShiftType,
    toDoctor: string | null,
    message: string
  ) => Promise<void>;
  onClose: () => void;
}) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [target, setTarget] = useState(''); // '' = ouvert à tous
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t, m } = useI18n();

  const dayLabel = (iso: string): string => {
    const d = fromISODate(iso);
    return `${m.common.weekdays[mondayIndex(d)]} ${d.getDate()}/${d.getMonth() + 1}`;
  };

  useEffect(() => {
    const now = new Date();
    const from = toISODate(now);
    const to = toISODate(
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + HORIZON_DAYS)
    );
    let alive = true;
    listShiftsBetween(from, to)
      .then(all => {
        if (!alive) return;
        setShifts(
          all.filter(
            s =>
              s.doctor_id === selfDoctorId &&
              !alreadyProposed.has(`${s.work_date}|${s.shift_type}`)
          )
        );
      })
      .catch(e => {
        logError('ProposeSwap listShiftsBetween', e);
        if (alive) setError(t('swaps.cannotLoad'));
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [selfDoctorId, alreadyProposed]);

  const myShifts = useMemo(
    () =>
      [...shifts].sort(
        (a, b) =>
          a.work_date.localeCompare(b.work_date) ||
          a.shift_type.localeCompare(b.shift_type)
      ),
    [shifts]
  );

  async function submit() {
    if (!selected) return;
    const [iso, type] = selected.split('|');
    if (!iso || !type) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(iso, type as ShiftType, target || null, message.trim());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={t('swaps.propose')}
      closeLabel={t('common.close')}
      footer={
        // Rien à valider tant que le chargement dure ou qu'aucune garde n'est
        // proposable : le pied n'existe alors pas, plutôt qu'un bouton mort.
        loading || myShifts.length === 0 ? undefined : (
          <button
            onClick={() => void submit()}
            disabled={!selected || busy}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Repeat className="size-4" />
            )}
            {t('swaps.proposeExchange')}
          </button>
        )
      }
    >
      {loading ? (
        <div className="grid place-items-center py-8 text-slate-400">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : myShifts.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">
          {t('swaps.noneToPropose')}
        </p>
      ) : (
        <>
          <p className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            {t('swaps.myShiftToGive')}
          </p>
          <div className="mb-3 flex max-h-48 flex-col gap-1 overflow-y-auto">
            {myShifts.map(s => {
              const key = `${s.work_date}|${s.shift_type}`;
              const active = selected === key;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelected(key)}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                    active
                      ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/40'
                      : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="capitalize">{dayLabel(s.work_date)}</span>
                  <span className="font-medium">
                    {shiftLabel(s.shift_type)}
                  </span>
                </button>
              );
            })}
          </div>

          <label className="mb-3 flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-600 dark:text-slate-300">
              {t('swaps.recipient')}
            </span>
            <select
              value={target}
              onChange={e => setTarget(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="">{t('assign.openToAll')}</option>
              {doctors
                .filter(d => d.id !== selfDoctorId && d.approved)
                .map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
          </label>

          <label className="mb-3 flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-600 dark:text-slate-300">
              {t('swaps.messageOptional')}
            </span>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={2}
              placeholder={t('swaps.messagePlaceholder')}
              className="resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-800"
            />
          </label>

          {error && <ErrorMessage>{error}</ErrorMessage>}
        </>
      )}
    </Sheet>
  );
}
