import { useEffect, useMemo, useState } from 'react';
import {
  Trash2,
  UserPlus,
  X,
  Loader2,
  Check,
  AlertTriangle,
  Moon,
  Repeat,
  ThumbsUp,
  ThumbsDown,
  History,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { WEEKDAY_LABELS, fromISODate, mondayIndex } from '../../lib/dates.ts';
import { SHIFT_LABEL, SHIFT_HOURS, type ShiftType } from '../../lib/shifts.ts';
import {
  doctorsOnLeave,
  doctorsWorking,
  violatesRest,
} from '../../lib/validation.ts';
import type {
  Doctor,
  Leave,
  Shift,
  ShiftHistory,
  WishKind,
} from '../../backend/types.ts';
import { listSlotHistory } from '../../backend/history.ts';
import { Modal } from '../../components/Modal.tsx';
import { useConfirm } from '../../components/ui/confirmContext.ts';

/** Temps relatif court en français (pour l'historique). */
function frTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 7 * 86400) return `il y a ${Math.floor(diff / 86400)} j`;
  return new Date(iso).toLocaleDateString('fr-FR');
}

export interface SlotTarget {
  iso: string;
  shiftType: ShiftType;
}

export function AssignDialog({
  target,
  currentShift,
  doctors,
  selfDoctorId,
  monthShifts,
  leaves,
  dayWishes,
  onAssign,
  onClear,
  onPropose,
  onClose,
}: {
  target: SlotTarget;
  currentShift: Shift | undefined;
  doctors: Doctor[];
  selfDoctorId: string;
  monthShifts: Shift[];
  leaves: Leave[];
  dayWishes: Map<string, WishKind>;
  onAssign: (doctorId: string) => Promise<void>;
  onClear: () => Promise<void>;
  onPropose: (toDoctor: string | null, message: string) => Promise<void>;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapTarget, setSwapTarget] = useState('');
  const [swapMsg, setSwapMsg] = useState('');
  const [history, setHistory] = useState<ShiftHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const confirm = useConfirm();
  const isMine = currentShift?.doctor_id === selfDoctorId;

  const d = fromISODate(target.iso);
  const dayLabel = `${WEEKDAY_LABELS[mondayIndex(d)]} ${d.getDate()}`;
  const doctorsById = useMemo(
    () => new Map(doctors.map(doc => [doc.id, doc])),
    [doctors]
  );
  const nameOf = (id: string | null) =>
    id ? (doctorsById.get(id)?.name ?? 'compte supprimé') : '—';

  useEffect(() => {
    let alive = true;
    setLoadingHistory(true);
    listSlotHistory(target.iso, target.shiftType, 10)
      .then(h => alive && setHistory(h))
      .catch(() => {})
      .finally(() => alive && setLoadingHistory(false));
    return () => {
      alive = false;
    };
  }, [target.iso, target.shiftType]);

  const onLeave = useMemo(() => doctorsOnLeave(target.iso, leaves), [target.iso, leaves]);
  const working = useMemo(
    () => doctorsWorking(target.iso, monthShifts),
    [target.iso, monthShifts]
  );
  const hoursByDoctor = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of monthShifts)
      m.set(s.doctor_id, (m.get(s.doctor_id) ?? 0) + (SHIFT_HOURS[s.shift_type] ?? 0));
    return m;
  }, [monthShifts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return doctors
      .filter(doc => doc.name.toLowerCase().includes(q))
      .sort(
        (a, b) => (hoursByDoctor.get(a.id) ?? 0) - (hoursByDoctor.get(b.id) ?? 0)
      );
  }, [doctors, query, hoursByDoctor]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      onClose={onClose}
      className="flex max-h-[85dvh] max-w-md flex-col rounded-t-2xl sm:rounded-2xl"
    >
      <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800">
        <div>
          <h3 className="font-semibold">
            {SHIFT_LABEL[target.shiftType]} · {SHIFT_HOURS[target.shiftType]} h
          </h3>
          <p className="text-sm capitalize text-slate-500">{dayLabel}</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="border-b border-slate-100 p-3 dark:border-slate-800">
        <button
          disabled={busy || currentShift?.doctor_id === selfDoctorId}
          onClick={() => void run(() => onAssign(selfDoctorId))}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
        >
          <UserPlus className="size-4" /> M'assigner ce créneau
        </button>
        {currentShift && (
          <button
            disabled={busy}
            onClick={async () => {
              if (
                await confirm({
                  message: `Libérer le créneau ${SHIFT_LABEL[target.shiftType]} du ${dayLabel} ? Le médecin en sera retiré.`,
                  danger: true,
                  confirmLabel: 'Libérer',
                })
              )
                void run(onClear);
            }}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900/60 dark:hover:bg-red-950/30"
          >
            <Trash2 className="size-4" /> Libérer le créneau
          </button>
        )}

        {isMine && !swapOpen && (
          <button
            onClick={() => setSwapOpen(true)}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 py-2 text-sm font-medium transition hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            <Repeat className="size-4" /> Proposer un échange
          </button>
        )}
        {isMine && swapOpen && (
          <div className="mt-2 flex flex-col gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700">
            <select
              value={swapTarget}
              onChange={e => setSwapTarget(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="">Ouvert à tous</option>
              {doctors
                .filter(d => d.id !== selfDoctorId)
                .map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
            <input
              value={swapMsg}
              onChange={e => setSwapMsg(e.target.value)}
              placeholder="Message (facultatif)"
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setSwapOpen(false)}
                className="flex-1 rounded-lg border border-slate-300 py-1.5 text-sm dark:border-slate-600"
              >
                Annuler
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  void run(() => onPropose(swapTarget || null, swapMsg))
                }
                className="flex-1 rounded-lg bg-teal-600 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                Proposer
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setHistoryOpen(o => !o)}
          aria-expanded={historyOpen}
          className="flex w-full items-center gap-2 text-xs font-medium text-slate-500 transition hover:text-slate-700 dark:hover:text-slate-300"
        >
          <History className="size-3.5" />
          Historique des changements
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
                Aucun changement enregistré.
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
                            ? `${nameOf(h.changed_by)} a attribué à `
                            : 'Attribué à '}
                          <span className="font-medium">{nameOf(h.doctor_id)}</span>
                        </>
                      )}
                      {h.action === 'reassigned' && (
                        <>
                          {h.changed_by ? `${nameOf(h.changed_by)} : ` : ''}
                          {nameOf(h.prev_doctor_id)} →{' '}
                          <span className="font-medium">{nameOf(h.doctor_id)}</span>
                        </>
                      )}
                      {h.action === 'removed' && (
                        <>
                          {h.changed_by
                            ? `${nameOf(h.changed_by)} a libéré`
                            : 'Libéré'}{' '}
                          ({nameOf(h.prev_doctor_id)})
                        </>
                      )}
                    </span>
                    <span className="shrink-0 text-slate-400">
                      {frTime(h.changed_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="p-3">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher un médecin… (triés par charge)"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-600 dark:bg-slate-800"
        />
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {filtered.length === 0 && (
          <li className="px-2 py-6 text-center text-sm text-slate-400">
            Aucun médecin. Ajoutez le roster depuis l'onglet Admin.
          </li>
        )}
        {filtered.map(doc => {
          const active = currentShift?.doctor_id === doc.id;
          const leave = onLeave.has(doc.id);
          const rest = violatesRest(doc.id, target.iso, monthShifts);
          const busyDay = working.has(doc.id) && !active;
          const hours = hoursByDoctor.get(doc.id) ?? 0;
          return (
            <li key={doc.id}>
              <button
                disabled={busy}
                onClick={() => void run(() => onAssign(doc.id))}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"
              >
                <span
                  className="inline-block size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: doc.color }}
                />
                <span className="flex-1 truncate">
                  {doc.name}
                  {doc.id === selfDoctorId && (
                    <span className="ml-1 text-[10px] font-semibold uppercase text-teal-600">
                      moi
                    </span>
                  )}
                </span>
                {rest && (
                  <span
                    title="Repos de sécurité (nuit la veille)"
                    className="flex items-center gap-0.5 rounded bg-red-100 px-1 text-[10px] font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-300"
                  >
                    <Moon className="size-3" /> repos
                  </span>
                )}
                {leave && (
                  <span
                    title="En absence ce jour"
                    className="rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                  >
                    congé
                  </span>
                )}
                {busyDay && (
                  <span
                    title="Déjà de garde ce jour"
                    className="rounded bg-slate-200 px-1 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                  >
                    de garde
                  </span>
                )}
                {dayWishes.get(doc.id) === 'prefer' && (
                  <ThumbsUp
                    className="size-3.5 text-emerald-500"
                    aria-label="préfère ce jour"
                  />
                )}
                {dayWishes.get(doc.id) === 'avoid' && (
                  <ThumbsDown
                    className="size-3.5 text-rose-500"
                    aria-label="évite ce jour"
                  />
                )}
                <span className="tabular-nums text-[11px] text-slate-400">
                  {hours}h
                </span>
                {active &&
                  (busy ? (
                    <Loader2 className="size-4 animate-spin text-teal-600" />
                  ) : (
                    <Check className="size-4 text-teal-600" />
                  ))}
              </button>
            </li>
          );
        })}
      </ul>

      {(onLeave.size > 0 || filtered.some(doc => violatesRest(doc.id, target.iso, monthShifts))) && (
        <p className="flex items-center gap-1 border-t border-slate-100 px-3 py-2 text-[11px] text-slate-400 dark:border-slate-800">
          <AlertTriangle className="size-3 shrink-0" />
          Les badges signalent congés, gardes existantes et repos de sécurité.
        </p>
      )}
    </Modal>
  );
}
