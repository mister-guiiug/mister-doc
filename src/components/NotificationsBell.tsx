import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  X,
  Check,
  ChevronRight,
  CalendarPlus,
  CalendarX,
  CalendarOff,
  CalendarCheck,
  UserPlus,
  CheckCircle2,
  ArrowLeftRight,
  XCircle,
  Clock,
  Lock,
  LockOpen,
} from 'lucide-react';
import {
  deleteNotification,
  listNotifications,
  markAllRead,
  markRead,
  subscribeNotifications,
} from '../backend/notifications.ts';
import { useToast } from './Toast.tsx';
import type { Notification } from '../backend/types.ts';

/** Destination (route) associée à une notification, pour le raccourci au clic. */
function targetFor(n: Notification): string {
  if (n.type === 'approval_request') return '/admin';
  if (n.work_date) return `/?d=${n.work_date}`;
  return '/';
}

function iconFor(type: string) {
  switch (type) {
    case 'shift_assigned':
      return <CalendarPlus className="size-4 text-teal-600" />;
    case 'shift_removed':
      return <CalendarX className="size-4 text-red-500" />;
    case 'leave_added':
      return <CalendarOff className="size-4 text-violet-600" />;
    case 'leave_removed':
      return <CalendarCheck className="size-4 text-teal-600" />;
    case 'hnc_added':
      return <Clock className="size-4 text-sky-600" />;
    case 'swap_offer':
      return <ArrowLeftRight className="size-4 text-amber-600" />;
    case 'swap_accepted':
      return <CheckCircle2 className="size-4 text-teal-600" />;
    case 'swap_declined':
      return <XCircle className="size-4 text-red-500" />;
    case 'month_locked':
      return <Lock className="size-4 text-slate-500" />;
    case 'month_unlocked':
      return <LockOpen className="size-4 text-teal-600" />;
    case 'approval_request':
      return <UserPlus className="size-4 text-amber-600" />;
    case 'approved':
      return <CheckCircle2 className="size-4 text-teal-600" />;
    default:
      return <Bell className="size-4 text-slate-400" />;
  }
}

function relative(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

export function NotificationsBell() {
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
    } catch {
      return;
    }
    setItems(list);
    const ids = new Set(list.map(n => n.id));
    if (seen.current === null) {
      seen.current = ids;
    } else {
      for (const n of list) {
        if (!seen.current.has(n.id) && !n.read) toastRef.current.success(n.title);
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
          unread > 0 ? `Notifications, ${unread} non lues` : 'Notifications'
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
        {unread > 0 ? `${unread} notifications non lues` : ''}
      </span>

      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-label="Notifications"
            onClick={e => e.stopPropagation()}
            className="absolute right-2 top-14 flex max-h-[70dvh] w-[min(22rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
              <h3 className="font-semibold">Notifications</h3>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <button
                    onClick={() => void handleMarkAll()}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40"
                  >
                    <Check className="size-3.5" /> Tout lire
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Fermer"
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <ul className="min-h-0 flex-1 overflow-y-auto">
              {items.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-slate-400">
                  Aucune notification.
                </li>
              )}
              {items.map(n => (
                <NotificationRow
                  key={n.id}
                  n={n}
                  onOpen={handleOpen}
                  onMarkRead={handleMarkRead}
                  onDelete={id => void handleDelete(id)}
                />
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

const SWIPE_THRESHOLD = 64;

/**
 * Ligne de notification. Un GLISSEMENT latéral (tactile) sur une notification
 * non lue la marque comme lue ; un simple tap ouvre le raccourci.
 */
function NotificationRow({
  n,
  onOpen,
  onMarkRead,
  onDelete,
}: {
  n: Notification;
  onOpen: (n: Notification) => void;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [dx, setDx] = useState(0);
  const dxRef = useRef(0);
  const start = useRef({ x: 0, y: 0 });
  const axis = useRef<'none' | 'x' | 'y'>('none');
  const moved = useRef(false);
  const dragging = useRef(false);
  const swipeable = !n.read;

  function onTouchStart(e: React.TouchEvent) {
    if (!swipeable) return;
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    axis.current = 'none';
    moved.current = false;
    dragging.current = true;
  }
  function onTouchMove(e: React.TouchEvent) {
    if (!swipeable || !dragging.current) return;
    const dX = e.touches[0].clientX - start.current.x;
    const dY = e.touches[0].clientY - start.current.y;
    if (axis.current === 'none' && (Math.abs(dX) > 6 || Math.abs(dY) > 6)) {
      axis.current = Math.abs(dX) > Math.abs(dY) ? 'x' : 'y';
    }
    if (axis.current === 'x') {
      moved.current = true;
      const clamped = Math.max(-100, Math.min(100, dX));
      dxRef.current = clamped;
      setDx(clamped);
    }
  }
  function onTouchEnd() {
    if (!swipeable) return;
    dragging.current = false;
    if (axis.current === 'x' && Math.abs(dxRef.current) >= SWIPE_THRESHOLD) {
      onMarkRead(n.id);
    }
    dxRef.current = 0;
    setDx(0);
  }

  function handleClick() {
    if (moved.current) {
      moved.current = false;
      return;
    }
    onOpen(n);
  }

  return (
    <li className="relative overflow-hidden border-b border-slate-50 dark:border-slate-800/60">
      {swipeable && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-between bg-teal-100 px-4 text-sm font-semibold text-teal-700 dark:bg-teal-900/50 dark:text-teal-300"
          style={{ opacity: Math.min(1, Math.abs(dx) / SWIPE_THRESHOLD) }}
        >
          <span className="flex items-center gap-1">
            <Check className="size-4" /> Lu
          </span>
          <span className="flex items-center gap-1">
            <Check className="size-4" /> Lu
          </span>
        </div>
      )}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className={`group relative flex items-stretch ${
          n.read ? 'bg-white dark:bg-slate-900' : 'bg-teal-50 dark:bg-teal-950'
        }`}
        style={{
          transform: `translateX(${dx}px)`,
          transition: dragging.current ? 'none' : 'transform .2s ease',
        }}
      >
        <button
          onClick={handleClick}
          className="flex min-w-0 flex-1 items-start gap-2 px-3 py-2.5 text-left transition hover:bg-black/[0.03] dark:hover:bg-white/5"
        >
          <span className="mt-0.5 shrink-0">{iconFor(n.type)}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{n.title}</p>
            {n.body && (
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {n.body}
              </p>
            )}
            <p className="text-[10px] text-slate-400">{relative(n.created_at)}</p>
          </div>
          <ChevronRight className="size-4 shrink-0 self-center text-slate-300 opacity-0 transition group-hover:opacity-100" />
        </button>
        <button
          onClick={() => onDelete(n.id)}
          aria-label="Supprimer"
          className="shrink-0 px-2 text-slate-300 opacity-0 transition hover:text-slate-500 group-hover:opacity-100"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </li>
  );
}
