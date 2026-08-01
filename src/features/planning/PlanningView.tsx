import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth.ts';
import { useToast } from '../../components/Toast.tsx';
import { useI18n } from '../../i18n/index.ts';
import { fromISODate, toISODate } from '../../lib/dates.ts';
import type { ShiftType } from '../../lib/shifts.ts';
import type { Leave, WishKind } from '../../backend/types.ts';
import { Counters } from './Counters.tsx';
import { exportMonthPdf } from './monthPdf.ts';
import type { SlotTarget } from './AssignDialog.tsx';
import { monthParam, parseMonthParam } from './monthUrl.ts';
import { PlanningToolbar } from './PlanningToolbar.tsx';
import { PlanningBanners } from './PlanningBanners.tsx';
import { PlanningGrids } from './PlanningGrids.tsx';
import { PlanningDialogs } from './PlanningDialogs.tsx';
import { FullScreenSpinner } from '../../components/Spinner.tsx';
import { usePlanningData } from './usePlanningData.ts';
import { usePlanningMutations } from './usePlanningMutations.ts';

export function PlanningView() {
  const { doctor, isAdmin } = useAuth();
  const toast = useToast();
  const { t, m } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const today = new Date();
  const todayIso = toISODate(today);
  const initialMonth = parseMonthParam(searchParams.get('m')) ?? {
    year: today.getFullYear(),
    month: today.getMonth(),
  };
  const [year, setYear] = useState(initialMonth.year);
  const [month, setMonth] = useState(initialMonth.month);
  const [slot, setSlot] = useState<SlotTarget | null>(null);
  const [leaveDate, setLeaveDate] = useState<string | null>(null);
  const [noteDate, setNoteDate] = useState<string | null>(null);
  const [hncDate, setHncDate] = useState<string | null>(null);
  const [copyMonthOpen, setCopyMonthOpen] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'grid'>(() => {
    try {
      return localStorage.getItem('mister-doc:view') === 'list'
        ? 'list'
        : 'grid';
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
  const mutations = usePlanningMutations(data, { doctor, year, month, toast });
  // Extraites de `mutations` : ces deux-là alimentent des `useCallback`, dont la
  // liste de dépendances doit porter la FONCTION elle-même (et non l'objet qui
  // la contient) pour rester juste — et vérifiable par le lint.
  const { handleRemoveLeave, handleCycleWish } = mutations;

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
      dayRefs.current[d]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
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

  const monthTitle = `${m.common.months[month]} ${year}`;

  function handleExportPdf() {
    exportMonthPdf({
      title: monthTitle,
      weeks: data.weeks,
      shiftIndex: data.shiftIndex,
      doctorsById: data.doctorsById,
    });
  }

  // Copier le mois précédent : impossible sur un mois verrouillé — on le dit
  // plutôt que de laisser l'utilisateur confirmer un récapitulatif inapplicable.
  function openCopyMonth() {
    if (data.locked) {
      toast.error(t('copyMonth.lockedError'));
      return;
    }
    setCopyMonthOpen(true);
  }

  function jumpToFirstUncovered() {
    const iso = data.uncovered[0]?.iso;
    if (iso)
      dayRefs.current[iso]?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
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
      for (const w of data.wishesByDate.get(slot.iso) ?? [])
        m.set(w.doctor_id, w.kind);
    return m;
  }, [slot, data.wishesByDate]);

  if (data.firstLoad)
    return <FullScreenSpinner label={t('planning.loadingPlanning')} />;

  return (
    <div
      className="mx-auto flex max-w-5xl flex-col gap-4 px-3 py-4 sm:px-4"
      onTouchStart={e => (touchX.current = e.touches[0]?.clientX ?? null)}
      onTouchEnd={e => {
        const t = e.changedTouches[0];
        if (touchX.current == null || !t) return;
        const dx = t.clientX - touchX.current;
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

      <PlanningToolbar
        monthTitle={monthTitle}
        locked={data.locked}
        isAdmin={isAdmin}
        doctors={data.doctors}
        highlightId={highlightId}
        view={view}
        refreshing={data.refreshing}
        onShiftMonth={shiftMonth}
        onToday={() => goToMonth(today.getFullYear(), today.getMonth())}
        onHighlightChange={setHighlightId}
        onToggleLock={() => void mutations.toggleLock()}
        onCopyPreviousMonth={openCopyMonth}
        onChangeView={changeView}
        onExportPdf={handleExportPdf}
        onRefresh={() => void data.loadData()}
      />

      <PlanningBanners
        error={data.error}
        offline={data.offline}
        lastSync={data.lastSync}
        uncoveredCount={data.uncovered.length}
        onSeeUncovered={jumpToFirstUncovered}
      />

      {doctor && (
        <PlanningGrids
          calendar={isDesktop && view === 'grid'}
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
      )}

      <PlanningDialogs
        doctor={doctor}
        data={data}
        mutations={mutations}
        slot={slot}
        currentShift={currentShift}
        slotDayWishes={slotDayWishes}
        leaveDate={leaveDate}
        noteDate={noteDate}
        hncDate={hncDate}
        year={year}
        month={month}
        copyMonthOpen={copyMonthOpen}
        onCloseSlot={() => setSlot(null)}
        onCloseLeave={() => setLeaveDate(null)}
        onCloseNote={() => setNoteDate(null)}
        onCloseHnc={() => setHncDate(null)}
        onCloseCopyMonth={() => setCopyMonthOpen(false)}
      />
    </div>
  );
}
