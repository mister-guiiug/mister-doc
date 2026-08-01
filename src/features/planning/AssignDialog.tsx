import { useState } from 'react';
import { X } from 'lucide-react';
import { fromISODate, mondayIndex } from '../../lib/dates.ts';
import { shiftLabel, shiftHours, type ShiftType } from '../../lib/shifts.ts';
import { useI18n } from '../../i18n/index.ts';
import type { Doctor, Leave, Shift, WishKind } from '../../backend/types.ts';
import { Modal } from '../../components/Modal.tsx';
import { AssignSlotActions } from './AssignSlotActions.tsx';
import { AssignSlotHistory } from './AssignSlotHistory.tsx';
import { AssignDoctorList } from './AssignDoctorList.tsx';

export interface SlotTarget {
  iso: string;
  shiftType: ShiftType;
}

/**
 * Dialogue d'affectation d'un créneau. Il n'assemble que les quatre blocs
 * (en-tête, actions, historique, liste des médecins) et garde le seul état
 * réellement partagé : `busy`, qui verrouille tous les boutons pendant une
 * mutation via l'utilitaire `run`.
 */
export function AssignDialog({
  target,
  currentShift,
  doctors,
  selfDoctorId,
  monthShifts,
  leaves,
  dayWishes,
  onAssign,
  onClear,
  onPropose,
  onClose,
}: {
  target: SlotTarget;
  currentShift: Shift | undefined;
  doctors: Doctor[];
  selfDoctorId: string;
  monthShifts: Shift[];
  leaves: Leave[];
  dayWishes: Map<string, WishKind>;
  onAssign: (doctorId: string) => Promise<void>;
  onClear: () => Promise<void>;
  onPropose: (toDoctor: string | null, message: string) => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const { t, m } = useI18n();

  const d = fromISODate(target.iso);
  const dayLabel = `${m.common.weekdays[mondayIndex(d)]} ${d.getDate()}`;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      onClose={onClose}
      className="flex max-h-[85dvh] max-w-md flex-col rounded-t-2xl sm:rounded-2xl"
    >
      <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800">
        <div>
          <h3 className="font-semibold">
            {shiftLabel(target.shiftType)} · {shiftHours(target.shiftType)} h
          </h3>
          <p className="text-sm capitalize text-slate-500">{dayLabel}</p>
        </div>
        <button
          onClick={onClose}
          aria-label={t('common.close')}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="size-5" />
        </button>
      </div>

      <AssignSlotActions
        shiftType={target.shiftType}
        dayLabel={dayLabel}
        currentShift={currentShift}
        doctors={doctors}
        selfDoctorId={selfDoctorId}
        busy={busy}
        run={run}
        onAssign={onAssign}
        onClear={onClear}
        onPropose={onPropose}
      />

      <AssignSlotHistory
        iso={target.iso}
        shiftType={target.shiftType}
        doctors={doctors}
      />

      <AssignDoctorList
        iso={target.iso}
        doctors={doctors}
        currentShift={currentShift}
        selfDoctorId={selfDoctorId}
        monthShifts={monthShifts}
        leaves={leaves}
        dayWishes={dayWishes}
        busy={busy}
        onPick={doctorId => void run(() => onAssign(doctorId))}
      />
    </Modal>
  );
}
