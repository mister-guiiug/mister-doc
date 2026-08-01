import { memo } from 'react';
import { AlertTriangle, Star } from 'lucide-react';
import type { DayProps } from './gridTypes.ts';
import { computeDayInfo } from './dayInfo.ts';
import { DayRowSlots } from './DayRowSlots.tsx';
import { DayRowBadges } from './DayRowBadges.tsx';
import { DayRowActions } from './DayRowActions.tsx';
import { useI18n } from '../../i18n/index.ts';

/**
 * Une journée de la vue LISTE : en-tête (date, jour, férié, créneaux manquants),
 * créneaux, alertes puis barre d'actions. `memo` est VOLONTAIRE — un mois affiche
 * une trentaine de lignes et seule celle qui change doit se re-rendre ; les
 * tableaux passés en props viennent de `EMPTY` (référence stable) côté parent.
 */
export const DayRow = memo(function DayRow({
  day,
  shiftIndex,
  leaves,
  note,
  issues,
  wishes,
  hnc,
  doctorsById,
  selfDoctorId,
  highlightId,
  isToday,
  locked,
  onSlotClick,
  onAddLeave,
  onRemoveLeave,
  onEditNote,
  onCycleWish,
  onEditHnc,
  dayRefs,
}: DayProps) {
  const { t, m } = useI18n();
  // Lecture métier du jour : partagée avec MonthCalendarGrid (cf. dayInfo.ts).
  const { types, missing, dim, myWish, prefers, avoids } = computeDayInfo({
    day,
    shiftIndex,
    issues,
    wishes,
    selfDoctorId,
    highlightId,
  });

  return (
    <div
      ref={el => {
        dayRefs.current[day.iso] = el;
      }}
      aria-current={isToday ? 'date' : undefined}
      className={`scroll-mt-20 rounded-xl border p-2.5 ${
        isToday ? 'ring-2 ring-teal-500 dark:ring-teal-400 ' : ''
      }${
        day.reduced
          ? 'border-teal-200 bg-teal-50/60 dark:border-teal-900/60 dark:bg-teal-950/20'
          : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
      }`}
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[9rem_1fr] sm:items-center">
        <div className="flex items-center gap-2">
          <span
            className={`grid size-9 shrink-0 place-items-center rounded-lg text-sm font-bold ${
              day.reduced
                ? 'bg-teal-600 text-white'
                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
            }`}
          >
            {day.date.getDate()}
          </span>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="flex items-center gap-1.5 text-sm font-medium">
              {m.common.weekdays[day.weekday]}
              {isToday && (
                <span className="rounded bg-teal-600 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-white">
                  {t('common.today')}
                </span>
              )}
            </span>
            {day.holiday && (
              <span className="flex items-center gap-1 truncate text-[11px] font-medium text-amber-600">
                <Star className="size-3 shrink-0" />
                <span className="truncate">{day.holidayName}</span>
              </span>
            )}
            {missing > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-red-500">
                <AlertTriangle className="size-3" />{' '}
                {t('planning.toCover', { count: missing })}
              </span>
            )}
          </div>
        </div>

        <DayRowSlots
          iso={day.iso}
          types={types}
          shiftIndex={shiftIndex}
          doctorsById={doctorsById}
          selfDoctorId={selfDoctorId}
          dim={dim}
          locked={locked}
          onSlotClick={onSlotClick}
        />
      </div>

      {/* Alertes du jour */}
      {issues.length > 0 && (
        <div className="mt-2 flex flex-col gap-0.5 sm:pl-[9.5rem]">
          {issues.map((iss, i) => (
            <span
              key={i}
              className={`flex items-center gap-1 text-[11px] font-medium ${
                iss.level === 'error' ? 'text-red-600' : 'text-amber-600'
              }`}
            >
              <AlertTriangle className="size-3 shrink-0" /> {iss.message}
            </span>
          ))}
        </div>
      )}

      {/* Absences + note */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:pl-[9.5rem]">
        <DayRowBadges
          iso={day.iso}
          leaves={leaves}
          hnc={hnc}
          doctorsById={doctorsById}
          dim={dim}
          locked={locked}
          onRemoveLeave={onRemoveLeave}
          onEditHnc={onEditHnc}
        />
        <DayRowActions
          iso={day.iso}
          note={note}
          locked={locked}
          myWish={myWish}
          prefers={prefers}
          avoids={avoids}
          doctorsById={doctorsById}
          onAddLeave={onAddLeave}
          onEditNote={onEditNote}
          onCycleWish={onCycleWish}
        />
      </div>
    </div>
  );
});
