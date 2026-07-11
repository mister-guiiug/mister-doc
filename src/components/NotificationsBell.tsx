import { useEffect, useState } from 'react';
import {
  Bell,
  X,
  Check,
  CalendarPlus,
  CalendarX,
  CalendarOff,
  UserPlus,
  CheckCircle2,
} from 'lucide-react';
import {
  deleteNotification,
  listNotifications,
  markAllRead,
  subscribeNotifications,
} from '../backend/notifications.ts';
import type { Notification } from '../backend/types.ts';

function iconFor(type: string) {
  switch (type) {
    case 'shift_assigned':
      return <CalendarPlus className="size-4 text-teal-600" />;
    case 'shift_removed':
      return <CalendarX className="size-4 text-red-500" />;
    case 'leave_added':
      return <CalendarOff className="size-4 text-violet-600" />;
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

  const load = () => listNotifications().then(setItems).catch(() => {});

  useEffect(() => {
    load();
    return subscribeNotifications(load);
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

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Notifications"
        className="relative rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4 text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

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
                <li
                  key={n.id}
                  className={`group flex items-start gap-2 border-b border-slate-50 px-3 py-2.5 dark:border-slate-800/60 ${
                    n.read ? '' : 'bg-teal-50/40 dark:bg-teal-950/20'
                  }`}
                >
                  <span className="mt-0.5 shrink-0">{iconFor(n.type)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.body && (
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {n.body}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400">
                      {relative(n.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => void handleDelete(n.id)}
                    aria-label="Supprimer"
                    className="shrink-0 rounded p-1 text-slate-300 opacity-0 transition hover:text-slate-500 group-hover:opacity-100"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
