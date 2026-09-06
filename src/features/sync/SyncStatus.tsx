import { useState } from 'react';
import { SyncStatusBadge } from '@mister-guiiug/dev-pwa-config/react/sync-status-badge';
import { Sheet } from '@mister-guiiug/dev-pwa-config/react/sheet';
import { useI18n } from '../../i18n/index.ts';
import { describeOp, useSyncQueue } from './useSyncQueue.ts';

/**
 * L'état de la file d'écritures hors ligne, dans l'en-tête — donc sur TOUS les
 * écrans, pas seulement le planning : une écriture enfilée depuis « Mon
 * planning » doit se voir depuis le Profil.
 *
 * LE BADGE VIENT DU SOCLE (`react/sync-status-badge`, zéro adoptant jusqu'ici)
 * plutôt que d'une énième copie locale. Il n'est pas stylé par le socle : la
 * couleur vient d'ici, par `data-status`.
 *
 * IL SE TAIT QUAND IL N'A RIEN À DIRE. Un badge « synchronisé » permanent est
 * du bruit, et hors ligne sans rien en attente le bandeau réseau de
 * l'application parle déjà. Il apparaît dès qu'une écriture attend ou qu'une
 * écriture a été refusée — et dans ce dernier cas il est ROUGE et ouvre la
 * liste : le refus est une trace consultable, pas un toast qui passe.
 *
 * MONTÉ UNE SEULE FOIS. `useSyncQueue` pose l'observateur de la file, qui n'a
 * qu'un emplacement — deux instances et les notifications de conflit de la
 * première seraient perdues.
 */
export function SyncStatus() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const { status, pending, dead, waiting, visible, retryDead, forgetDead } =
    useSyncQueue();

  if (!visible) return null;

  const tone =
    status === 'error'
      ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
      : status === 'offline'
        ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
        : 'border-teal-300 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-300';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={t('sync.openPanel')}
        aria-label={t('sync.openPanel')}
        className={`rounded-lg border px-2 py-1 text-xs font-medium ${tone}`}
      >
        <SyncStatusBadge
          status={status}
          pending={pending}
          labels={{
            pending: t('sync.labelPending'),
            offline: t('sync.labelOffline', { n: pending }),
            error: t('sync.labelError', { n: dead.length }),
          }}
        />
      </button>

      {open && (
        <Sheet
          open
          onClose={() => setOpen(false)}
          title={t('sync.panelTitle')}
          closeLabel={t('common.close')}
        >
          <div className="space-y-4 text-sm">
            {dead.length > 0 && (
              <section>
                <h3 className="mb-1 font-semibold text-red-700 dark:text-red-300">
                  {t('sync.rejectedTitle', { n: dead.length })}
                </h3>
                <p className="mb-2 text-slate-600 dark:text-slate-300">
                  {t('sync.rejectedHelp')}
                </p>
                <ul className="space-y-1">
                  {dead.map(entry => (
                    <li
                      key={entry.id}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900/60 dark:bg-red-950/30"
                    >
                      <span className="font-medium">
                        {describeOp(entry.payload, t)}
                      </span>
                      {entry.lastError && (
                        <span className="block text-xs text-red-700 dark:text-red-300">
                          {entry.lastError}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={retryDead}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                  >
                    {t('sync.retry')}
                  </button>
                  <button
                    onClick={forgetDead}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                  >
                    {t('sync.forget')}
                  </button>
                </div>
              </section>
            )}

            <section>
              <h3 className="mb-1 font-semibold text-slate-800 dark:text-slate-100">
                {t('sync.waitingTitle', { n: waiting.length })}
              </h3>
              {waiting.length === 0 ? (
                <p className="text-slate-600 dark:text-slate-300">
                  {t('sync.waitingNone')}
                </p>
              ) : (
                <ul className="space-y-1">
                  {waiting.map(entry => (
                    <li
                      key={entry.id}
                      className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800"
                    >
                      {describeOp(entry.payload, t)}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </Sheet>
      )}
    </>
  );
}
