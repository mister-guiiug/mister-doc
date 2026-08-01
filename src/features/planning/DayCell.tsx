import { memo } from 'react';
import { AlertTriangle, Star } from 'lucide-react';
import { shiftHours } from '../../lib/shifts.ts';
import type { DayProps } from './gridTypes.ts';
import { computeDayInfo } from './dayInfo.ts';
import { DayCellBadges } from './DayCellBadges.tsx';
import { DayCellFooter } from './DayCellFooter.tsx';
import { useI18n } from '../../i18n/index.ts';

/**
 * Une case de la grille 7 colonnes : date et compteurs d'anomalies, créneaux,
 * absences/HNC puis le pied d'actions. `memo` est VOLONTAIRE — un mois affiche
 * jusqu'à 42 cases et seule celle qui change doit se re-rendre ; les tableaux
 * passés en props viennent de `EMPTY` (référence stable) côté parent.
 */
export const DayCell = memo(function DayCell({
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
  const { t } = useI18n();
  // Lecture métier du jour : partagée avec MonthGrid (cf. dayInfo.ts).
  const info = computeDayInfo({
    day,
    shiftIndex,
    issues,
    wishes,
    selfDoctorId,
    highlightId,
  });
  const { types, missing, dim, myWish, hasError } = info;
  const prefers = info.prefers.length;
  const avoids = info.avoids.length;

  return (
    <div
      ref={el => {
        dayRefs.current[day.iso] = el;
      }}
      aria-current={isToday ? 'date' : undefined}
      className={`group/cell scroll-mt-20 flex min-h-24 flex-col gap-1 border-r border-slate-100 p-1.5 last:border-r-0 dark:border-slate-800/60 ${
        isToday ? 'ring-2 ring-inset ring-teal-500 dark:ring-teal-400 ' : ''
      }${
        day.reduced
          ? 'bg-teal-50/50 dark:bg-teal-950/20'
          : 'bg-white dark:bg-slate-900'
      }`}
    >
      {/* Date + alertes */}
      <div className="flex items-start justify-between">
        <span
          className={`grid size-6 place-items-center rounded-md text-xs font-bold ${
            isToday
              ? 'bg-teal-700 text-white ring-2 ring-teal-300 dark:ring-teal-600'
              : day.reduced
                ? 'bg-teal-700 text-white'
                : 'text-slate-700 dark:text-slate-200'
          }`}
        >
          {day.date.getDate()}
        </span>
        <div className="flex items-center gap-1">
          {day.holiday && (
            <Star
              className="size-3.5 text-amber-500"
              aria-label={day.holidayName ?? t('planning.holiday')}
            />
          )}
          {issues.length > 0 && (
            <span
              title={issues.map(i => i.message).join('\n')}
              className={`flex items-center gap-0.5 rounded px-1 text-[10px] font-bold ${
                hasError
                  ? 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
              }`}
            >
              <AlertTriangle className="size-2.5" />
              {issues.length}
            </span>
          )}
          {missing > 0 && (
            <span
              title={t('planning.slotsToCover', { count: missing })}
              className="flex items-center gap-0.5 rounded bg-red-100 px-1 text-[10px] font-bold text-red-600 dark:bg-red-950/50 dark:text-red-300"
            >
              <AlertTriangle className="size-2.5" />
              {missing}
            </span>
          )}
        </div>
      </div>

      {/* Créneaux */}
      <div className="flex flex-col gap-0.5">
        {types.map(type => {
          const shift = shiftIndex.get(`${day.iso}|${type}`);
          const doctor = shift ? doctorsById.get(shift.doctor_id) : undefined;
          const mine = shift?.doctor_id === selfDoctorId;
          return (
            <button
              key={type}
              disabled={locked}
              onClick={() => onSlotClick(day.iso, type)}
              title={`${type} · ${shiftHours(type)} h`}
              className={`flex items-center gap-1 rounded border px-1 py-0.5 text-left text-[11px] transition disabled:cursor-default ${
                dim(shift?.doctor_id) ? 'opacity-30' : ''
              } ${
                doctor
                  ? mine
                    ? 'border-teal-500 bg-teal-100/70 dark:bg-teal-900/40'
                    : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800'
                  : 'border-dashed border-slate-300 dark:border-slate-700'
              } ${locked ? '' : 'hover:border-teal-400'}`}
            >
              <span className="font-semibold uppercase text-slate-600 dark:text-slate-400">
                {type}
              </span>
              {doctor ? (
                <>
                  <span
                    className="inline-block size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: doctor.color }}
                  />
                  <span className="truncate">{doctor.name}</span>
                </>
              ) : (
                <span className="text-slate-600 dark:text-slate-400">
                  {t('common.free')}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <DayCellBadges
        iso={day.iso}
        leaves={leaves}
        hnc={hnc}
        doctorsById={doctorsById}
        dim={dim}
        locked={locked}
        onRemoveLeave={onRemoveLeave}
        onEditHnc={onEditHnc}
      />

      {/* Pied : note, vœux, actions au survol */}
      <DayCellFooter
        iso={day.iso}
        note={note}
        locked={locked}
        myWish={myWish}
        prefers={prefers}
        avoids={avoids}
        onAddLeave={onAddLeave}
        onEditNote={onEditNote}
        onCycleWish={onCycleWish}
        onEditHnc={onEditHnc}
      />
    </div>
  );
});
