import type { Doctor, Shift, WishKind } from '../../backend/types.ts';
import { AssignDialog, type SlotTarget } from './AssignDialog.tsx';
import { LeaveDialog } from './LeaveDialog.tsx';
import { NoteDialog } from './NoteDialog.tsx';
import { HncDialog } from './HncDialog.tsx';
import type { PlanningData } from './usePlanningData.ts';
import type { usePlanningMutations } from './usePlanningMutations.ts';

interface PlanningDialogsProps {
  /** Médecin connecté : aucun dialogue « médecin » ne s'ouvre sans lui. */
  doctor: Doctor | null;
  /** Données du mois affiché (mêmes index que les grilles). */
  data: PlanningData;
  /** Mutations du planning, telles quelles (cf. `usePlanningMutations`). */
  mutations: ReturnType<typeof usePlanningMutations>;
  /** Créneau en cours d'affectation (null = dialogue fermé). */
  slot: SlotTarget | null;
  currentShift: Shift | undefined;
  /** Vœux du jour du créneau, par médecin. */
  slotDayWishes: Map<string, WishKind>;
  leaveDate: string | null;
  noteDate: string | null;
  hncDate: string | null;
  onCloseSlot: () => void;
  onCloseLeave: () => void;
  onCloseNote: () => void;
  onCloseHnc: () => void;
}

/**
 * Les quatre dialogues du planning (affectation, absence, note, HNC), montés
 * uniquement quand leur cible est renseignée. L'état d'ouverture et les
 * mutations restent dans `PlanningView` : ce composant ne fait que câbler.
 */
export function PlanningDialogs({
  doctor,
  data,
  mutations,
  slot,
  currentShift,
  slotDayWishes,
  leaveDate,
  noteDate,
  hncDate,
  onCloseSlot,
  onCloseLeave,
  onCloseNote,
  onCloseHnc,
}: PlanningDialogsProps) {
  return (
    <>
      {slot && doctor && (
        <AssignDialog
          target={slot}
          currentShift={currentShift}
          doctors={data.doctors}
          selfDoctorId={doctor.id}
          monthShifts={data.shifts}
          leaves={data.leaves}
          dayWishes={slotDayWishes}
          onAssign={(doctorId, weeks) =>
            mutations.handleAssign(slot, doctorId, weeks)
          }
          onClear={() => mutations.handleClearSlot(slot)}
          onPropose={(toDoctor, message) =>
            mutations.handlePropose(slot, toDoctor, message)
          }
          onClose={onCloseSlot}
        />
      )}

      {leaveDate && doctor && (
        <LeaveDialog
          date={leaveDate}
          doctors={data.doctors}
          selfDoctorId={doctor.id}
          onSubmit={mutations.handleAddLeave}
          onClose={onCloseLeave}
        />
      )}

      {noteDate && (
        <NoteDialog
          date={noteDate}
          initialNote={data.notesByDate.get(noteDate)?.note ?? ''}
          onSave={text => mutations.handleSaveNote(noteDate, text)}
          onDelete={() => mutations.handleDeleteNote(noteDate)}
          onClose={onCloseNote}
        />
      )}

      {hncDate && doctor && (
        <HncDialog
          date={hncDate}
          doctors={data.doctors}
          selfDoctorId={doctor.id}
          dayEntries={data.hncByDate.get(hncDate) ?? []}
          onSubmit={(doctorId, hours) =>
            mutations.handleSetHnc(hncDate, doctorId, hours)
          }
          onRemove={mutations.handleClearHnc}
          onClose={onCloseHnc}
        />
      )}
    </>
  );
}
