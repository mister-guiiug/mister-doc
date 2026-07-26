import { useCallback } from 'react';
import type { useToast } from '../../components/Toast.tsx';
import { useConfirm } from '../../components/ui/confirmContext.ts';
import type { LeaveKind } from '../../lib/leaves.ts';
import type { Doctor, Leave, Shift, WishKind } from '../../backend/types.ts';
import { assignShift, clearShift } from '../../backend/planning.ts';
import { clearLeave, setLeaveRange } from '../../backend/leaves.ts';
import { clearNote, setNote } from '../../backend/notes.ts';
import { clearWish, setWish } from '../../backend/wishes.ts';
import { clearHnc, setHnc as saveHnc } from '../../backend/hnc.ts';
import { proposeSwap } from '../../backend/swaps.ts';
import { listLocks, lockMonth, unlockMonth } from '../../backend/locks.ts';
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

  const handleAssign = useCallback(
    async (slot: SlotTarget, doctorId: string) => {
      if (!doctor) return;
      const prev = shifts;
      setShifts(cur => [
        ...cur.filter(
          s => !(s.work_date === slot.iso && s.shift_type === slot.shiftType)
        ),
        {
          id: `tmp-${slot.iso}-${slot.shiftType}`,
          work_date: slot.iso,
          shift_type: slot.shiftType,
          doctor_id: doctorId,
          created_by: doctor.id,
          created_at: '',
          updated_at: '',
        } as Shift,
      ]);
      try {
        await assignShift(slot.iso, slot.shiftType, doctorId, doctor.id);
        toast.success(t('planning.shiftAssigned'));
      } catch (e) {
        setShifts(prev);
        toast.error(e instanceof Error ? e.message : t('common.error'));
      }
    },
    [doctor, shifts, setShifts, toast, t]
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
        toast.error(e instanceof Error ? e.message : t('common.error'));
      }
    },
    [shifts, setShifts, toast, t]
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
        toast.error(e instanceof Error ? e.message : t('common.error'));
      }
    },
    [doctor, loadData, toast, t]
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
        toast.error(e instanceof Error ? e.message : t('common.error'));
      }
    },
    [confirm, doctorsById, leaves, setLeaves, toast, t]
  );

  const handleSaveNote = useCallback(
    async (noteDate: string, text: string) => {
      try {
        await setNote(noteDate, text, doctor?.id ?? null);
        await loadData();
        toast.success(t('planning.noteSaved'));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t('common.error'));
      }
    },
    [doctor, loadData, toast, t]
  );

  const handleDeleteNote = useCallback(
    async (noteDate: string) => {
      try {
        await clearNote(noteDate);
        await loadData();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t('common.error'));
      }
    },
    [loadData, toast, t]
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
        toast.error(e instanceof Error ? e.message : t('common.error'));
        await loadData();
      }
    },
    [doctor, wishes, setWishes, toast, loadData, t]
  );

  const handlePropose = useCallback(
    async (slot: SlotTarget, toDoctor: string | null, message: string) => {
      try {
        await proposeSwap(slot.iso, slot.shiftType, toDoctor, message);
        toast.success(t('planning.swapSent'));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t('common.error'));
      }
    },
    [toast, t]
  );

  const handleSetHnc = useCallback(
    async (iso: string, doctorId: string, hours: number) => {
      try {
        await saveHnc(doctorId, iso, hours, doctor?.id ?? null);
        await loadData();
        toast.success(t('planning.hncSaved'));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t('common.error'));
      }
    },
    [doctor, loadData, toast, t]
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
        toast.error(e instanceof Error ? e.message : t('common.error'));
      }
    },
    [confirm, hnc, doctorsById, setHnc, toast, t]
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
      toast.error(e instanceof Error ? e.message : t('common.error'));
    }
  }, [locked, year, month, doctor, setLocks, toast, t]);

  return {
    handleAssign,
    handleClearSlot,
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
