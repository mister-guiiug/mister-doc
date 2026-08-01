import { shiftLabel, shiftHours, type ShiftType } from '../../lib/shifts.ts';
import type { Doctor, Shift } from '../../backend/types.ts';
import type { DayInfo } from './dayInfo.ts';
import { useI18n } from '../../i18n/index.ts';

/**
 * Zone des créneaux d'une ligne de jour (vue LISTE). Le rendu est volontairement
 * différent de celui de la grille 7 colonnes (bouton large sur deux lignes vs
 * pastille compacte) : mieux vaut deux composants courts qu'un composant unique
 * truffé de conditions. Sous-composant simple (non mémoïsé) : il n'est rendu que
 * lorsque `DayRow`, lui mémoïsé, se rend déjà.
 */
interface DayRowSlotsProps {
  iso: string;
  types: ShiftType[];
  shiftIndex: Map<string, Shift>;
  doctorsById: Map<string, Doctor>;
  selfDoctorId: string;
  dim: DayInfo['dim'];
  locked: boolean;
  onSlotClick: (iso: string, shiftType: ShiftType) => void;
}

export function DayRowSlots({
  iso,
  types,
  shiftIndex,
  doctorsById,
  selfDoctorId,
  dim,
  locked,
  onSlotClick,
}: DayRowSlotsProps) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
      {types.map(type => {
        const shift = shiftIndex.get(`${iso}|${type}`);
        const doctor = shift ? doctorsById.get(shift.doctor_id) : undefined;
        const mine = shift?.doctor_id === selfDoctorId;
        return (
          <button
            key={type}
            disabled={locked}
            onClick={() => onSlotClick(iso, type)}
            className={`flex min-h-11 flex-col items-start gap-0.5 rounded-lg border px-2 py-1.5 text-left transition disabled:cursor-default ${
              dim(shift?.doctor_id) ? 'opacity-30' : ''
            } ${
              doctor
                ? mine
                  ? 'border-teal-500 bg-teal-100/70 ring-1 ring-teal-500 dark:bg-teal-900/40'
                  : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800'
                : 'border-dashed border-slate-300 bg-transparent dark:border-slate-700'
            } ${locked ? '' : 'hover:border-teal-400'}`}
            title={`${shiftLabel(type)} · ${shiftHours(type)} h`}
          >
            <span className="flex w-full items-center justify-between text-[10px] font-semibold uppercase text-slate-400">
              {type}
              <span className="font-normal normal-case">
                {shiftHours(type)}h
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
                {t('common.free')}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
