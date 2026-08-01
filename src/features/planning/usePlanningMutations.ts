import { useCallback } from 'react';
import type { useToast } from '../../components/Toast.tsx';
import { useConfirm } from '../../components/ui/confirmContext.ts';
import type { LeaveKind } from '../../lib/leaves.ts';
import type { MonthCopyRow } from '../../lib/monthCopy.ts';
import { planWeeklyRepeat } from '../../lib/repeatPlan.ts';
import type { Doctor, Leave, Shift, WishKind } from '../../backend/types.ts';
import {
  assignShift,
  assignShiftsBulk,
  clearShift,
} from '../../backend/planning.ts';
import { clearLeave, setLeaveRange } from '../../backend/leaves.ts';
import { clearNote, setNote } from '../../backend/notes.ts';
import { clearWish, setWish } from '../../backend/wishes.ts';
import { clearHnc, setHnc as saveHnc } from '../../backend/hnc.ts';
import { proposeSwap } from '../../backend/swaps.ts';
import {
  isMonthLocked,
  listLocks,
  lockMonth,
  unlockMonth,
} from '../../backend/locks.ts';
import { useI18n } from '../../i18n/index.ts';
import type { SlotTarget } from './AssignDialog.tsx';
import type { PlanningData } from './usePlanningData.ts';

/** Formate une clé ISO `YYYY-MM-DD` en `DD/MM/YYYY` (messages de confirmation). */
function frDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

interface MutationCtx {
  doctor: Doctor | null;
  year: number;
  month: number;
  toast: ReturnType<typeof useToast>;
}

/**
 * Regroupe toutes les mutations du planning (affectations, absences, notes,
 * vœux, HNC, verrou de mois). Les écritures sont optimistes puis annulées
 * (`prev`) en cas d'échec ; certaines rechargent simplement les données.
 * Les cibles de créneau sont passées en paramètre pour rester indépendantes
 * de l'état d'ouverture des dialogues (qui vit dans `PlanningView`).
 */
