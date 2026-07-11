import { AlertTriangle, Star } from 'lucide-react';
import type { MonthDay } from '../../lib/dates.ts';
import { WEEKDAY_LABELS } from '../../lib/dates.ts';
import {
  SHIFT_LABEL,
  SHIFT_HOURS,
  activeShiftTypes,
  type ShiftType,
} from '../../lib/shifts.ts';
import type { Doctor, Shift } from '../../backend/types.ts';

export function MonthGrid({
  weeks,
  shiftIndex,
  doctorsById,
  selfDoctorId,
  onSlotClick,
}: {
  weeks: { week: number; days: MonthDay[] }[];
  shiftIndex: Map<string, Shift>;
  doctorsById: Map<string, Doctor>;
  selfDoctorId: string;
  onSlotClick: (iso: string, shiftType: ShiftType) => void;
}) {
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
                doctorsById={doctorsById}
                selfDoctorId={selfDoctorId}
                onSlotClick={onSlotClick}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function DayRow({
  day,
  shiftIndex,
  doctorsById,
  selfDoctorId,
  onSlotClick,
}: {
  day: MonthDay;
  shiftIndex: Map<string, Shift>;
  doctorsById: Map<string, Doctor>;
  selfDoctorId: string;
  onSlotClick: (iso: string, shiftType: ShiftType) => void;
}) {
  const types = activeShiftTypes(day.date);
  const missing = types.filter(t => !shiftIndex.has(`${day.iso}|${t}`)).length;

  return (
    <div
      className={`grid grid-cols-1 gap-2 rounded-xl border p-2.5 sm:grid-cols-[9rem_1fr] sm:items-center ${
        day.reduced
          ? 'border-teal-200 bg-teal-50/60 dark:border-teal-900/60 dark:bg-teal-950/20'
          : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
      }`}
    >
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
          <span className="text-sm font-medium">
            {WEEKDAY_LABELS[day.weekday]}
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
              onClick={() => onSlotClick(day.iso, type)}
              className={`flex min-h-11 flex-col items-start gap-0.5 rounded-lg border px-2 py-1.5 text-left transition hover:border-teal-400 ${
                doctor
                  ? mine
                    ? 'border-teal-500 bg-teal-100/70 ring-1 ring-teal-500 dark:bg-teal-900/40'
                    : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800'
                  : 'border-dashed border-slate-300 bg-transparent dark:border-slate-700'
              }`}
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
                <span className="text-xs text-slate-300 dark:text-slate-600">
                  libre
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
