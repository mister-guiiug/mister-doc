import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  RefreshCw,
  Lock,
  LockOpen,
  Eye,
  AlertTriangle,
  List,
  LayoutGrid,
  FileDown,
} from 'lucide-react';
import { useAuth } from '../../auth/useAuth.ts';
import { useToast } from '../../components/Toast.tsx';
import { fromISODate, monthLabel, weeksOfMonth } from '../../lib/dates.ts';
import { useDebouncedCallback } from '../../lib/useDebouncedCallback.ts';
import { groupBy } from '../../lib/collections.ts';
import { activeShiftTypes, type ShiftType } from '../../lib/shifts.ts';
import { computeIssues } from '../../lib/validation.ts';
import type { LeaveKind } from '../../lib/leaves.ts';
import type {
  Doctor,
  DayNote,
  HncEntry,
  Leave,
  LockedMonth,
  Shift,
  Wish,
  WishKind,
} from '../../backend/types.ts';
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
import {
  clearNote,
  listMonthNotes,
  setNote,
  subscribeNotes,
} from '../../backend/notes.ts';
import {
  clearWish,
  listMonthWishes,
  setWish,
  subscribeWishes,
} from '../../backend/wishes.ts';
import {
  clearHnc,
  listMonthHnc,
  setHnc as saveHnc,
  subscribeHnc,
} from '../../backend/hnc.ts';
import { proposeSwap } from '../../backend/swaps.ts';
import {
  isMonthLocked,
  listLocks,
  lockMonth,
  subscribeLocks,
  unlockMonth,
} from '../../backend/locks.ts';
import { Counters } from './Counters.tsx';
import { MonthGrid } from './MonthGrid.tsx';
import { MonthCalendarGrid } from './MonthCalendarGrid.tsx';
import { exportMonthPdf } from './monthPdf.ts';
import { AssignDialog, type SlotTarget } from './AssignDialog.tsx';
import { LeaveDialog } from './LeaveDialog.tsx';
import { NoteDialog } from './NoteDialog.tsx';
import { HncDialog } from './HncDialog.tsx';
import { FullScreenSpinner } from '../../components/Spinner.tsx';

