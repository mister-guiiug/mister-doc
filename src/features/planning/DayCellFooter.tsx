import {
  Plus,
  StickyNote,
  Lock,
  ThumbsUp,
  ThumbsDown,
  Heart,
  Clock3,
} from 'lucide-react';
import type { DayNote } from '../../backend/types.ts';
import type { DayInfo } from './dayInfo.ts';
import { useI18n } from '../../i18n/index.ts';

/**
 * Pied d'une case de la grille 7 colonnes : note, vœu personnel, décompte des
 * vœux des autres, puis les actions qui n'apparaissent qu'au survol de la case
 * (classe `group-hover/cell` posée par `DayCell`).
 */
interface DayCellFooterProps {
  iso: string;
  note?: DayNote;
  locked: boolean;
  myWish: DayInfo['myWish'];
  prefers: number;
  avoids: number;
  onAddLeave: (iso: string) => void;
  onEditNote: (iso: string) => void;
  onCycleWish: (iso: string) => void;
  onEditHnc: (iso: string) => void;
}

export function DayCellFooter({
  iso,
  note,
  locked,
  myWish,
  prefers,
  avoids,
  onAddLeave,
  onEditNote,
  onCycleWish,
  onEditHnc,
}: DayCellFooterProps) {
  const { t } = useI18n();
  return (
    <div className="mt-auto flex items-center gap-1 pt-0.5">
      {note && (
        <button
          onClick={() => !locked && onEditNote(iso)}
          disabled={locked}
          title={note.note}
          className="text-slate-400 disabled:cursor-default hover:text-slate-600"
        >
          <StickyNote className="size-3.5" />
        </button>
      )}
      {myWish && (
        <button
          onClick={() => !locked && onCycleWish(iso)}
          disabled={locked}
          title={
            locked ? t('planning.monthLocked') : t('planning.wishShortTitle')
          }
          className={`disabled:cursor-default ${
            myWish === 'prefer' ? 'text-emerald-500' : 'text-rose-500'
          }`}
        >
          {myWish === 'prefer' ? (
            <ThumbsUp className="size-3.5" />
          ) : (
            <ThumbsDown className="size-3.5" />
          )}
        </button>
      )}
      {prefers + avoids > 0 && (
        <span className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
          {prefers > 0 && (
            <span className="flex items-center gap-0.5">
              <ThumbsUp className="size-2.5 text-emerald-500" />
              {prefers}
            </span>
          )}
          {avoids > 0 && (
            <span className="flex items-center gap-0.5">
              <ThumbsDown className="size-2.5 text-rose-500" />
              {avoids}
            </span>
          )}
        </span>
      )}

      {locked ? (
        <Lock className="ml-auto size-3 text-slate-300" />
      ) : (
        <span className="ml-auto flex items-center gap-1 opacity-0 transition group-hover/cell:opacity-100">
          <button
            onClick={() => onCycleWish(iso)}
            title={t('planning.wishCycleTitle')}
            className="text-slate-400 hover:text-teal-600"
          >
            <Heart className="size-3.5" />
          </button>
          {!note && (
            <button
              onClick={() => onEditNote(iso)}
              title={t('planning.addNoteTitle')}
              className="text-slate-400 hover:text-teal-600"
            >
              <StickyNote className="size-3.5" />
            </button>
          )}
          <button
            onClick={() => onAddLeave(iso)}
            title={t('planning.leaveOrTraining')}
            className="text-slate-400 hover:text-violet-600"
          >
            <Plus className="size-3.5" />
          </button>
          <button
            onClick={() => onEditHnc(iso)}
            title={t('planning.hncTitle')}
            className="text-slate-400 hover:text-sky-600"
          >
            <Clock3 className="size-3.5" />
          </button>
        </span>
      )}
    </div>
  );
}
