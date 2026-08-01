import type { PlanningGridProps } from './gridTypes.ts';
import { DayRow } from './DayRow.tsx';
import { useI18n } from '../../i18n/index.ts';

// Référence stable pour les jours sans absence/alerte/vœu/HNC : évite de créer
// un nouveau `[]` à chaque rendu, ce qui casserait la mémoïsation de `DayRow`.
const EMPTY: never[] = [];

export function MonthGrid({
  weeks,
  shiftIndex,
  leavesByDate,
  notesByDate,
  issuesByDate,
  wishesByDate,
  hncByDate,
  doctorsById,
  selfDoctorId,
  highlightId,
  todayIso,
  locked,
  onSlotClick,
  onAddLeave,
  onRemoveLeave,
  onEditNote,
  onCycleWish,
  onEditHnc,
  dayRefs,
}: PlanningGridProps) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-5">
      {weeks.map(({ week, days }) => (
        <section key={week}>
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-bold text-white dark:bg-slate-200 dark:text-slate-900">
              {t('planning.week', { week })}
            </span>
            <span className="text-xs text-slate-400">
              {days.length > 1
                ? t('planning.dayCountMany', { count: days.length })
                : t('planning.dayCountOne', { count: days.length })}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            {days.map(day => (
              <DayRow
                key={day.iso}
                day={day}
                shiftIndex={shiftIndex}
                leaves={leavesByDate.get(day.iso) ?? EMPTY}
                note={notesByDate.get(day.iso)}
                issues={issuesByDate.get(day.iso) ?? EMPTY}
                wishes={wishesByDate.get(day.iso) ?? EMPTY}
                hnc={hncByDate.get(day.iso) ?? EMPTY}
                doctorsById={doctorsById}
                selfDoctorId={selfDoctorId}
                highlightId={highlightId}
                isToday={day.iso === todayIso}
                locked={locked}
                onSlotClick={onSlotClick}
                onAddLeave={onAddLeave}
                onRemoveLeave={onRemoveLeave}
                onEditNote={onEditNote}
                onCycleWish={onCycleWish}
                onEditHnc={onEditHnc}
                dayRefs={dayRefs}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
