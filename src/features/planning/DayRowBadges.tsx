import { X, Clock3 } from 'lucide-react';
import type { LeaveKind } from '../../lib/leaves.ts';
import type { Doctor, HncEntry, Leave } from '../../backend/types.ts';
import type { DayInfo } from './dayInfo.ts';
import { useI18n } from '../../i18n/index.ts';

/**
 * Pastilles « absences » et « heures non cliniques » d'une ligne de jour (vue
 * LISTE), plus le bouton d'ajout HNC. Renvoie un fragment : le conteneur
 * `flex-wrap` reste dans `DayRow` afin que le DOM soit strictement inchangé.
 */
interface DayRowBadgesProps {
  iso: string;
  leaves: Leave[];
  hnc: HncEntry[];
  doctorsById: Map<string, Doctor>;
  dim: DayInfo['dim'];
  locked: boolean;
  onRemoveLeave: (leave: Leave) => void;
  onEditHnc: (iso: string) => void;
}

export function DayRowBadges({
  iso,
  leaves,
  hnc,
  doctorsById,
  dim,
  locked,
  onRemoveLeave,
  onEditHnc,
}: DayRowBadgesProps) {
  const { t } = useI18n();
  const leaveShort = (kind: LeaveKind) =>
    kind === 'annual' ? t('leaves.annualShort') : t('leaves.trainingShort');

  return (
    <>
      {leaves.map(lv => {
        const doc = doctorsById.get(lv.doctor_id);
        const isTraining = lv.kind === 'training';
        return (
          <button
            key={lv.id}
            disabled={locked}
            onClick={() => onRemoveLeave(lv)}
            title={locked ? undefined : t('planning.removeLeave')}
            className={`group flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium disabled:cursor-default ${
              dim(lv.doctor_id) ? 'opacity-30' : ''
            } ${
              isTraining
                ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
                : 'border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200'
            }`}
          >
            <span
              className="inline-block size-2 shrink-0 rounded-full"
              style={{ backgroundColor: doc?.color ?? '#999' }}
            />
            <span className="truncate">{doc?.name ?? '?'}</span>
            <span className="opacity-70">
              · {leaveShort(lv.kind)}
              {isTraining && lv.hours != null ? ` ${lv.hours}h` : ''}
            </span>
            {!locked && (
              <X className="size-3 opacity-0 transition group-hover:opacity-100" />
            )}
          </button>
        );
      })}

      {hnc.map(entry => {
        const doc = doctorsById.get(entry.doctor_id);
        return (
          <button
            key={entry.id}
            onClick={() => onEditHnc(iso)}
            title={t('planning.hncEditTitle')}
            className={`flex items-center gap-1 rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200 ${
              dim(entry.doctor_id) ? 'opacity-30' : ''
            }`}
          >
            <Clock3 className="size-3" />
            <span
              className="inline-block size-2 shrink-0 rounded-full"
              style={{ backgroundColor: doc?.color ?? '#999' }}
            />
            <span className="truncate">{doc?.name ?? '?'}</span>
            <span className="opacity-70">· {entry.hours} h</span>
          </button>
        );
      })}

      {!locked && (
        <button
          onClick={() => onEditHnc(iso)}
          className="flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[11px] font-medium text-slate-500 transition hover:border-sky-400 hover:text-sky-600 dark:border-slate-600"
        >
          <Clock3 className="size-3" /> HNC
        </button>
      )}
    </>
  );
}
