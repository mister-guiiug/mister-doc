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
import { useConfirm } from '../../components/ui/confirmContext.ts';
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
  const [backups, setBackups] = useState<BackupMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = () => listBackups().then(setBackups).catch(() => {});
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
      toast.success('Sauvegarde exportée.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
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
            ? 'Remplacer TOUT le planning (gardes, absences, notes) par ce fichier ? Action irréversible.'
            : 'Fusionner ce fichier avec le planning actuel ?',
        danger: mode === 'replace',
        confirmLabel: mode === 'replace' ? 'Remplacer' : 'Fusionner',
      }))
    )
      return;
    setBusy(true);
    try {
      const payload = JSON.parse(await pending.text());
      await adminRestore(payload, mode);
      toast.success('Restauration effectuée.');
      setPending(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fichier invalide');
    } finally {
      setBusy(false);
    }
  }

  async function restoreSnapshot(id: string) {
    if (
      !(await confirm({
        message: 'Restaurer cette sauvegarde ? Le planning actuel sera remplacé.',
        danger: true,
        confirmLabel: 'Restaurer',
      }))
    )
      return;
    setBusy(true);
    try {
      const payload = await getBackupPayload(id);
      await adminRestore(payload, 'replace');
      toast.success('Sauvegarde restaurée.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  async function downloadSnapshot(id: string) {
    try {
      const payload = await getBackupPayload(id);
      download(payload, `mister-doc-backup-${id.slice(0, 8)}.json`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
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
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center gap-2">
        <DatabaseBackup className="size-5 text-teal-600" />
        <h2 className="font-semibold">Sauvegarde &amp; restauration</h2>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button loading={busy} onClick={() => void handleExport()}>
          {!busy && <Download className="size-4" />}
          Exporter (.json)
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="size-4" /> Importer un fichier…
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
          <span className="truncate text-xs text-slate-500">{pending.name}</span>
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => void handleImport('merge')}
          >
            Fusionner
          </Button>
          <Button
            variant="dangerGhost"
            size="sm"
            disabled={busy}
            onClick={() => void handleImport('replace')}
          >
            Remplacer
          </Button>
          <button
            onClick={() => {
              setPending(null);
              if (fileRef.current) fileRef.current.value = '';
            }}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            Annuler
          </button>
        </div>
      )}

      <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Une <b>sauvegarde automatique</b> est réalisée chaque semaine (conservées :
          10 dernières). Déposez le fichier exporté dans votre Google&nbsp;Drive ou
          iCloud (ou un dossier synchronisé). L'upload Drive automatique nécessite
          des identifiants Google&nbsp;; iCloud n'expose pas d'API serveur.
        </span>
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
                {b.kind === 'auto' ? 'auto' : 'manuel'}
              </span>
              <span className="flex-1 truncate text-xs text-slate-500">
                {new Date(b.created_at).toLocaleString('fr-FR')}
                {b.size ? ` · ${Math.round(b.size / 1024)} Ko` : ''}
              </span>
              <button
                onClick={() => void downloadSnapshot(b.id)}
                title="Télécharger"
                className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <Download className="size-4" />
              </button>
              <button
                onClick={() => void restoreSnapshot(b.id)}
                title="Restaurer"
                className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <RotateCcw className="size-4" />
              </button>
              <button
                onClick={() => void removeSnapshot(b.id)}
                title="Supprimer"
                className="rounded p-1 text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
