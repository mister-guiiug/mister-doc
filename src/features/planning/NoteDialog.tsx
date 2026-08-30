import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { fromISODate, mondayIndex } from '../../lib/dates.ts';
import { Sheet } from '@mister-guiiug/dev-wpa-config/react/sheet';
import { Button } from '@mister-guiiug/dev-wpa-config/react/button';
import { useConfirm } from '../../components/ui/confirmContext.ts';
import { useI18n } from '../../i18n/index.ts';

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
  const confirm = useConfirm();
  const { t, m } = useI18n();

  const d = fromISODate(date);
  const dayLabel = `${m.common.weekdays[mondayIndex(d)]} ${d.getDate()}`;

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
    <Sheet
      open
      onClose={onClose}
      title={`${t('note.title')} — ${dayLabel}`}
      closeLabel={t('common.close')}
      footer={
        <>
          {initialNote && (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                if (
                  await confirm({
                    message: t('note.deleteConfirm', { day: dayLabel }),
                    danger: true,
                    confirmLabel: t('note.delete'),
                  })
                )
                  void run(onDelete);
              }}
              className="mr-auto flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/60 dark:hover:bg-red-950/30"
            >
              <Trash2 className="size-4" /> {t('note.delete')}
            </button>
          )}
          <Button
            type="button"
            loading={busy}
            disabled={!note.trim()}
            onClick={() => void run(() => onSave(note.trim()))}
          >
            {t('note.save')}
          </Button>
        </>
      }
    >
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        rows={3}
        placeholder={t('note.placeholder')}
        className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-600 dark:bg-slate-800"
      />
    </Sheet>
  );
}
