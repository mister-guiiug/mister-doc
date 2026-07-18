import { memo } from 'react';
import {
  AlertTriangle,
  Star,
  Plus,
  X,
  StickyNote,
  Lock,
  ThumbsUp,
  ThumbsDown,
  Heart,
  Clock3,
} from 'lucide-react';
import { WEEKDAY_LABELS } from '../../lib/dates.ts';
import { SHIFT_LABEL, SHIFT_HOURS, activeShiftTypes } from '../../lib/shifts.ts';
import { LEAVE_SHORT } from '../../lib/leaves.ts';
import type { Wish } from '../../backend/types.ts';
import type { PlanningGridProps, DayProps } from './gridTypes.ts';

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
  return (
    <div className="flex flex-col gap-5">
      {weeks.map(({ week, days }) => (
        <section key={week}>
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-bold text-white dark:bg-slate-200 dark:text-slate-900">
              Semaine {week}
            </span>
            <span className="text-xs text-slate-400">
              {days.length} jour{days.length > 1 ? 's' : ''}
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

const DayRow = memo(function DayRow({
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
  const types = activeShiftTypes(day.date);
  const missing = types.filter(t => !shiftIndex.has(`${day.iso}|${t}`)).length;
  const dim = (id?: string) => highlightId != null && id !== highlightId;
  const myWish = wishes.find(w => w.doctor_id === selfDoctorId)?.kind;
  const prefers = wishes.filter(w => w.kind === 'prefer');
  const avoids = wishes.filter(w => w.kind === 'avoid');
  const wishNames = (arr: Wish[]) =>
    arr.map(w => doctorsById.get(w.doctor_id)?.name ?? '?').join(', ');

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
              {WEEKDAY_LABELS[day.weekday]}
              {isToday && (
                <span className="rounded bg-teal-600 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-white">
                  Auj.
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
                <AlertTriangle className="size-3" /> {missing} à couvrir
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {types.map(type => {
            const shift = shiftIndex.get(`${day.iso}|${type}`);
            const doctor = shift ? doctorsById.get(shift.doctor_id) : undefined;
            const mine = shift?.doctor_id === selfDoctorId;
            return (
              <button
                key={type}
                disabled={locked}
                onClick={() => onSlotClick(day.iso, type)}
                className={`flex min-h-11 flex-col items-start gap-0.5 rounded-lg border px-2 py-1.5 text-left transition disabled:cursor-default ${
                  dim(shift?.doctor_id) ? 'opacity-30' : ''
                } ${
                  doctor
                    ? mine
                      ? 'border-teal-500 bg-teal-100/70 ring-1 ring-teal-500 dark:bg-teal-900/40'
                      : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800'
                    : 'border-dashed border-slate-300 bg-transparent dark:border-slate-700'
                } ${locked ? '' : 'hover:border-teal-400'}`}
                title={`${SHIFT_LABEL[type]} · ${SHIFT_HOURS[type]} h`}
              >
                <span className="flex w-full items-center justify-between text-[10px] font-semibold uppercase text-slate-400">
                  {type}
                  <span className="font-normal normal-case">
                    {SHIFT_HOURS[type]}h
                  </span>
                </span>
                {doctor ? (
                  <span className="flex items-center gap-1 truncate text-xs font-medium">
                    <span
                      className="inline-block size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: doctor.color }}
                    />
                    <span className="truncate">{doctor.name}</span>
                  </span>
                ) : (
                  <span className="text-xs text-slate-500 dark:text-slate-500">
                    libre
                  </span>
                )}
              </button>
            );
          })}
        </div>
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
        {leaves.map(lv => {
          const doc = doctorsById.get(lv.doctor_id);
          const isTraining = lv.kind === 'training';
          return (
            <button
              key={lv.id}
              disabled={locked}
              onClick={() => onRemoveLeave(lv)}
              title={locked ? undefined : 'Retirer cette absence'}
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
                · {LEAVE_SHORT[lv.kind]}
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
              onClick={() => onEditHnc(day.iso)}
              title="Heures non cliniques (cliquer pour modifier)"
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
            onClick={() => onEditHnc(day.iso)}
            className="flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[11px] font-medium text-slate-500 transition hover:border-sky-400 hover:text-sky-600 dark:border-slate-600"
          >
            <Clock3 className="size-3" /> HNC
          </button>
        )}

        {note ? (
          <button
            onClick={() => !locked && onEditNote(day.iso)}
            disabled={locked}
            className="flex items-center gap-1 rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 disabled:cursor-default dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
          >
            <StickyNote className="size-3" /> {note.note}
          </button>
        ) : (
          !locked && (
            <button
              onClick={() => onEditNote(day.iso)}
              className="flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[11px] font-medium text-slate-500 transition hover:border-slate-400 dark:border-slate-600"
            >
              <StickyNote className="size-3" /> Note
            </button>
          )
        )}

        {!locked && (
          <button
            onClick={() => onAddLeave(day.iso)}
            className="flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[11px] font-medium text-slate-500 transition hover:border-violet-400 hover:text-violet-600 dark:border-slate-600"
          >
            <Plus className="size-3" /> Congé / Formation
          </button>
        )}

        {/* Vœu : lecture seule sur un mois verrouillé (masqué si aucun vœu). */}
        {(myWish || !locked) && (
          <button
            onClick={() => !locked && onCycleWish(day.iso)}
            disabled={locked}
            title={
              locked
                ? 'Mois verrouillé'
                : 'Mon vœu : dispo / indispo (clic pour changer)'
            }
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
                <ThumbsUp className="size-3" /> Dispo
              </>
            ) : myWish === 'avoid' ? (
              <>
                <ThumbsDown className="size-3" /> Indispo
              </>
            ) : (
              <>
                <Heart className="size-3" /> Vœu
              </>
            )}
          </button>
        )}

        {(prefers.length > 0 || avoids.length > 0) && (
          <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
            {prefers.length > 0 && (
              <span title={`Dispo : ${wishNames(prefers)}`} className="flex items-center gap-0.5">
                <ThumbsUp className="size-3 text-emerald-500" />
                {prefers.length}
              </span>
            )}
            {avoids.length > 0 && (
              <span title={`Indispo : ${wishNames(avoids)}`} className="flex items-center gap-0.5">
                <ThumbsDown className="size-3 text-rose-500" />
                {avoids.length}
              </span>
            )}
          </span>
        )}

        {locked && (
          <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
            <Lock className="size-3" /> verrouillé
          </span>
        )}
      </div>
    </div>
  );
});
