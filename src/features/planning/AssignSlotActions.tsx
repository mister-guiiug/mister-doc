import { useState } from 'react';
import { Trash2, UserPlus, Repeat } from 'lucide-react';
import { shiftLabel, type ShiftType } from '../../lib/shifts.ts';
import { useI18n } from '../../i18n/index.ts';
import type { Doctor, Shift } from '../../backend/types.ts';
import { Button } from '../../components/ui/Button.tsx';
import { useConfirm } from '../../components/ui/confirmContext.ts';

interface AssignSlotActionsProps {
  shiftType: ShiftType;
  /** Libellé du jour déjà formaté, réutilisé tel quel dans la confirmation. */
  dayLabel: string;
  currentShift: Shift | undefined;
  doctors: Doctor[];
  selfDoctorId: string;
  /** Mutation en cours : verrouille les boutons (état porté par le dialogue). */
  busy: boolean;
  /** Semaines de répétition choisies (état porté par le dialogue ; 1 = ce jour). */
  repeatWeeks: number;
  /** Exécute une mutation puis ferme le dialogue (fourni par `AssignDialog`). */
  run: (action: () => Promise<void>) => Promise<void>;
  onAssign: (doctorId: string) => Promise<void>;
  onClear: () => Promise<void>;
  onPropose: (toDoctor: string | null, message: string) => Promise<void>;
}

/**
 * Bloc d'actions directes du créneau : « m'assigner », « libérer » (avec
 * confirmation) et « proposer un échange » avec son petit formulaire.
 *
 * Le formulaire d'échange n'est utile qu'ici : son état local (ouverture,
 * destinataire, message) reste donc dans ce composant.
 */
export function AssignSlotActions({
  shiftType,
  dayLabel,
  currentShift,
  doctors,
  selfDoctorId,
  busy,
  repeatWeeks,
  run,
  onAssign,
  onClear,
  onPropose,
}: AssignSlotActionsProps) {
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapTarget, setSwapTarget] = useState('');
  const [swapMsg, setSwapMsg] = useState('');
  const confirm = useConfirm();
  const { t } = useI18n();
  const isMine = currentShift?.doctor_id === selfDoctorId;

  return (
    <div className="border-b border-slate-100 p-3 dark:border-slate-800">
      {/* Déjà titulaire du créneau ⇒ bouton inutile… sauf en répétition, où le
          clic sert à couvrir les semaines suivantes. */}
      <Button
        className="w-full py-2.5"
        disabled={
          busy ||
          (repeatWeeks === 1 && currentShift?.doctor_id === selfDoctorId)
        }
        onClick={() => void run(() => onAssign(selfDoctorId))}
      >
        <UserPlus className="size-4" /> {t('assign.assignMe')}
      </Button>
      {currentShift && (
        <Button
          variant="dangerGhost"
          className="mt-2 w-full py-2"
          disabled={busy}
          onClick={async () => {
            if (
              await confirm({
                message: t('assign.freeSlotConfirm', {
                  shift: shiftLabel(shiftType),
                  day: dayLabel,
                }),
                danger: true,
                confirmLabel: t('assign.freeLabel'),
              })
            )
              void run(onClear);
          }}
        >
          <Trash2 className="size-4" /> {t('assign.freeSlot')}
        </Button>
      )}

      {isMine && !swapOpen && (
        <Button
          variant="secondary"
          className="mt-2 w-full py-2"
          onClick={() => setSwapOpen(true)}
        >
          <Repeat className="size-4" /> {t('assign.proposeSwap')}
        </Button>
      )}
      {isMine && swapOpen && (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700">
          <select
            value={swapTarget}
            onChange={e => setSwapTarget(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
          >
            <option value="">{t('assign.openToAll')}</option>
            {doctors
              .filter(d => d.id !== selfDoctorId)
              .map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
          </select>
          <input
            value={swapMsg}
            onChange={e => setSwapMsg(e.target.value)}
            placeholder={t('assign.messageOptional')}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={() => setSwapOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              size="sm"
              className="flex-1"
              disabled={busy}
              onClick={() =>
                void run(() => onPropose(swapTarget || null, swapMsg))
              }
            >
              {t('assign.propose')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
