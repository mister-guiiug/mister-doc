import { Check, X } from 'lucide-react';
import { NotificationRow } from './NotificationRow.tsx';
import { useI18n } from '../i18n/index.ts';
import type { Notification } from '../backend/types.ts';

/**
 * Panneau déroulant des notifications (voile plein écran + carte : en-tête,
 * « tout lire », fermeture, liste). Purement présentationnel : l'état, les
 * appels réseau et les toasts restent dans `NotificationsBell`, qui lui
 * transmet la liste et les actions.
 */
export function NotificationPanel({
  items,
  unread,
  onClose,
  onMarkAll,
  onOpen,
  onMarkRead,
  onDelete,
}: {
  items: Notification[];
  unread: number;
  onClose: () => void;
  onMarkAll: () => void;
  onOpen: (n: Notification) => void;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="fixed inset-0 z-40" onClick={() => onClose()}>
      <div
        role="dialog"
        aria-label={t('notifications.title')}
        onClick={e => e.stopPropagation()}
        className="absolute right-2 top-14 flex max-h-[70dvh] w-[min(22rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
          <h3 className="font-semibold">{t('notifications.title')}</h3>
          <div className="flex items-center gap-1">
            {unread > 0 && (
              <button
                onClick={() => onMarkAll()}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40"
              >
                <Check className="size-3.5" /> {t('notifications.markAllRead')}
              </button>
            )}
            <button
              onClick={() => onClose()}
              aria-label={t('common.close')}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto">
          {items.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-slate-400">
              {t('notifications.none')}
            </li>
          )}
          {items.map(n => (
            <NotificationRow
              key={n.id}
              n={n}
              onOpen={onOpen}
              onMarkRead={onMarkRead}
              onDelete={onDelete}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}
