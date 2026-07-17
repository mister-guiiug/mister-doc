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
import { fromISODate, monthLabel, toISODate } from '../../lib/dates.ts';
import type { ShiftType } from '../../lib/shifts.ts';
import type { Leave, WishKind } from '../../backend/types.ts';
import { Counters } from './Counters.tsx';
import { MonthGrid } from './MonthGrid.tsx';
import { MonthCalendarGrid } from './MonthCalendarGrid.tsx';
import { exportMonthPdf } from './monthPdf.ts';
import { AssignDialog, type SlotTarget } from './AssignDialog.tsx';
import { LeaveDialog } from './LeaveDialog.tsx';
import { NoteDialog } from './NoteDialog.tsx';
import { HncDialog } from './HncDialog.tsx';
import { FullScreenSpinner } from '../../components/Spinner.tsx';
import { usePlanningData } from './usePlanningData.ts';
import { usePlanningMutations } from './usePlanningMutations.ts';

/** Sérialise un mois affiché pour l'URL (`?m=YYYY-MM`). */
function monthParam(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/** Lit un paramètre `?m=YYYY-MM` ; renvoie null si absent ou invalide. */
function parseMonthParam(v: string | null): { year: number; month: number } | null {
  const match = v && /^(\d{4})-(\d{2})$/.exec(v);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  if (month < 0 || month > 11) return null;
  return { year, month };
}

export function PlanningView() {
  const { doctor, isAdmin } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const today = new Date();
  const todayIso = toISODate(today);
  const initialMonth =
    parseMonthParam(searchParams.get('m')) ??
    { year: today.getFullYear(), month: today.getMonth() };
  const [year, setYear] = useState(initialMonth.year);
  const [month, setMonth] = useState(initialMonth.month);
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

  const data = usePlanningData(year, month);
  const {
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
  } = usePlanningMutations(data, { doctor, year, month, toast });

  // Navigue vers un mois en reflétant le choix dans l'URL (`?m=YYYY-MM`) : le
  // lien devient partageable et le mois est conservé au rechargement.
  const goToMonth = useCallback(
    (y: number, mo: number) => {
      const dt = new Date(y, mo, 1);
      setYear(dt.getFullYear());
      setMonth(dt.getMonth());
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          next.delete('d');
          next.set('m', monthParam(dt.getFullYear(), dt.getMonth()));
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const on = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  // Raccourci depuis une notification (`#/?d=YYYY-MM-DD`) : bascule sur le bon
  // mois, défile jusqu'au jour, puis remplace `d` par `m` (mois conservé).
  useEffect(() => {
    const d = searchParams.get('d');
    if (!d) return;
    const dt = fromISODate(d);
    if (Number.isNaN(dt.getTime())) {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          next.delete('d');
          return next;
        },
        { replace: true }
      );
      return;
    }
    setYear(dt.getFullYear());
    setMonth(dt.getMonth());
    const t = setTimeout(() => {
      dayRefs.current[d]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          next.delete('d');
          next.set('m', monthParam(dt.getFullYear(), dt.getMonth()));
          return next;
        },
        { replace: true }
      );
    }, 350);
    return () => clearTimeout(t);
  }, [searchParams, setSearchParams]);

  // Au premier rendu, reflète le mois courant dans l'URL s'il n'y est pas déjà
  // (sauf si un raccourci `?d=` pilote le mois) : lien partageable dès l'ouverture.
  useEffect(() => {
    if (searchParams.get('m') || searchParams.get('d')) return;
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        next.set('m', monthParam(year, month));
        return next;
      },
      { replace: true }
    );
    // Montage uniquement : on ne veut pas ré-inscrire `m` à chaque changement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function shiftMonth(delta: number) {
    goToMonth(year, month + delta);
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
      weeks: data.weeks,
      shiftIndex: data.shiftIndex,
      doctorsById: data.doctorsById,
    });
  }

  function jumpToFirstUncovered() {
    const iso = data.uncovered[0]?.iso;
    if (iso) dayRefs.current[iso]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Callbacks stables passés aux grilles mémoïsées : sans eux, chaque cellule se
  // re-rendrait à tout changement d'état sans rapport (dialogue, surlignage…).
  const onSlotClick = useCallback(
    (iso: string, shiftType: ShiftType) => setSlot({ iso, shiftType }),
    []
  );
  const onAddLeaveClick = useCallback((iso: string) => setLeaveDate(iso), []);
  const onEditNoteClick = useCallback((iso: string) => setNoteDate(iso), []);
  const onEditHncClick = useCallback((iso: string) => setHncDate(iso), []);
  const onRemoveLeaveClick = useCallback(
    (leave: Leave) => void handleRemoveLeave(leave),
    [handleRemoveLeave]
  );
  const onCycleWishClick = useCallback(
    (iso: string) => void handleCycleWish(iso),
    [handleCycleWish]
  );

  const currentShift = slot
    ? data.shiftIndex.get(`${slot.iso}|${slot.shiftType}`)
    : undefined;
  const slotDayWishes = useMemo(() => {
    const m = new Map<string, WishKind>();
    if (slot)
      for (const w of data.wishesByDate.get(slot.iso) ?? []) m.set(w.doctor_id, w.kind);
    return m;
  }, [slot, data.wishesByDate]);

  if (data.firstLoad) return <FullScreenSpinner label="Chargement du planning…" />;

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
          shifts={data.shifts}
          leaves={data.leaves}
          hnc={data.hnc}
          doctorId={doctor.id}
          year={year}
          month={month}
          reloadKey={data.reloadKey}
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
            {data.locked && <Lock className="size-4 text-slate-400" />}
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
          onClick={() => goToMonth(today.getFullYear(), today.getMonth())}
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
            {data.doctors.map(d => (
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
              data.locked
                ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                : 'border-slate-200 bg-white hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800'
            }`}
          >
            {data.locked ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
            <span className="hidden sm:inline">{data.locked ? 'Déverrouiller' : 'Verrouiller'}</span>
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
            onClick={() => void data.loadData()}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
            aria-label="Rafraîchir"
            title="Rafraîchir"
          >
            <RefreshCw className={`size-5 ${data.refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {data.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {data.error}
        </p>
      )}

      {data.uncovered.length > 0 && (
        <button
          onClick={jumpToFirstUncovered}
          className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-left text-sm text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
        >
          <AlertTriangle className="size-4 shrink-0" />
          <span className="flex-1">
            {data.uncovered.length} jour{data.uncovered.length > 1 ? 's' : ''} avec un créneau à couvrir
          </span>
          <span className="font-semibold underline">Voir</span>
        </button>
      )}

      {doctor &&
        (isDesktop && view === 'grid' ? (
          <MonthCalendarGrid
            weeks={data.weeks}
            shiftIndex={data.shiftIndex}
            leavesByDate={data.leavesByDate}
            notesByDate={data.notesByDate}
            issuesByDate={data.issuesByDate}
            wishesByDate={data.wishesByDate}
            hncByDate={data.hncByDate}
            doctorsById={data.doctorsById}
            selfDoctorId={doctor.id}
            highlightId={highlightId}
            todayIso={todayIso}
            locked={data.locked}
            onSlotClick={onSlotClick}
            onAddLeave={onAddLeaveClick}
            onRemoveLeave={onRemoveLeaveClick}
            onEditNote={onEditNoteClick}
            onCycleWish={onCycleWishClick}
            onEditHnc={onEditHncClick}
            dayRefs={dayRefs}
          />
        ) : (
          <MonthGrid
            weeks={data.weeks}
            shiftIndex={data.shiftIndex}
            leavesByDate={data.leavesByDate}
            notesByDate={data.notesByDate}
            issuesByDate={data.issuesByDate}
            wishesByDate={data.wishesByDate}
            hncByDate={data.hncByDate}
            doctorsById={data.doctorsById}
            selfDoctorId={doctor.id}
            highlightId={highlightId}
            todayIso={todayIso}
            locked={data.locked}
            onSlotClick={onSlotClick}
            onAddLeave={onAddLeaveClick}
            onRemoveLeave={onRemoveLeaveClick}
            onEditNote={onEditNoteClick}
            onCycleWish={onCycleWishClick}
            onEditHnc={onEditHncClick}
            dayRefs={dayRefs}
          />
        ))}

      {slot && doctor && (
        <AssignDialog
          target={slot}
          currentShift={currentShift}
          doctors={data.doctors}
          selfDoctorId={doctor.id}
          monthShifts={data.shifts}
          leaves={data.leaves}
          dayWishes={slotDayWishes}
          onAssign={doctorId => handleAssign(slot, doctorId)}
          onClear={() => handleClearSlot(slot)}
          onPropose={(toDoctor, message) => handlePropose(slot, toDoctor, message)}
          onClose={() => setSlot(null)}
        />
      )}

      {leaveDate && doctor && (
        <LeaveDialog
          date={leaveDate}
          doctors={data.doctors}
          selfDoctorId={doctor.id}
          onSubmit={handleAddLeave}
          onClose={() => setLeaveDate(null)}
        />
      )}

      {noteDate && (
        <NoteDialog
          date={noteDate}
          initialNote={data.notesByDate.get(noteDate)?.note ?? ''}
          onSave={text => handleSaveNote(noteDate, text)}
          onDelete={() => handleDeleteNote(noteDate)}
          onClose={() => setNoteDate(null)}
        />
      )}

      {hncDate && doctor && (
        <HncDialog
          date={hncDate}
          doctors={data.doctors}
          selfDoctorId={doctor.id}
          dayEntries={data.hncByDate.get(hncDate) ?? []}
          onSubmit={(doctorId, hours) => handleSetHnc(hncDate, doctorId, hours)}
          onRemove={handleClearHnc}
          onClose={() => setHncDate(null)}
        />
      )}
    </div>
  );
}
