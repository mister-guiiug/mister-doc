import { useState } from 'react';
import { X, Loader2, Trash2, StickyNote } from 'lucide-react';
import { WEEKDAY_LABELS, fromISODate, mondayIndex } from '../../lib/dates.ts';
import { Modal } from '../../components/Modal.tsx';

export function NoteDialog({
  date,
  initialNote,
  onSave,
  onDelete,
  onClose,
}: {
  date: string;
  initialNote: string;
  onSave: (note: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}) {
  const [note, setNote] = useState(initialNote);
  const [busy, setBusy] = useState(false);

  const d = fromISODate(date);
  const dayLabel = `${WEEKDAY_LABELS[mondayIndex(d)]} ${d.getDate()}`;

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
    <Modal onClose={onClose} className="max-w-md rounded-t-2xl p-4 sm:rounded-2xl">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold">
          <StickyNote className="size-5 text-slate-500" />
          Note — <span className="capitalize">{dayLabel}</span>
        </h3>
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="size-5" />
        </button>
      </div>

      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        rows={3}
        placeholder="Réunion, staff, RMM, évènement…"
        className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-600 dark:bg-slate-800"
      />

      <div className="mt-3 flex gap-2">
        {initialNote && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (confirm(`Supprimer la note du ${dayLabel} ?`)) void run(onDelete);
            }}
            className="flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/60 dark:hover:bg-red-950/30"
          >
            <Trash2 className="size-4" /> Supprimer
          </button>
        )}
        <button
          type="button"
          disabled={busy || !note.trim()}
          onClick={() => void run(() => onSave(note.trim()))}
          className="ml-auto flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          Enregistrer
        </button>
      </div>
    </Modal>
  );
}
