/**
 * LE TRANSPORT de la file d'écritures hors ligne : ce qui traduit une
 * `PlanningOp` en appel Supabase. Séparé de `syncQueue.ts` à dessein — la file
 * reste éprouvable sans client Supabase ni variables d'environnement, et le
 * branchement se fait à l'évaluation de CE module (un simple enregistrement de
 * rappel : aucune E/S, la doctrine anti-écran-blanc tient).
 *
 * LES GARDES SONT ÉCRITES CONDITIONNELLEMENT — c'est tout l'objet du chantier.
 * `assign_shift_if_unchanged` / `clear_shift_if_unchanged` (migration 0027)
 * n'écrivent que si l'occupant du créneau est encore celui que le médecin avait
 * sous les yeux. Un refus devient une `SlotConflictError`, que la file classe
 * en rejet définitif : lettre morte (la trace) + observateur (la notification).
 *
 * LES AUTRES ÉCRITURES sont déjà idempotentes en base (`upsert` sur une clé
 * naturelle, `delete` par identifiant) : les rejouer telles quelles est sûr,
 * et il n'y a pas d'occupant unique à disputer.
 */
import {
  assertApplied,
  setQueueTransport,
  type PlanningOp,
} from './syncQueue.ts';
import { assignShiftIfUnchanged, clearShiftIfUnchanged } from './planning.ts';
import { clearLeave, setLeaveRange } from './leaves.ts';
import { clearHnc, setHnc } from './hnc.ts';

/** Applique une opération de la file. Lève : la file classe et décide. */
export async function applyPlanningOp(op: PlanningOp): Promise<void> {
  switch (op.kind) {
    case 'shift.assign':
      return assertApplied(
        await assignShiftIfUnchanged(
          op.workDate,
          op.shiftType,
          op.doctorId,
          op.expectedDoctorId
        )
      );
    case 'shift.clear':
      return assertApplied(
        await clearShiftIfUnchanged(
          op.workDate,
          op.shiftType,
          op.expectedDoctorId
        )
      );
    case 'leave.set':
      return setLeaveRange(
        op.doctorId,
        op.fromISO,
        op.toISO,
        op.leaveKind,
        op.hours,
        op.createdBy
      );
    case 'leave.clear':
      return clearLeave(op.id);
    case 'hnc.set':
      await setHnc(op.doctorId, op.workDate, op.hours, op.createdBy);
      return;
    case 'hnc.clear':
      return clearHnc(op.id);
  }
}

// Enregistrement pur : le transport est là dès que ce module est évalué, même
// si personne n'a encore monté l'interface. Un drain déclenché depuis les
// Réglages trouve donc toujours de quoi écrire.
setQueueTransport(applyPlanningOp);
