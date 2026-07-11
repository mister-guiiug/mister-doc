import { useState } from 'react';
import { X, Loader2, CalendarOff } from 'lucide-react';
import { WEEKDAY_LABELS, fromISODate, mondayIndex } from '../../lib/dates.ts';
import {
  LEAVE_KINDS,
  LEAVE_LABEL,
  type LeaveKind,
} from '../../lib/leaves.ts';
import type { Doctor } from '../../backend/types.ts';

export function LeaveDialog({
  date,
  doctors,
  selfDoctorId,
  onSubmit,
  onClose,
}: {
  date: string; // jour cliqué (borne de départ par défaut)
  doctors: Doctor[];
  selfDoctorId: string;
  onSubmit: (
    doctorId: string,
    fromISO: string,
    toISO: string,
    kind: LeaveKind,
    hours: number | null
  ) => Promise<void>;
  onClose: () => void;
}) {
  const [doctorId, setDoctorId] = useState(selfDoctorId);
  const [kind, setKind] = useState<LeaveKind>('annual');
  const [from, setFrom] = useState(date);
  const [to, setTo] = useState(date);
  const [hours, setHours] = useState('8');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const d = fromISODate(date);
  const dayLabel = `${WEEKDAY_LABELS[mondayIndex(d)]} ${d.getDate()}`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (to < from) {
      setError('La date de fin doit suivre la date de début.');
      return;
    }
    const h = kind === 'training' ? Number(hours) : null;
    if (kind === 'training' && (!Number.isFinite(h) || h! < 0 || h! > 24)) {
      setError('Nombre d’heures de formation invalide (0 à 24).');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onSubmit(doctorId, from, to, kind, h);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-30 grid place-items-end bg-black/40 sm:place-items-center"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-t-2xl bg-white p-4 shadow-xl dark:bg-slate-900 sm:rounded-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold">
            <CalendarOff className="size-5 text-violet-600" />
            Poser une absence
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="size-5" />
          </button>
        </div>

        <label className="mb-3 flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-600 dark:text-slate-300">
            Médecin
          </span>
          <select
            value={doctorId}
            onChange={e => setDoctorId(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-800"
          >
            {doctors.map(doc => (
              <option key={doc.id} value={doc.id}>
                {doc.name}
                {doc.id === selfDoctorId ? ' (moi)' : ''}
              </option>
            ))}
          </select>
        </label>

        <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-sm font-medium dark:bg-slate-800">
          {LEAVE_KINDS.map(k => (
            <button
              type="button"
              key={k}
              onClick={() => setKind(k)}
              className={`rounded-md py-1.5 transition ${
                kind === k
                  ? 'bg-white shadow-sm dark:bg-slate-700'
                  : 'text-slate-500'
              }`}
            >
              {LEAVE_LABEL[k]}
            </button>
          ))}
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-600 dark:text-slate-300">
              Du
            </span>
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-800"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-600 dark:text-slate-300">
              Au
            </span>
            <input
              type="date"
              value={to}
              min={from}
              onChange={e => setTo(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-800"
            />
          </label>
        </div>

        {kind === 'training' && (
          <label className="mb-3 flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-600 dark:text-slate-300">
              Heures de formation (par jour)
            </span>
            <input
              type="number"
              min={0}
              max={24}
              step={0.5}
              value={hours}
              onChange={e => setHours(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-800"
            />
          </label>
        )}

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <p className="mb-3 text-xs text-slate-400">
          Jour cliqué : <span className="capitalize">{dayLabel}</span>. Une
          entrée sera créée pour chaque jour de la plage.
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-300 py-2 text-sm font-medium dark:border-slate-600"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-violet-600 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            Poser
          </button>
        </div>
      </form>
    </div>
  );
}
