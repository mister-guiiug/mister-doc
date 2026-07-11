import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, RefreshCw } from 'lucide-react';
import { useAuth } from '../../auth/useAuth.ts';
import { monthLabel, weeksOfMonth } from '../../lib/dates.ts';
import type { ShiftType } from '../../lib/shifts.ts';
import type { LeaveKind } from '../../lib/leaves.ts';
import type { Doctor, Leave, Shift } from '../../backend/types.ts';
import { listDoctors } from '../../backend/doctors.ts';
import {
  assignShift,
  clearShift,
  listMonthShifts,
  subscribeShifts,
} from '../../backend/planning.ts';
import {
  clearLeave,
  listMonthLeaves,
  setLeaveRange,
  subscribeLeaves,
} from '../../backend/leaves.ts';
import { Counters } from './Counters.tsx';
import { MonthGrid } from './MonthGrid.tsx';
import { AssignDialog, type SlotTarget } from './AssignDialog.tsx';
import { LeaveDialog } from './LeaveDialog.tsx';
import { FullScreenSpinner } from '../../components/Spinner.tsx';

export function PlanningView() {
  const { doctor } = useAuth();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slot, setSlot] = useState<SlotTarget | null>(null);
  const [leaveDate, setLeaveDate] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [s, l] = await Promise.all([
        listMonthShifts(year, month),
        listMonthLeaves(year, month),
      ]);
      setShifts(s);
      setLeaves(l);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setRefreshing(false);
    }
  }, [year, month]);

  useEffect(() => {
    listDoctors()
      .then(setDoctors)
      .catch(err =>
        setError(err instanceof Error ? err.message : 'Erreur roster')
      );
  }, []);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  // Realtime : recharge à chaque changement de garde ou d'absence.
  useEffect(() => subscribeShifts(() => void loadData()), [loadData]);
  useEffect(() => subscribeLeaves(() => void loadData()), [loadData]);

  const weeks = useMemo(() => weeksOfMonth(year, month), [year, month]);
  const doctorsById = useMemo(
    () => new Map(doctors.map(d => [d.id, d])),
    [doctors]
  );
  const shiftIndex = useMemo(
    () => new Map(shifts.map(s => [`${s.work_date}|${s.shift_type}`, s])),
    [shifts]
  );
  const leavesByDate = useMemo(() => {
    const m = new Map<string, Leave[]>();
    for (const l of leaves) {
      const arr = m.get(l.work_date);
      if (arr) arr.push(l);
      else m.set(l.work_date, [l]);
    }
    return m;
  }, [leaves]);

  function shiftMonth(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  async function handleAssign(doctorId: string) {
    if (!slot || !doctor) return;
    await assignShift(slot.iso, slot.shiftType, doctorId, doctor.id);
    await loadData();
  }

  async function handleClearSlot() {
    if (!slot) return;
    await clearShift(slot.iso, slot.shiftType);
    await loadData();
  }

  async function handleAddLeave(
    doctorId: string,
    from: string,
    to: string,
    kind: LeaveKind,
    hours: number | null
  ) {
    await setLeaveRange(doctorId, from, to, kind, hours, doctor?.id ?? null);
    await loadData();
  }

  async function handleRemoveLeave(leave: Leave) {
    await clearLeave(leave.id);
    await loadData();
  }

  const currentShift = slot
    ? shiftIndex.get(`${slot.iso}|${slot.shiftType}`)
    : undefined;

  if (loading) return <FullScreenSpinner label="Chargement du planning…" />;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-3 py-4 sm:px-4">
      {doctor && (
        <Counters
          shifts={shifts}
          leaves={leaves}
          doctorId={doctor.id}
          monthLabel={monthLabel(year, month)}
        />
      )}

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
          <button
            onClick={() => shiftMonth(-1)}
            className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Mois précédent"
          >
            <ChevronLeft className="size-5" />
          </button>
          <span className="flex min-w-32 items-center justify-center gap-2 px-1 text-sm font-semibold capitalize sm:min-w-40 sm:text-base">
            <CalendarDays className="size-4 shrink-0 text-teal-600" />
            {monthLabel(year, month)}
          </span>
          <button
            onClick={() => shiftMonth(1)}
            className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Mois suivant"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
        <button
          onClick={() => {
            setYear(today.getFullYear());
            setMonth(today.getMonth());
          }}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
        >
          Auj.
        </button>
        <button
          onClick={() => void loadData()}
          className="ml-auto rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
          aria-label="Rafraîchir"
          title="Rafraîchir"
        >
          <RefreshCw className={`size-5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {doctor && (
        <MonthGrid
          weeks={weeks}
          shiftIndex={shiftIndex}
          leavesByDate={leavesByDate}
          doctorsById={doctorsById}
          selfDoctorId={doctor.id}
          onSlotClick={(iso, shiftType: ShiftType) =>
            setSlot({ iso, shiftType })
          }
          onAddLeave={iso => setLeaveDate(iso)}
          onRemoveLeave={leave => void handleRemoveLeave(leave)}
        />
      )}

      {slot && doctor && (
        <AssignDialog
          target={slot}
          currentShift={currentShift}
          doctors={doctors}
          selfDoctorId={doctor.id}
          onAssign={handleAssign}
          onClear={handleClearSlot}
          onClose={() => setSlot(null)}
        />
      )}

      {leaveDate && doctor && (
        <LeaveDialog
          date={leaveDate}
          doctors={doctors}
          selfDoctorId={doctor.id}
          onSubmit={handleAddLeave}
          onClose={() => setLeaveDate(null)}
        />
      )}
    </div>
  );
}
