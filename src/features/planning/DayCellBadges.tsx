import { Clock3 } from 'lucide-react';
import type { LeaveKind } from '../../lib/leaves.ts';
import type { Doctor, HncEntry, Leave } from '../../backend/types.ts';
import type { DayInfo } from './dayInfo.ts';
import { useI18n } from '../../i18n/index.ts';

/**
 * Pastilles « absences » et « heures non cliniques » d'une case de la grille
 * 7 colonnes. Version très compacte (initiales et heures seulement, infobulle
 * pour le détail) : elle ne partage pas de JSX avec la vue liste, d'où un
 * composant dédié plutôt qu'un composant commun plein de conditions.
 */
interface DayCellBadgesProps {
  iso: string;
  leaves: Leave[];
  hnc: HncEntry[];
  doctorsById: Map<string, Doctor>;
  dim: DayInfo['dim'];
  locked: boolean;
  onRemoveLeave: (leave: Leave) => void;
  onEditHnc: (iso: string) => void;
}

export function DayCellBadges({
  iso,
  leaves,
  hnc,
  doctorsById,
  dim,
  locked,
  onRemoveLeave,
  onEditHnc,
}: DayCellBadgesProps) {
  const { t } = useI18n();
  const leaveShort = (kind: LeaveKind) =>
    kind === 'annual' ? t('leaves.annualShort') : t('leaves.trainingShort');

  return (
    <>
      {/* Absences */}
      {leaves.length > 0 && (
        <div className="flex flex-wrap gap-0.5">
          {leaves.map(lv => {
            const doc = doctorsById.get(lv.doctor_id);
            const isTraining = lv.kind === 'training';
            const short = `${leaveShort(lv.kind)}${
              isTraining && lv.hours != null ? ` ${lv.hours}h` : ''
            }`;
            return (
              <button
                key={lv.id}
                disabled={locked}
                onClick={() => onRemoveLeave(lv)}
                title={
                  locked
                    ? t('planning.leaveTitleLocked', {
                        name: doc?.name ?? '?',
                        short,
                      })
                    : t('planning.leaveTitleRemove', {
                        name: doc?.name ?? '?',
                        short,
                      })
                }
                className={`flex items-center gap-0.5 rounded-full border px-1 text-[10px] disabled:cursor-default ${
                  dim(lv.doctor_id) ? 'opacity-30' : ''
                } ${
                  isTraining
                    ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
                    : 'border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200'
                }`}
              >
                <span
                  className="inline-block size-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: doc?.color ?? '#999' }}
                />
                {leaveShort(lv.kind)}
              </button>
            );
          })}
        </div>
      )}

      {/* Heures non cliniques */}
      {hnc.length > 0 && (
        <div className="flex flex-wrap gap-0.5">
          {hnc.map(entry => {
            const doc = doctorsById.get(entry.doctor_id);
            return (
              <button
                key={entry.id}
                disabled={locked}
                onClick={() => onEditHnc(iso)}
                title={
                  locked
                    ? t('planning.hncHoursTitle', {
                        name: doc?.name ?? '?',
                        hours: entry.hours,
                      })
                    : t('planning.hncHoursTitleEdit', {
                        name: doc?.name ?? '?',
                        hours: entry.hours,
                      })
                }
                className={`flex items-center gap-0.5 rounded-full border border-sky-300 bg-sky-50 px-1 text-[10px] text-sky-800 disabled:cursor-default dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200 ${
                  dim(entry.doctor_id) ? 'opacity-30' : ''
                }`}
              >
                <Clock3 className="size-2.5" />
                <span
                  className="inline-block size-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: doc?.color ?? '#999' }}
                />
                {entry.hours}h
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
