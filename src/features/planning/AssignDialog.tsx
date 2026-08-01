import { useState } from 'react';
import { X } from 'lucide-react';
import { fromISODate, mondayIndex } from '../../lib/dates.ts';
import { shiftLabel, shiftHours, type ShiftType } from '../../lib/shifts.ts';
import { useI18n } from '../../i18n/index.ts';
import type { Doctor, Leave, Shift, WishKind } from '../../backend/types.ts';
import { Modal } from '../../components/Modal.tsx';
import { SegmentedControl } from '../../components/ui/SegmentedControl.tsx';
import { AssignSlotActions } from './AssignSlotActions.tsx';
import { AssignSlotHistory } from './AssignSlotHistory.tsx';
import { AssignDoctorList } from './AssignDoctorList.tsx';

export interface SlotTarget {
  iso: string;
  shiftType: ShiftType;
}

/**
 * Choix de répétition hebdomadaire. Des CHAÎNES parce que `SegmentedControl`
 * n'accepte que des valeurs de type `string` ; la conversion en nombre se fait
 * au seul endroit qui en a besoin (l'appel d'affectation).
 */
const REPEAT_WEEKS = ['1', '2', '3', '4'] as const;
type RepeatWeeks = (typeof REPEAT_WEEKS)[number];

/**
 * Dialogue d'affectation d'un créneau. Il n'assemble que les blocs (en-tête,
 * répétition, actions, historique, liste des médecins) et garde les deux seuls
 * états réellement partagés : `busy`, qui verrouille tous les boutons pendant
 * une mutation via l'utilitaire `run`, et `repeat`, qui s'applique aussi bien
 * au bouton « m'assigner » qu'au choix d'un médecin dans la liste.
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
  /** `weeks` = nombre de semaines consécutives à affecter (1 = ce jour seul). */
  onAssign: (doctorId: string, weeks: number) => Promise<void>;
  onClear: () => Promise<void>;
  onPropose: (toDoctor: string | null, message: string) => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [repeat, setRepeat] = useState<RepeatWeeks>('1');
  const { t, m } = useI18n();

  const d = fromISODate(target.iso);
  const dayLabel = `${m.common.weekdays[mondayIndex(d)]} ${d.getDate()}`;
  const weeks = Number(repeat);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  // Point d'entrée unique des deux chemins d'affectation (bouton « m'assigner »
  // et liste des médecins) : la répétition s'applique donc aux deux sans que
  // les sous-composants aient à la connaître.
  const assign = (doctorId: string) => onAssign(doctorId, weeks);

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

      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {t('assign.repeatLabel')}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {weeks === 1
              ? t('assign.repeatHintOnce')
              : t('assign.repeatHint', { n: weeks - 1 })}
          </p>
        </div>
        <SegmentedControl
          size="sm"
          ariaLabel={t('assign.repeatAria')}
          value={repeat}
          onChange={setRepeat}
          options={REPEAT_WEEKS.map(w => ({
            value: w,
            label: t('assign.repeatOption', { n: w }),
          }))}
        />
      </div>

      <AssignSlotActions
        shiftType={target.shiftType}
        dayLabel={dayLabel}
        currentShift={currentShift}
        doctors={doctors}
        selfDoctorId={selfDoctorId}
        busy={busy}
        repeatWeeks={weeks}
        run={run}
        onAssign={assign}
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
        onPick={doctorId => void run(() => assign(doctorId))}
      />
    </Modal>
  );
}
