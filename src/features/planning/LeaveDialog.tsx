import { useState } from 'react';
import { X, CalendarOff } from 'lucide-react';
import { WEEKDAY_LABELS, fromISODate, mondayIndex } from '../../lib/dates.ts';
import {
  LEAVE_KINDS,
  LEAVE_LABEL,
  type LeaveKind,
} from '../../lib/leaves.ts';
import type { Doctor } from '../../backend/types.ts';
import { Modal } from '../../components/Modal.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { SegmentedControl } from '../../components/ui/SegmentedControl.tsx';

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
    <Modal onClose={onClose} className="max-w-md rounded-t-2xl p-4 sm:rounded-2xl">
      <form onSubmit={handleSubmit}>
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

        <SegmentedControl
          className="mb-3"
          fullWidth
          ariaLabel="Type d'absence"
          value={kind}
          onChange={setKind}
          options={LEAVE_KINDS.map(k => ({ value: k, label: LEAVE_LABEL[k] }))}
        />

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

        {error && (
          <p role="alert" className="mb-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <p className="mb-3 text-xs text-slate-400">
          Jour cliqué : <span className="capitalize">{dayLabel}</span>. Une
          entrée sera créée pour chaque jour de la plage.
        </p>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={onClose}
          >
            Annuler
          </Button>
          <Button type="submit" loading={busy} className="flex-1">
            Poser
          </Button>
        </div>
      </form>
    </Modal>
  );
}
