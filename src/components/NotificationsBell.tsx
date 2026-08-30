import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import {
  deleteNotification,
  listNotifications,
  markAllRead,
  markRead,
  subscribeNotifications,
} from '../backend/notifications.ts';
import { NotificationPanel } from './NotificationPanel.tsx';
import { useToast } from '@mister-guiiug/dev-wpa-config/react/toast';
import { useI18n } from '../i18n/index.ts';
import { logError } from '../lib/logger.ts';
import type { Notification } from '../backend/types.ts';

/** Destination (route) associée à une notification, pour le raccourci au clic. */
function targetFor(n: Notification): string {
  if (n.type === 'approval_request') return '/admin';
  if (n.work_date) return `/?d=${n.work_date}`;
  return '/';
}

export function NotificationsBell() {
  const { t } = useI18n();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [, setTick] = useState(0);
  const navigate = useNavigate();
  // `useToast()` renvoie un objet neuf à chaque rendu : on le lit via une ref
  // pour garder `load` stable (sinon l'abonnement temps réel se recréerait à
  // chaque rendu).
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  // IDs déjà vus : au 1er chargement on ne « toaste » rien ; ensuite, toute
  // notif non lue jamais vue déclenche un toast (arrivée en temps réel).
  const seen = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    let list: Notification[];
    try {
      list = await listNotifications();
    } catch (e) {
      logError('listNotifications', e);
      return;
    }
    setItems(list);
    const ids = new Set(list.map(n => n.id));
    if (seen.current === null) {
      seen.current = ids;
    } else {
      for (const n of list) {
        if (!seen.current.has(n.id) && !n.read)
          toastRef.current.success(n.title);
      }
      seen.current = ids;
    }
  }, []);

  useEffect(() => {
    void load();
    return subscribeNotifications(() => void load());
  }, [load]);

  // Rafraîchit l'heure relative (« il y a 3 min ») une fois par minute.
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const unread = items.filter(n => !n.read).length;

  async function handleMarkAll() {
    setItems(cur => cur.map(n => ({ ...n, read: true })));
    try {
      await markAllRead();
    } catch {
      load();
    }
  }

  async function handleDelete(id: string) {
    setItems(cur => cur.filter(n => n.id !== id));
    try {
      await deleteNotification(id);
    } catch {
      load();
    }
  }

  /** Raccourci : marque la notif lue, ferme le panneau et va au bon menu. */
  function handleOpen(n: Notification) {
    setOpen(false);
    if (!n.read) {
      setItems(cur => cur.map(x => (x.id === n.id ? { ...x, read: true } : x)));
      markRead(n.id).catch(() => {});
    }
    navigate(targetFor(n));
  }

  /** Marque une notif comme lue (glissement latéral sur la ligne). */
  function handleMarkRead(id: string) {
    setItems(cur => cur.map(x => (x.id === id ? { ...x, read: true } : x)));
    markRead(id).catch(() => load());
  }

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={
          unread > 0
            ? t('notifications.unreadAria', { count: unread })
            : t('notifications.title')
        }
        className="relative rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4 text-white"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {/* Annonce discrète pour les lecteurs d'écran quand le compteur change. */}
      <span className="sr-only" role="status" aria-live="polite">
        {unread > 0 ? t('notifications.unreadStatus', { count: unread }) : ''}
      </span>

      {open && (
        <NotificationPanel
          items={items}
          unread={unread}
          onClose={() => setOpen(false)}
          onMarkAll={() => void handleMarkAll()}
          onOpen={handleOpen}
          onMarkRead={handleMarkRead}
          onDelete={id => void handleDelete(id)}
        />
      )}
    </>
  );
}
