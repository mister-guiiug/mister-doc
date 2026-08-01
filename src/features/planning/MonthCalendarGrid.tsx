import type { MonthDay } from '../../lib/dates.ts';
import type { PlanningGridProps } from './gridTypes.ts';
import { DayCell } from './DayCell.tsx';
import { useI18n } from '../../i18n/index.ts';

// Référence stable pour les jours sans absence/vœu/HNC (mémoïsation de DayCell).
const EMPTY: never[] = [];

/**
 * Vue « grille » 7 colonnes (lundi → dimanche), pensée pour le desktop. Chaque
 * semaine ISO est une ligne, avec le numéro de semaine en gouttière. Les jours
 * hors du mois affiché restent vides pour aligner les colonnes.
 */
export function MonthCalendarGrid({
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
  const { m } = useI18n();
  const rows = weeks.map(({ week, days }) => {
    const cells: (MonthDay | null)[] = Array(7).fill(null);
    for (const d of days) cells[d.weekday] = d;
    return { week, cells };
  });

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
      {/* En-tête des colonnes */}
      <div className="grid grid-cols-[2.5rem_repeat(7,minmax(0,1fr))] border-b border-slate-200 bg-slate-50 text-center text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="py-1.5" />
        {m.common.weekdaysShort.map((d, i) => (
          <div
            key={i}
            className={`py-1.5 ${i >= 5 ? 'text-teal-700 dark:text-teal-400' : ''}`}
          >
            {d}
          </div>
        ))}
      </div>

      {rows.map(({ week, cells }) => (
        <div
          key={week}
          className="grid grid-cols-[2.5rem_repeat(7,minmax(0,1fr))] border-b border-slate-200 last:border-b-0 dark:border-slate-800"
        >
          <div className="grid place-items-center border-r border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
            {week}
          </div>
          {cells.map((day, i) =>
            day ? (
              <DayCell
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
            ) : (
              <div
                key={`empty-${week}-${i}`}
                className="min-h-24 border-r border-slate-100 bg-slate-50/40 last:border-r-0 dark:border-slate-800/60 dark:bg-slate-950/40"
              />
            )
          )}
        </div>
      ))}
    </div>
  );
}
