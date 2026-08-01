import {
  Plus,
  StickyNote,
  Lock,
  ThumbsUp,
  ThumbsDown,
  Heart,
} from 'lucide-react';
import type { DayNote, Doctor, Wish } from '../../backend/types.ts';
import type { DayInfo } from './dayInfo.ts';
import { useI18n } from '../../i18n/index.ts';

/**
 * Fin de la barre d'actions d'une ligne de jour (vue LISTE) : note, ajout
 * d'absence, vœu personnel, décompte des vœux des autres et mention « verrouillé ».
 * Renvoie un fragment pour laisser le conteneur `flex-wrap` dans `DayRow` : le
 * DOM produit est identique à l'ancien code inline.
 */
interface DayRowActionsProps {
  iso: string;
  note?: DayNote;
  locked: boolean;
  myWish: DayInfo['myWish'];
  prefers: Wish[];
  avoids: Wish[];
  doctorsById: Map<string, Doctor>;
  onAddLeave: (iso: string) => void;
  onEditNote: (iso: string) => void;
  onCycleWish: (iso: string) => void;
}

export function DayRowActions({
  iso,
  note,
  locked,
  myWish,
  prefers,
  avoids,
  doctorsById,
  onAddLeave,
  onEditNote,
  onCycleWish,
}: DayRowActionsProps) {
  const { t } = useI18n();
  const wishNames = (arr: Wish[]) =>
    arr.map(w => doctorsById.get(w.doctor_id)?.name ?? '?').join(', ');

  return (
    <>
      {note ? (
        <button
          onClick={() => !locked && onEditNote(iso)}
          disabled={locked}
          className="flex items-center gap-1 rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 disabled:cursor-default dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
        >
          <StickyNote className="size-3" /> {note.note}
        </button>
      ) : (
        !locked && (
          <button
            onClick={() => onEditNote(iso)}
            className="flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[11px] font-medium text-slate-500 transition hover:border-slate-400 dark:border-slate-600"
          >
            <StickyNote className="size-3" /> {t('planning.note')}
          </button>
        )
      )}

      {!locked && (
        <button
          onClick={() => onAddLeave(iso)}
          className="flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[11px] font-medium text-slate-500 transition hover:border-violet-400 hover:text-violet-600 dark:border-slate-600"
        >
          <Plus className="size-3" /> {t('planning.leaveOrTraining')}
        </button>
      )}

      {/* Vœu : lecture seule sur un mois verrouillé (masqué si aucun vœu). */}
      {(myWish || !locked) && (
        <button
          onClick={() => !locked && onCycleWish(iso)}
          disabled={locked}
          title={locked ? t('planning.monthLocked') : t('planning.wishTitle')}
          className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition disabled:cursor-default ${
            myWish === 'prefer'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
              : myWish === 'avoid'
                ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                : 'border-dashed border-slate-300 text-slate-500 dark:border-slate-600'
          }`}
        >
          {myWish === 'prefer' ? (
            <>
              <ThumbsUp className="size-3" /> {t('planning.wishAvailable')}
            </>
          ) : myWish === 'avoid' ? (
            <>
              <ThumbsDown className="size-3" /> {t('planning.wishUnavailable')}
            </>
          ) : (
            <>
              <Heart className="size-3" /> {t('planning.wish')}
            </>
          )}
        </button>
      )}

      {(prefers.length > 0 || avoids.length > 0) && (
        <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
          {prefers.length > 0 && (
            <span
              title={t('planning.availableList', {
                names: wishNames(prefers),
              })}
              className="flex items-center gap-0.5"
            >
              <ThumbsUp className="size-3 text-emerald-500" />
              {prefers.length}
            </span>
          )}
          {avoids.length > 0 && (
            <span
              title={t('planning.unavailableList', {
                names: wishNames(avoids),
              })}
              className="flex items-center gap-0.5"
            >
              <ThumbsDown className="size-3 text-rose-500" />
              {avoids.length}
            </span>
          )}
        </span>
      )}

      {locked && (
        <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
          <Lock className="size-3" /> {t('planning.locked')}
        </span>
      )}
    </>
  );
}
