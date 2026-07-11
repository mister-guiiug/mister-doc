import { useState } from 'react';
import { Trash2, UserPlus, X, Loader2, Check } from 'lucide-react';
import { WEEKDAY_LABELS, fromISODate, mondayIndex } from '../../lib/dates.ts';
import { SHIFT_LABEL, SHIFT_HOURS, type ShiftType } from '../../lib/shifts.ts';
import type { Doctor, Shift } from '../../backend/types.ts';

export interface SlotTarget {
  iso: string;
  shiftType: ShiftType;
}

export function AssignDialog({
  target,
  currentShift,
  doctors,
  selfDoctorId,
  onAssign,
  onClear,
  onClose,
}: {
  target: SlotTarget;
  currentShift: Shift | undefined;
  doctors: Doctor[];
  selfDoctorId: string;
  onAssign: (doctorId: string) => Promise<void>;
  onClear: () => Promise<void>;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const d = fromISODate(target.iso);
  const dayLabel = `${WEEKDAY_LABELS[mondayIndex(d)]} ${d.getDate()}`;

  const filtered = doctors.filter(doc =>
    doc.name.toLowerCase().includes(query.trim().toLowerCase())
  );

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
    <div
      className="fixed inset-0 z-30 grid place-items-end bg-black/40 sm:place-items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-2xl bg-white shadow-xl dark:bg-slate-900 sm:rounded-2xl"
        onClick={e => e.stopPropagation()}
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
              onClick={() => void run(onClear)}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900/60 dark:hover:bg-red-950/30"
            >
              <Trash2 className="size-4" /> Libérer le créneau
            </button>
          )}
        </div>

        <div className="p-3">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher un médecin…"
            className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-600 dark:bg-slate-800"
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
                  <span className="flex-1 truncate">{doc.name}</span>
                  {doc.id === selfDoctorId && (
                    <span className="text-[10px] font-semibold uppercase text-teal-600">
                      moi
                    </span>
                  )}
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
      </div>
    </div>
  );
}
