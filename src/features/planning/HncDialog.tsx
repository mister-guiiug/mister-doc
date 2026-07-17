import { useMemo, useState } from 'react';
import { X, Clock3, Trash2 } from 'lucide-react';
import { WEEKDAY_LABELS, fromISODate, mondayIndex } from '../../lib/dates.ts';
import { HNC_MAX_HOURS } from '../../lib/hnc.ts';
import type { Doctor, HncEntry } from '../../backend/types.ts';
import { Modal } from '../../components/Modal.tsx';
import { Button } from '../../components/ui/Button.tsx';

/**
 * Saisie des Heures Non Cliniques d'un jour. Plusieurs médecins possibles ;
 * enregistrer pour un médecin qui a déjà une entrée met à jour ses heures.
 */
export function HncDialog({
  date,
  doctors,
  selfDoctorId,
  dayEntries,
  onSubmit,
  onRemove,
  onClose,
}: {
  date: string;
  doctors: Doctor[];
  selfDoctorId: string;
  dayEntries: HncEntry[];
  onSubmit: (doctorId: string, hours: number) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const doctorsById = useMemo(
    () => new Map(doctors.map(d => [d.id, d])),
    [doctors]
  );
  const [doctorId, setDoctorId] = useState(selfDoctorId);
  const [hours, setHours] = useState('8');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const d = fromISODate(date);
  const dayLabel = `${WEEKDAY_LABELS[mondayIndex(d)]} ${d.getDate()}`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const h = Number(hours);
    if (!Number.isFinite(h) || h <= 0 || h > HNC_MAX_HOURS) {
      setError(`Nombre d’heures invalide (0 à ${HNC_MAX_HOURS}).`);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onSubmit(doctorId, h);
      // Prépare la saisie suivante (autre médecin), sans fermer.
      setHours('8');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  function edit(entry: HncEntry) {
    setDoctorId(entry.doctor_id);
    setHours(String(entry.hours));
    setError(null);
  }

  return (
    <Modal onClose={onClose} className="max-w-md rounded-t-2xl p-4 sm:rounded-2xl">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold">
          <Clock3 className="size-5 text-sky-600" />
          Heures non cliniques
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="size-5" />
        </button>
      </div>
      <p className="mb-3 text-sm capitalize text-slate-500">{dayLabel}</p>

      {dayEntries.length > 0 && (
        <ul className="mb-3 flex flex-col gap-1">
          {dayEntries.map(entry => {
            const doc = doctorsById.get(entry.doctor_id);
            return (
              <li
                key={entry.id}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700"
              >
                <span
                  className="inline-block size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: doc?.color ?? '#999' }}
                />
                <button
                  type="button"
                  onClick={() => edit(entry)}
                  className="flex-1 truncate text-left hover:underline"
                  title="Modifier"
                >
                  {doc?.name ?? '?'}
                  {entry.doctor_id === selfDoctorId && (
                    <span className="ml-1 text-[10px] font-semibold uppercase text-sky-600">
                      moi
                    </span>
                  )}
                </button>
                <span className="tabular-nums font-medium text-sky-700 dark:text-sky-300">
                  {entry.hours} h
                </span>
                <button
                  type="button"
                  onClick={() => void onRemove(entry.id)}
                  aria-label="Supprimer"
                  className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-600 dark:text-slate-300">
            Médecin
          </span>
          <select
            value={doctorId}
            onChange={e => setDoctorId(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-sky-500 dark:border-slate-600 dark:bg-slate-800"
          >
            {doctors.map(doc => (
              <option key={doc.id} value={doc.id}>
                {doc.name}
                {doc.id === selfDoctorId ? ' (moi)' : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-600 dark:text-slate-300">
            Heures non cliniques
          </span>
          <input
            type="number"
            min={0.5}
            max={HNC_MAX_HOURS}
            step={0.5}
            value={hours}
            onChange={e => setHours(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-sky-500 dark:border-slate-600 dark:bg-slate-800"
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={onClose}
          >
            Fermer
          </Button>
          <Button type="submit" loading={busy} className="flex-1">
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  );
}
