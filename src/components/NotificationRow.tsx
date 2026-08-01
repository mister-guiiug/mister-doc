import { useRef, useState } from 'react';
import { Check, ChevronRight, X } from 'lucide-react';
import { iconFor } from './NotificationIcon.tsx';
import { useI18n } from '../i18n/index.ts';
import type { Notification } from '../backend/types.ts';

const SWIPE_THRESHOLD = 64;

/**
 * Ligne de notification. Un GLISSEMENT latéral (tactile) sur une notification
 * non lue la marque comme lue ; un simple tap ouvre le raccourci.
 */
export function NotificationRow({
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
  const { t } = useI18n();
  // Heure relative traduite : volontairement locale (et non `timeAgo` de
  // `lib/relativeTime.ts`, codé en dur en français) pour rester i18n-aware.
  const relative = (iso: string): string => {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return t('notifications.relativeNow');
    if (diff < 3600)
      return t('notifications.relativeMin', { n: Math.floor(diff / 60) });
    if (diff < 86400)
      return t('notifications.relativeHour', { n: Math.floor(diff / 3600) });
    return t('notifications.relativeDay', { n: Math.floor(diff / 86400) });
  };
  const [dx, setDx] = useState(0);
  const dxRef = useRef(0);
  const start = useRef({ x: 0, y: 0 });
  const axis = useRef<'none' | 'x' | 'y'>('none');
  const moved = useRef(false);
  const dragging = useRef(false);
  const swipeable = !n.read;

  function onTouchStart(e: React.TouchEvent) {
    if (!swipeable) return;
    const t = e.touches[0];
    if (!t) return;
    start.current = { x: t.clientX, y: t.clientY };
    axis.current = 'none';
    moved.current = false;
    dragging.current = true;
  }
  function onTouchMove(e: React.TouchEvent) {
    if (!swipeable || !dragging.current) return;
    const t = e.touches[0];
    if (!t) return;
    const dX = t.clientX - start.current.x;
    const dY = t.clientY - start.current.y;
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
            <Check className="size-4" /> {t('notifications.read')}
          </span>
          <span className="flex items-center gap-1">
            <Check className="size-4" /> {t('notifications.read')}
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
            <p className="text-[10px] text-slate-400">
              {relative(n.created_at)}
            </p>
          </div>
          <ChevronRight className="size-4 shrink-0 self-center text-slate-300 opacity-0 transition group-hover:opacity-100" />
        </button>
        <button
          onClick={() => onDelete(n.id)}
          aria-label={t('notifications.delete')}
          className="shrink-0 px-2 text-slate-300 opacity-0 transition hover:text-slate-500 group-hover:opacity-100"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </li>
  );
}
