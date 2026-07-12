import {
  AlertTriangle,
  Star,
  Plus,
  StickyNote,
  Lock,
  ThumbsUp,
  ThumbsDown,
  Heart,
  Clock3,
} from 'lucide-react';
import type { MonthDay } from '../../lib/dates.ts';
import { activeShiftTypes, SHIFT_HOURS, type ShiftType } from '../../lib/shifts.ts';
import { LEAVE_SHORT } from '../../lib/leaves.ts';
import type {
  Doctor,
  DayNote,
  HncEntry,
  Leave,
  Shift,
  Wish,
} from '../../backend/types.ts';

const DAY_HEADERS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;

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
  wishesByDate,
  hncByDate,
  doctorsById,
  selfDoctorId,
  highlightId,
  locked,
  onSlotClick,
  onAddLeave,
  onRemoveLeave,
  onEditNote,
  onCycleWish,
  onEditHnc,
  dayRefs,
}: {
  weeks: { week: number; days: MonthDay[] }[];
  shiftIndex: Map<string, Shift>;
  leavesByDate: Map<string, Leave[]>;
  notesByDate: Map<string, DayNote>;
  wishesByDate: Map<string, Wish[]>;
  hncByDate: Map<string, HncEntry[]>;
  doctorsById: Map<string, Doctor>;
  selfDoctorId: string;
  highlightId: string | null;
  locked: boolean;
  onSlotClick: (iso: string, shiftType: ShiftType) => void;
  onAddLeave: (iso: string) => void;
  onRemoveLeave: (leave: Leave) => void;
  onEditNote: (iso: string) => void;
  onCycleWish: (iso: string) => void;
  onEditHnc: (iso: string) => void;
  dayRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
}) {
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
        {DAY_HEADERS.map((d, i) => (
          <div
            key={d}
            className={`py-1.5 ${i >= 5 ? 'text-teal-600 dark:text-teal-400' : ''}`}
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
          <div className="grid place-items-center border-r border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-400 dark:border-slate-800 dark:bg-slate-900/60">
            {week}
          </div>
          {cells.map((day, i) =>
            day ? (
              <DayCell
                key={day.iso}
                day={day}
                shiftIndex={shiftIndex}
                leaves={leavesByDate.get(day.iso) ?? []}
                note={notesByDate.get(day.iso)}
                wishes={wishesByDate.get(day.iso) ?? []}
                hnc={hncByDate.get(day.iso) ?? []}
                doctorsById={doctorsById}
                selfDoctorId={selfDoctorId}
                highlightId={highlightId}
                locked={locked}
                onSlotClick={onSlotClick}
                onAddLeave={onAddLeave}
                onRemoveLeave={onRemoveLeave}
                onEditNote={onEditNote}
                onCycleWish={onCycleWish}
                onEditHnc={onEditHnc}
                setRef={el => (dayRefs.current[day.iso] = el)}
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

function DayCell({
  day,
  shiftIndex,
  leaves,
  note,
  wishes,
  hnc,
  doctorsById,
  selfDoctorId,
  highlightId,
  locked,
  onSlotClick,
  onAddLeave,
  onRemoveLeave,
  onEditNote,
  onCycleWish,
  onEditHnc,
  setRef,
}: {
  day: MonthDay;
  shiftIndex: Map<string, Shift>;
  leaves: Leave[];
  note?: DayNote;
  wishes: Wish[];
  hnc: HncEntry[];
  doctorsById: Map<string, Doctor>;
  selfDoctorId: string;
  highlightId: string | null;
  locked: boolean;
  onSlotClick: (iso: string, shiftType: ShiftType) => void;
  onAddLeave: (iso: string) => void;
  onRemoveLeave: (leave: Leave) => void;
  onEditNote: (iso: string) => void;
  onCycleWish: (iso: string) => void;
  onEditHnc: (iso: string) => void;
  setRef: (el: HTMLDivElement | null) => void;
}) {
  const types = activeShiftTypes(day.date);
  const missing = types.filter(t => !shiftIndex.has(`${day.iso}|${t}`)).length;
  const dim = (id?: string) => highlightId != null && id !== highlightId;
  const myWish = wishes.find(w => w.doctor_id === selfDoctorId)?.kind;
  const prefers = wishes.filter(w => w.kind === 'prefer').length;
  const avoids = wishes.filter(w => w.kind === 'avoid').length;

  return (
    <div
      ref={setRef}
      className={`group/cell scroll-mt-20 flex min-h-24 flex-col gap-1 border-r border-slate-100 p-1.5 last:border-r-0 dark:border-slate-800/60 ${
        day.reduced
          ? 'bg-teal-50/50 dark:bg-teal-950/20'
          : 'bg-white dark:bg-slate-900'
      }`}
    >
      {/* Date + alertes */}
      <div className="flex items-start justify-between">
        <span
          className={`grid size-6 place-items-center rounded-md text-xs font-bold ${
            day.reduced
              ? 'bg-teal-600 text-white'
              : 'text-slate-700 dark:text-slate-200'
          }`}
        >
          {day.date.getDate()}
        </span>
        <div className="flex items-center gap-1">
          {day.holiday && (
            <Star
              className="size-3.5 text-amber-500"
              aria-label={day.holidayName ?? 'Férié'}
            />
          )}
          {missing > 0 && (
            <span
              title={`${missing} créneau(x) à couvrir`}
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
              title={`${type} · ${SHIFT_HOURS[type]} h`}
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
              <span className="font-semibold uppercase text-slate-400">
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
                <span className="text-slate-400">libre</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Absences */}
      {leaves.length > 0 && (
        <div className="flex flex-wrap gap-0.5">
          {leaves.map(lv => {
            const doc = doctorsById.get(lv.doctor_id);
            const isTraining = lv.kind === 'training';
            return (
              <button
                key={lv.id}
                disabled={locked}
                onClick={() => onRemoveLeave(lv)}
                title={`${doc?.name ?? '?'} · ${LEAVE_SHORT[lv.kind]}${
                  isTraining && lv.hours != null ? ` ${lv.hours}h` : ''
                }${locked ? '' : ' — retirer'}`}
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
                {LEAVE_SHORT[lv.kind]}
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
                onClick={() => onEditHnc(day.iso)}
                title={`${doc?.name ?? '?'} · ${entry.hours} h non cliniques${locked ? '' : ' — modifier'}`}
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

      {/* Pied : note, vœux, actions au survol */}
      <div className="mt-auto flex items-center gap-1 pt-0.5">
        {note && (
          <button
            onClick={() => !locked && onEditNote(day.iso)}
            disabled={locked}
            title={note.note}
            className="text-slate-400 disabled:cursor-default hover:text-slate-600"
          >
            <StickyNote className="size-3.5" />
          </button>
        )}
        {myWish && (
          <button
            onClick={() => onCycleWish(day.iso)}
            title="Mon vœu (clic pour changer)"
            className={myWish === 'prefer' ? 'text-emerald-500' : 'text-rose-500'}
          >
            {myWish === 'prefer' ? (
              <ThumbsUp className="size-3.5" />
            ) : (
              <ThumbsDown className="size-3.5" />
            )}
          </button>
        )}
        {prefers + avoids > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-slate-400">
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
              onClick={() => onCycleWish(day.iso)}
              title="Vœu / dispo / indispo"
              className="text-slate-400 hover:text-teal-600"
            >
              <Heart className="size-3.5" />
            </button>
            {!note && (
              <button
                onClick={() => onEditNote(day.iso)}
                title="Ajouter une note"
                className="text-slate-400 hover:text-teal-600"
              >
                <StickyNote className="size-3.5" />
              </button>
            )}
            <button
              onClick={() => onAddLeave(day.iso)}
              title="Congé / Formation"
              className="text-slate-400 hover:text-violet-600"
            >
              <Plus className="size-3.5" />
            </button>
            <button
              onClick={() => onEditHnc(day.iso)}
              title="Heures non cliniques"
              className="text-slate-400 hover:text-sky-600"
            >
              <Clock3 className="size-3.5" />
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
