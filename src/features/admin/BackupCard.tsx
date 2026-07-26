import { useEffect, useRef, useState } from 'react';
import {
  DatabaseBackup,
  Download,
  Upload,
  Trash2,
  RotateCcw,
  Info,
} from 'lucide-react';
import { useToast } from '../../components/Toast.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { SectionCard } from '../../components/ui/SectionCard.tsx';
import { useConfirm } from '../../components/ui/confirmContext.ts';
import { useI18n } from '../../i18n/index.ts';
import type { BackupMeta } from '../../backend/types.ts';
import {
  adminBackup,
  adminRestore,
  deleteBackup,
  getBackupPayload,
  listBackups,
} from '../../backend/backup.ts';

function download(payload: unknown, name: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function BackupCard() {
  const toast = useToast();
  const confirm = useConfirm();
  const { t, locale } = useI18n();
  const [backups, setBackups] = useState<BackupMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = () =>
    listBackups()
      .then(setBackups)
      .catch(() => {});
  useEffect(() => {
    reload();
  }, []);

  async function handleExport() {
    setBusy(true);
    try {
      const snap = await adminBackup();
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
      download(snap, `mister-doc-backup-${stamp}.json`);
      await reload();
      toast.success(t('backup.exported'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(mode: 'merge' | 'replace') {
    if (!pending) return;
    if (
      !(await confirm({
        message:
          mode === 'replace'
            ? t('backup.replaceConfirm')
            : t('backup.mergeConfirm'),
        danger: mode === 'replace',
        confirmLabel:
          mode === 'replace' ? t('backup.replace') : t('backup.merge'),
      }))
    )
      return;
    setBusy(true);
    try {
      const payload = JSON.parse(await pending.text());
      await adminRestore(payload, mode);
      toast.success(t('backup.restored'));
      setPending(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('backup.invalidFile'));
    } finally {
      setBusy(false);
    }
  }

  async function restoreSnapshot(id: string) {
    if (
      !(await confirm({
        message: t('backup.restoreConfirm'),
        danger: true,
        confirmLabel: t('backup.restoreLabel'),
      }))
    )
      return;
    setBusy(true);
    try {
      const payload = await getBackupPayload(id);
      await adminRestore(payload, 'replace');
      toast.success(t('backup.snapshotRestored'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  async function downloadSnapshot(id: string) {
    try {
      const payload = await getBackupPayload(id);
      download(payload, `mister-doc-backup-${id.slice(0, 8)}.json`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('common.error'));
    }
  }

  async function removeSnapshot(id: string) {
    setBackups(cur => cur.filter(b => b.id !== id));
    try {
      await deleteBackup(id);
    } catch {
      reload();
    }
  }

  return (
    <SectionCard
      title={t('backup.title')}
      icon={<DatabaseBackup className="size-4" />}
    >
      <div className="flex flex-wrap gap-2">
        <Button loading={busy} onClick={() => void handleExport()}>
          {!busy && <Download className="size-4" />}
          {t('backup.exportJson')}
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="size-4" /> {t('backup.importFile')}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={e => setPending(e.target.files?.[0] ?? null)}
        />
      </div>

      {pending && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="truncate text-xs text-slate-500">
            {pending.name}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => void handleImport('merge')}
          >
            {t('backup.merge')}
          </Button>
          <Button
            variant="dangerGhost"
            size="sm"
            disabled={busy}
            onClick={() => void handleImport('replace')}
          >
            {t('backup.replace')}
          </Button>
          <button
            onClick={() => {
              setPending(null);
              if (fileRef.current) fileRef.current.value = '';
            }}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            {t('common.cancel')}
          </button>
        </div>
      )}

      <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>{t('backup.note')}</span>
      </p>

      {backups.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {backups.map(b => (
            <li
              key={b.id}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700"
            >
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                  b.kind === 'auto'
                    ? 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                    : 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300'
                }`}
              >
                {b.kind === 'auto'
                  ? t('backup.autoBadge')
                  : t('backup.manualBadge')}
              </span>
              <span className="flex-1 truncate text-xs text-slate-500">
                {new Date(b.created_at).toLocaleString(
                  locale === 'en' ? 'en-GB' : 'fr-FR'
                )}
                {b.size
                  ? ` · ${Math.round(b.size / 1024)} ${t('backup.koUnit')}`
                  : ''}
              </span>
              <button
                onClick={() => void downloadSnapshot(b.id)}
                title={t('backup.download')}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <Download className="size-4" />
              </button>
              <button
                onClick={() => void restoreSnapshot(b.id)}
                title={t('backup.restore')}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <RotateCcw className="size-4" />
              </button>
              <button
                onClick={() => void removeSnapshot(b.id)}
                title={t('backup.delete')}
                className="rounded p-1 text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