export function usePlanningMutations(data: PlanningData, ctx: MutationCtx) {
  const {
    shifts,
    leaves,
    wishes,
    hnc,
    locks,
    doctorsById,
    setShifts,
    setLeaves,
    setWishes,
    setHnc,
    setLocks,
    locked,
    loadData,
  } = data;
  const { doctor, year, month, toast } = ctx;
  const confirm = useConfirm();
  const { t } = useI18n();

  // Toutes les mutations signalent leur échec de la même façon : message de
  // l'erreur si on en a un, libellé générique sinon. Centralisé ici plutôt que
  // répété à l'identique dans chaque `catch`.
  const notifyError = useCallback(
    (e: unknown) =>
      toast.error(e instanceof Error ? e.message : t('common.error')),
    [toast, t]
  );

  /**
   * Affecte un médecin sur un créneau, éventuellement répété sur `weeks`
   * semaines (le jour cliqué + les mêmes jours de semaine suivants).
   *
   * La répétition est portée par `handleAssign` plutôt que par une mutation
   * séparée : l'écriture optimiste, le rollback et le message de succès sont
   * les mêmes à 1 ou 4 semaines, et `weeks = 1` (défaut) ramène exactement au
   * code précédent — un seul chemin à maintenir, aucune duplication.
   */
  const handleAssign = useCallback(
    async (slot: SlotTarget, doctorId: string, weeks = 1) => {
      if (!doctor) return;
      const plan = planWeeklyRepeat(slot.iso, slot.shiftType, weeks, (y, mo) =>
        isMonthLocked(locks, y, mo)
      );
      // Aucune date retenue : rien à écrire, on explique pourquoi.
      if (plan.dates.length === 0) {
        toast.error(t('assign.repeatNothing'));
        return;
      }
      // La date CLIQUÉE est traitée à part, en upsert : l'utilisateur a ouvert
      // ce créneau précis, remplacer son occupant est le geste attendu.
      const [first, ...rest] = plan.dates;
      if (!first) return;

      const prev = shifts;
      setShifts(cur => [
        ...cur.filter(
          s => !(s.work_date === first && s.shift_type === slot.shiftType)
        ),
        {
          id: `tmp-${first}-${slot.shiftType}`,
          work_date: first,
          shift_type: slot.shiftType,
          doctor_id: doctorId,
          created_by: doctor.id,
          created_at: '',
          updated_at: '',
        } as Shift,
      ]);
      try {
        await assignShift(first, slot.shiftType, doctorId, doctor.id);
        // Les dates RÉPÉTÉES passent par la RPC de lot : une seule transaction,
        // et surtout `on conflict do nothing` — répéter ne doit pas déloger un
        // collègue déjà affecté sur une semaine suivante. Bonus : le trigger
        // d'INSERT étant de niveau instruction, le lot ne produit qu'UNE
        // notification au lieu d'une par date.
        let taken = 0;
        if (rest.length > 0) {
          const inserted = await assignShiftsBulk(
            rest.map(iso => ({
              work_date: iso,
              shift_type: slot.shiftType,
              doctor_id: doctorId,
            }))
          );
          taken = rest.length - inserted;
          // Le lot n'a pas d'écriture optimiste : on relit pour refléter
          // exactement ce que la base a accepté.
          await loadData();
        }

        const written = 1 + rest.length - taken;
        const parts = [
          written === 1
            ? t('planning.shiftAssigned')
            : t('assign.repeatDone', { n: written }),
        ];
        if (plan.skippedInactive > 0)
          parts.push(
            t('assign.repeatSkippedInactive', { n: plan.skippedInactive })
          );
        if (plan.skippedLocked > 0)
          parts.push(
            t('assign.repeatSkippedLocked', { n: plan.skippedLocked })
          );
        if (taken > 0) parts.push(t('assign.repeatSkippedTaken', { n: taken }));
        toast.success(parts.join(' '));
      } catch (e) {
        setShifts(prev);
        notifyError(e);
      }
    },
    [doctor, shifts, locks, setShifts, loadData, toast, t, notifyError]
  );

  const handleClearSlot = useCallback(
    async (slot: SlotTarget) => {
      const prev = shifts;
      setShifts(cur =>
        cur.filter(
          s => !(s.work_date === slot.iso && s.shift_type === slot.shiftType)
        )
      );
      try {
        await clearShift(slot.iso, slot.shiftType);
        toast.success(t('planning.slotFreed'));
      } catch (e) {
        setShifts(prev);
        notifyError(e);
      }
    },
    [shifts, setShifts, toast, t, notifyError]
  );

  /**
   * Écrit le plan de copie du mois précédent (cf. `CopyMonthDialog`) en UN
   * appel : la RPC de lot insère tout dans la même transaction, sans écraser
   * les créneaux déjà attribués. Pas d'écriture optimiste — un lot de ~90
   * lignes se relit plus sûrement qu'il ne se simule, et `loadData` fait foi.
   */
  const handleCopyMonth = useCallback(
    async (rows: MonthCopyRow[]) => {
      // Garde-fou : le dialogue ne s'ouvre pas sur un mois verrouillé, mais la
      // base refuserait de toute façon (trigger `assert_month_unlocked`).
      if (locked) {
        toast.error(t('copyMonth.lockedError'));
        return;
      }
      if (rows.length === 0) return;
      try {
        const n = await assignShiftsBulk(rows);
        await loadData();
        toast.success(t('copyMonth.done', { n }));
      } catch (e) {
        notifyError(e);
      }
    },
    [locked, loadData, toast, t, notifyError]
  );

  const handleAddLeave = useCallback(
    async (
      doctorId: string,
      from: string,
      to: string,
      kind: LeaveKind,
      hours: number | null
    ) => {
      try {
        await setLeaveRange(
          doctorId,
          from,
          to,
          kind,
          hours,
          doctor?.id ?? null
        );
        await loadData();
        toast.success(t('planning.leaveSaved'));
      } catch (e) {
        notifyError(e);
      }
    },
    [doctor, loadData, toast, t, notifyError]
  );

  const handleRemoveLeave = useCallback(
    async (leave: Leave) => {
      const doc = doctorsById.get(leave.doctor_id);
      if (
        !(await confirm({
          message: t('planning.removeLeaveConfirm', {
            name: doc?.name ?? t('planning.thisDoctor'),
            date: frDate(leave.work_date),
          }),
          danger: true,
          confirmLabel: t('common.delete'),
        }))
      )
        return;
      const prev = leaves;
      setLeaves(cur => cur.filter(l => l.id !== leave.id));
      try {
        await clearLeave(leave.id);
      } catch (e) {
        setLeaves(prev);
        notifyError(e);
      }
    },
    [confirm, doctorsById, leaves, setLeaves, t, notifyError]
  );

  const handleSaveNote = useCallback(
    async (noteDate: string, text: string) => {
      try {
        await setNote(noteDate, text, doctor?.id ?? null);
        await loadData();
        toast.success(t('planning.noteSaved'));
      } catch (e) {
        notifyError(e);
      }
    },
    [doctor, loadData, toast, t, notifyError]
  );

  const handleDeleteNote = useCallback(
    async (noteDate: string) => {
      try {
        await clearNote(noteDate);
        await loadData();
      } catch (e) {
        notifyError(e);
      }
    },
    [loadData, notifyError]
  );

  const handleCycleWish = useCallback(
    async (iso: string) => {
      if (!doctor) return;
      const cur = wishes.find(
        w => w.work_date === iso && w.doctor_id === doctor.id
      )?.kind;
      const next: WishKind | null =
        cur === undefined ? 'prefer' : cur === 'prefer' ? 'avoid' : null;
      // Optimiste
      setWishes(list => {
        const others = list.filter(
          w => !(w.work_date === iso && w.doctor_id === doctor.id)
        );
        if (next === null) return others;
        const existing = list.find(
          w => w.work_date === iso && w.doctor_id === doctor.id
        );
        return [
          ...others,
          {
            id: existing?.id ?? `tmp-${iso}`,
            doctor_id: doctor.id,
            work_date: iso,
            kind: next,
            note: null,
            created_at: existing?.created_at ?? '',
          },
        ];
      });
      try {
        if (next === null) await clearWish(doctor.id, iso);
        else await setWish(doctor.id, iso, next, null);
      } catch (e) {
        notifyError(e);
        await loadData();
      }
    },
    [doctor, wishes, setWishes, loadData, notifyError]
  );

  const handlePropose = useCallback(
    async (slot: SlotTarget, toDoctor: string | null, message: string) => {
      try {
        await proposeSwap(slot.iso, slot.shiftType, toDoctor, message);
        toast.success(t('planning.swapSent'));
      } catch (e) {
        notifyError(e);
      }
    },
    [toast, t, notifyError]
  );

  const handleSetHnc = useCallback(
    async (iso: string, doctorId: string, hours: number) => {
      try {
        await saveHnc(doctorId, iso, hours, doctor?.id ?? null);
        await loadData();
        toast.success(t('planning.hncSaved'));
      } catch (e) {
        notifyError(e);
      }
    },
    [doctor, loadData, toast, t, notifyError]
  );

  const handleClearHnc = useCallback(
    async (id: string) => {
      const entry = hnc.find(h => h.id === id);
      const doc = entry ? doctorsById.get(entry.doctor_id) : undefined;
      if (
        !(await confirm({
          message: t('planning.removeHncConfirm', {
            who: doc ? t('planning.removeHncWho', { name: doc.name }) : '',
            when: entry
              ? t('planning.removeHncWhen', { date: frDate(entry.work_date) })
              : '',
          }),
          danger: true,
          confirmLabel: t('common.delete'),
        }))
      )
        return;
      const prev = hnc;
      setHnc(cur => cur.filter(h => h.id !== id));
      try {
        await clearHnc(id);
      } catch (e) {
        setHnc(prev);
        notifyError(e);
      }
    },
    [confirm, hnc, doctorsById, setHnc, t, notifyError]
  );

  const toggleLock = useCallback(async () => {
    try {
      if (locked) await unlockMonth(year, month);
      else await lockMonth(year, month, doctor?.id ?? null);
      setLocks(await listLocks());
      toast.success(
        locked
          ? t('planning.monthUnlockedToast')
          : t('planning.monthLockedToast')
      );
    } catch (e) {
      notifyError(e);
    }
  }, [locked, year, month, doctor, setLocks, toast, t, notifyError]);

  return {
    handleAssign,
    handleClearSlot,
    handleCopyMonth,
    handleAddLeave,
    handleRemoveLeave,
    handleSaveNote,
    handleDeleteNote,
    handleCycleWish,
    handlePropose,
    handleSetHnc,
    handleClearHnc,
    toggleLock,
  };
}
