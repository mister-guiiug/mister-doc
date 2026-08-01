import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';
import { useI18n } from '../i18n/index.ts';
import { logError } from '../lib/logger.ts';

/**
 * Bandeau « nouvelle version disponible ».
 *
 * Le service worker était en `autoUpdate` : la mise à jour s'appliquait sans
 * prévenir, au prix d'un rechargement possible EN PLEINE SAISIE (affectation
 * d'une garde, formulaire ouvert). On passe en mode `prompt` : la nouvelle
 * version est téléchargée en fond, puis l'utilisateur choisit QUAND recharger.
 * Refuser laisse l'application en l'état ; la mise à jour s'appliquera au
 * prochain démarrage.
 */
export function UpdatePrompt() {
  const { t } = useI18n();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      logError('serviceWorker', error);
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
    >
      <div className="flex w-full max-w-sm items-center gap-2 rounded-xl border border-teal-200 bg-white px-3 py-2.5 text-sm shadow-lg dark:border-teal-900 dark:bg-slate-800 dark:text-slate-100">
        <RefreshCw className="size-5 shrink-0 text-teal-600" />
        <span className="min-w-0 flex-1">{t('update.available')}</span>
        <button
          onClick={() => {
            void updateServiceWorker(true);
          }}
          className="shrink-0 rounded-lg bg-teal-700 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-teal-800"
        >
          {t('update.reload')}
        </button>
        <button
          onClick={() => setNeedRefresh(false)}
          aria-label={t('common.close')}
          className="shrink-0 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