/** Formate une clé ISO `YYYY-MM-DD` en `DD/MM/YYYY` (messages de confirmation). */
function frDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function PlanningView() {
  const { doctor, isAdmin } = useAuth();
  const toast = useToast();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [notes, setNotes] = useState<DayNote[]>([]);
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [hnc, setHnc] = useState<HncEntry[]>([]);
  const [locks, setLocks] = useState<LockedMonth[]>([]);
  const [firstLoad, setFirstLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Incrémenté à chaque rechargement réel des données (pas aux éditions
  // optimistes) : déclencheur du refetch quadrimestre des compteurs.
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [slot, setSlot] = useState<SlotTarget | null>(null);
  const [leaveDate, setLeaveDate] = useState<string | null>(null);
  const [noteDate, setNoteDate] = useState<string | null>(null);
  const [hncDate, setHncDate] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'grid'>(() => {
    try {
      return localStorage.getItem('mister-doc:view') === 'list' ? 'list' : 'grid';
    } catch {
      return 'grid';
    }
  });
  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia('(min-width: 1024px)').matches
  );
  const dayRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const touchX = useRef<number | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [s, l, n, w, h] = await Promise.all([
        listMonthShifts(year, month),
        listMonthLeaves(year, month),
        listMonthNotes(year, month),
        listMonthWishes(year, month),
        listMonthHnc(year, month),
      ]);
      setShifts(s);
      setLeaves(l);
      setNotes(n);
      setWishes(w);
      setHnc(h);
      setReloadKey(k => k + 1);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setRefreshing(false);
    }
  }, [year, month]);

  useEffect(() => {
    listDoctors().then(setDoctors).catch(() => {});
    listLocks().then(setLocks).catch(() => {});
  }, []);

  useEffect(() => {
    loadData().finally(() => setFirstLoad(false));
  }, [loadData]);

  // Un seul rechargement anti-rebond pour toutes les tables : une rafale
  // d'événements Realtime (ou l'écho d'une édition optimiste) ne déclenche
  // qu'un rechargement au lieu de N. La référence est stable → les abonnements
  // ne se recréent pas à chaque changement de mois.
  const reloadDebounced = useDebouncedCallback(() => void loadData(), 250);
  useEffect(() => subscribeShifts(reloadDebounced), [reloadDebounced]);
  useEffect(() => subscribeLeaves(reloadDebounced), [reloadDebounced]);
  useEffect(() => subscribeNotes(reloadDebounced), [reloadDebounced]);
  useEffect(() => subscribeWishes(reloadDebounced), [reloadDebounced]);
  useEffect(() => subscribeHnc(reloadDebounced), [reloadDebounced]);
  useEffect(() => subscribeLocks(() => void listLocks().then(setLocks)), []);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const on = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  // Raccourci depuis une notification (`#/?d=YYYY-MM-DD`) : bascule sur le bon
  // mois, défile jusqu'au jour, puis nettoie le paramètre.
  useEffect(() => {
    const d = searchParams.get('d');
    if (!d) return;
    const dt = fromISODate(d);
    if (Number.isNaN(dt.getTime())) {
      setSearchParams({}, { replace: true });
      return;
    }
    setYear(dt.getFullYear());
    setMonth(dt.getMonth());
    const t = setTimeout(() => {
      dayRefs.current[d]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setSearchParams({}, { replace: true });
    }, 350);
    return () => clearTimeout(t);
  }, [searchParams, setSearchParams]);

  const weeks = useMemo(() => weeksOfMonth(year, month), [year, month]);
  const doctorsById = useMemo(() => new Map(doctors.map(d => [d.id, d])), [doctors]);
  const nameById = useMemo(
    () => new Map(doctors.map(d => [d.id, d.name])),
    [doctors]
  );
  const shiftIndex = useMemo(
    () => new Map(shifts.map(s => [`${s.work_date}|${s.shift_type}`, s])),
    [shifts]
  );
  const leavesByDate = useMemo(() => groupBy(leaves, l => l.work_date), [leaves]);
  const notesByDate = useMemo(
    () => new Map(notes.map(n => [n.work_date, n])),
    [notes]
  );
  const wishesByDate = useMemo(() => groupBy(wishes, w => w.work_date), [wishes]);
  const hncByDate = useMemo(() => groupBy(hnc, h => h.work_date), [hnc]);
  const issuesByDate = useMemo(
    () => computeIssues(shifts, leaves, nameById),
    [shifts, leaves, nameById]
  );
  const locked = useMemo(
    () => isMonthLocked(locks, year, month),
    [locks, year, month]
  );
  const uncovered = useMemo(
    () =>
      weeks
        .flatMap(w => w.days)
        .filter(d =>
          activeShiftTypes(d.date).some(t => !shiftIndex.has(`${d.iso}|${t}`))
        ),
    [weeks, shiftIndex]
  );

  function shiftMonth(delta: number) {
    const dt = new Date(year, month + delta, 1);
    setYear(dt.getFullYear());
    setMonth(dt.getMonth());
  }

  function changeView(v: 'list' | 'grid') {
    setView(v);
    try {
      localStorage.setItem('mister-doc:view', v);
    } catch {
      /* ignore */
    }
  }

  function handleExportPdf() {
    exportMonthPdf({
      title: monthLabel(year, month),
      weeks,
      shiftIndex,
      doctorsById,
    });
  }

  async function handleAssign(doctorId: string) {
    if (!slot || !doctor) return;
    const prev = shifts;
    setShifts(cur => [
      ...cur.filter(s => !(s.work_date === slot.iso && s.shift_type === slot.shiftType)),
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
      toast.success('Garde attribuée.');
    } catch (e) {
      setShifts(prev);
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  }

  async function handleClearSlot() {
    if (!slot) return;
    const prev = shifts;
    setShifts(cur =>
      cur.filter(s => !(s.work_date === slot.iso && s.shift_type === slot.shiftType))
    );
    try {
      await clearShift(slot.iso, slot.shiftType);
      toast.success('Créneau libéré.');
    } catch (e) {
      setShifts(prev);
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  }

  async function handleAddLeave(
    doctorId: string,
    from: string,
    to: string,
    kind: LeaveKind,
    hours: number | null
  ) {
    try {
      await setLeaveRange(doctorId, from, to, kind, hours, doctor?.id ?? null);
      await loadData();
      toast.success('Absence enregistrée.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  }

  async function handleRemoveLeave(leave: Leave) {
    const doc = doctorsById.get(leave.doctor_id);
    if (
      !confirm(
        `Supprimer l'absence de ${doc?.name ?? 'ce médecin'} le ${frDate(leave.work_date)} ?`
      )
    )
      return;
    const prev = leaves;
    setLeaves(cur => cur.filter(l => l.id !== leave.id));
    try {
      await clearLeave(leave.id);
    } catch (e) {
      setLeaves(prev);
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  }

  async function handleSaveNote(text: string) {
    if (!noteDate) return;
    try {
      await setNote(noteDate, text, doctor?.id ?? null);
      await loadData();
      toast.success('Note enregistrée.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  }

  async function handleDeleteNote() {
    if (!noteDate) return;
    try {
      await clearNote(noteDate);
      await loadData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  }

  async function handleCycleWish(iso: string) {
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
      toast.error(e instanceof Error ? e.message : 'Erreur');
      await loadData();
    }
  }

  async function handlePropose(toDoctor: string | null, message: string) {
    if (!slot) return;
    try {
      await proposeSwap(slot.iso, slot.shiftType, toDoctor, message);
      toast.success('Proposition d’échange envoyée.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  }

  async function handleSetHnc(iso: string, doctorId: string, hours: number) {
    try {
      await saveHnc(doctorId, iso, hours, doctor?.id ?? null);
      await loadData();
      toast.success('Heures non cliniques enregistrées.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  }

  async function handleClearHnc(id: string) {
    const entry = hnc.find(h => h.id === id);
    const doc = entry ? doctorsById.get(entry.doctor_id) : undefined;
    if (
      !confirm(
        `Supprimer les heures non cliniques${doc ? ` de ${doc.name}` : ''}${
          entry ? ` le ${frDate(entry.work_date)}` : ''
        } ?`
      )
    )
      return;
    const prev = hnc;
    setHnc(cur => cur.filter(h => h.id !== id));
    try {
      await clearHnc(id);
    } catch (e) {
      setHnc(prev);
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  }

  async function toggleLock() {
    try {
      if (locked) await unlockMonth(year, month);
      else await lockMonth(year, month, doctor?.id ?? null);
      setLocks(await listLocks());
      toast.success(locked ? 'Mois déverrouillé.' : 'Mois verrouillé.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  }

  function jumpToFirstUncovered() {
    const iso = uncovered[0]?.iso;
    if (iso) dayRefs.current[iso]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const currentShift = slot
    ? shiftIndex.get(`${slot.iso}|${slot.shiftType}`)
    : undefined;
  const slotDayWishes = useMemo(() => {
    const m = new Map<string, WishKind>();
    if (slot)
      for (const w of wishesByDate.get(slot.iso) ?? []) m.set(w.doctor_id, w.kind);
    return m;
  }, [slot, wishesByDate]);

  if (firstLoad) return <FullScreenSpinner label="Chargement du planning…" />;

  return (
    <div
      className="mx-auto flex max-w-5xl flex-col gap-4 px-3 py-4 sm:px-4"
      onTouchStart={e => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={e => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 70) shiftMonth(dx < 0 ? 1 : -1);
        touchX.current = null;
      }}
    >
      {doctor && (
        <Counters
          shifts={shifts}
          leaves={leaves}
          hnc={hnc}
          doctorId={doctor.id}
          year={year}
          month={month}
          reloadKey={reloadKey}
        />
      )}

      <div className="print-hide flex flex-wrap items-center gap-2">
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
            {locked && <Lock className="size-4 text-slate-400" />}
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

        <label className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-800 dark:bg-slate-900">
          <Eye className="size-4 text-slate-400" />
          <select
            value={highlightId ?? ''}
            onChange={e => setHighlightId(e.target.value || null)}
            className="max-w-28 bg-transparent text-sm outline-none"
            aria-label="Surligner un médecin"
          >
            <option value="">Tous</option>
            {doctors.map(d => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>

        {isAdmin && (
          <button
            onClick={() => void toggleLock()}
            className={`flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-medium ${
              locked
                ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                : 'border-slate-200 bg-white hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800'
            }`}
          >
            {locked ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
            <span className="hidden sm:inline">{locked ? 'Déverrouiller' : 'Verrouiller'}</span>
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Bascule liste / grille (desktop uniquement — la grille 7 colonnes
              n'a pas de sens sur petit écran). */}
          <div className="hidden items-center rounded-xl border border-slate-200 bg-white p-1 lg:flex dark:border-slate-800 dark:bg-slate-900">
            <button
              onClick={() => changeView('list')}
              aria-pressed={view === 'list'}
              title="Vue liste (par semaine)"
              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium transition ${
                view === 'list'
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <List className="size-4" /> Liste
            </button>
            <button
              onClick={() => changeView('grid')}
              aria-pressed={view === 'grid'}
              title="Vue grille (7 colonnes)"
              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium transition ${
                view === 'grid'
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <LayoutGrid className="size-4" /> Grille
            </button>
          </div>
          <button
            onClick={handleExportPdf}
            title="Exporter le mois en PDF (Sem · Jour · S1J · S1N · S2J)"
            className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
          >
            <FileDown className="size-4" /> PDF
          </button>
          <button
            onClick={() => void loadData()}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
            aria-label="Rafraîchir"
            title="Rafraîchir"
          >
            <RefreshCw className={`size-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {uncovered.length > 0 && (
        <button
          onClick={jumpToFirstUncovered}
          className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-left text-sm text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
        >
          <AlertTriangle className="size-4 shrink-0" />
          <span className="flex-1">
            {uncovered.length} jour{uncovered.length > 1 ? 's' : ''} avec un créneau à couvrir
          </span>
          <span className="font-semibold underline">Voir</span>
        </button>
      )}

      {doctor &&
        (isDesktop && view === 'grid' ? (
          <MonthCalendarGrid
            weeks={weeks}
            shiftIndex={shiftIndex}
            leavesByDate={leavesByDate}
            notesByDate={notesByDate}
            wishesByDate={wishesByDate}
            hncByDate={hncByDate}
            doctorsById={doctorsById}
            selfDoctorId={doctor.id}
            highlightId={highlightId}
            locked={locked}
            onSlotClick={(iso, shiftType: ShiftType) => setSlot({ iso, shiftType })}
            onAddLeave={iso => setLeaveDate(iso)}
            onRemoveLeave={leave => void handleRemoveLeave(leave)}
            onEditNote={iso => setNoteDate(iso)}
            onCycleWish={iso => void handleCycleWish(iso)}
            onEditHnc={iso => setHncDate(iso)}
            dayRefs={dayRefs}
          />
        ) : (
          <MonthGrid
            weeks={weeks}
            shiftIndex={shiftIndex}
            leavesByDate={leavesByDate}
            notesByDate={notesByDate}
            issuesByDate={issuesByDate}
            wishesByDate={wishesByDate}
            hncByDate={hncByDate}
            doctorsById={doctorsById}
            selfDoctorId={doctor.id}
            highlightId={highlightId}
            locked={locked}
            onSlotClick={(iso, shiftType: ShiftType) => setSlot({ iso, shiftType })}
            onAddLeave={iso => setLeaveDate(iso)}
            onRemoveLeave={leave => void handleRemoveLeave(leave)}
            onEditNote={iso => setNoteDate(iso)}
            onCycleWish={iso => void handleCycleWish(iso)}
            onEditHnc={iso => setHncDate(iso)}
            dayRefs={dayRefs}
          />
        ))}

      {slot && doctor && (
        <AssignDialog
          target={slot}
          currentShift={currentShift}
          doctors={doctors}
          selfDoctorId={doctor.id}
          monthShifts={shifts}
          leaves={leaves}
          dayWishes={slotDayWishes}
          onAssign={handleAssign}
          onClear={handleClearSlot}
          onPropose={handlePropose}
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

      {noteDate && (
        <NoteDialog
          date={noteDate}
          initialNote={notesByDate.get(noteDate)?.note ?? ''}
          onSave={handleSaveNote}
          onDelete={handleDeleteNote}
          onClose={() => setNoteDate(null)}
        />
      )}

      {hncDate && doctor && (
        <HncDialog
          date={hncDate}
          doctors={doctors}
          selfDoctorId={doctor.id}
          dayEntries={hncByDate.get(hncDate) ?? []}
          onSubmit={(doctorId, hours) => handleSetHnc(hncDate, doctorId, hours)}
          onRemove={handleClearHnc}
          onClose={() => setHncDate(null)}
        />
      )}
    </div>
  );
}
