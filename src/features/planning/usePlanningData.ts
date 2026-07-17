import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { weeksOfMonth } from '../../lib/dates.ts';
import { activeShiftTypes } from '../../lib/shifts.ts';
import { computeIssues } from '../../lib/validation.ts';
import { useDebouncedCallback } from '../../lib/useDebouncedCallback.ts';
import { groupBy } from '../../lib/collections.ts';
import { logError } from '../../lib/logger.ts';
import { idbGet, idbSet } from '../../lib/idbCache.ts';
import type {
  Doctor,
  DayNote,
  HncEntry,
  Leave,
  LockedMonth,
  Shift,
  Wish,
} from '../../backend/types.ts';
import { listDoctors } from '../../backend/doctors.ts';
import { listMonthShifts, subscribeShifts } from '../../backend/planning.ts';
import { listMonthLeaves, subscribeLeaves } from '../../backend/leaves.ts';
import { listMonthNotes, subscribeNotes } from '../../backend/notes.ts';
import { listMonthWishes, subscribeWishes } from '../../backend/wishes.ts';
import { listMonthHnc, subscribeHnc } from '../../backend/hnc.ts';
import { isMonthLocked, listLocks, subscribeLocks } from '../../backend/locks.ts';

/** Cliché des données d'un mois, conservé dans IndexedDB pour l'hors-ligne. */
interface CachedMonth {
  shifts: Shift[];
  leaves: Leave[];
  notes: DayNote[];
  wishes: Wish[];
  hnc: HncEntry[];
  at: number;
}

/**
 * Charge et tient à jour toutes les données du mois affiché, avec un cache
 * IndexedDB en « stale-while-revalidate » : le dernier cliché s'affiche
 * instantanément, le réseau prend le relais, et en cas d'échec réseau on reste
 * consultable hors-ligne (`offline`). Les setters sont exposés pour les
 * mutations optimistes (voir `usePlanningMutations`).
 */
export function usePlanningData(year: number, month: number) {
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
  // Affichage de données en cache faute de réseau, et horodatage de la dernière
  // synchro réussie (réseau) OU du cliché en cache affiché.
  const [offline, setOffline] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  // Jeton du mois pour lequel le réseau a déjà répondu : empêche un cliché de
  // cache (résolu plus tard) d'écraser des données fraîches.
  const freshRef = useRef<string | null>(null);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    const token = `${year}-${month}`;
    const key = `month:${token}`;
    try {
      const [s, l, n, w, h] = await Promise.all([
        listMonthShifts(year, month),
        listMonthLeaves(year, month),
        listMonthNotes(year, month),
        listMonthWishes(year, month),
        listMonthHnc(year, month),
      ]);
      freshRef.current = token;
      setShifts(s);
      setLeaves(l);
      setNotes(n);
      setWishes(w);
      setHnc(h);
      setReloadKey(k => k + 1);
      setError(null);
      setOffline(false);
      setLastSync(Date.now());
      void idbSet(key, {
        shifts: s,
        leaves: l,
        notes: n,
        wishes: w,
        hnc: h,
        at: Date.now(),
      } satisfies CachedMonth);
    } catch (err) {
      // Réseau indisponible : replier sur le cache s'il existe.
      const cached = await idbGet<CachedMonth>(key);
      if (cached) {
        if (freshRef.current !== token) {
          setShifts(cached.shifts);
          setLeaves(cached.leaves);
          setNotes(cached.notes);
          setWishes(cached.wishes);
          setHnc(cached.hnc);
          setLastSync(cached.at);
        }
        setOffline(true);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : 'Erreur de chargement');
      }
    } finally {
      setRefreshing(false);
    }
  }, [year, month]);

  // Peinture instantanée depuis le cache au changement de mois (avant le
  // réseau). `freshRef` est remis à zéro : si le réseau répond avant le cache,
  // le cliché (périmé) ne l'écrase pas.
  useEffect(() => {
    let alive = true;
    const token = `${year}-${month}`;
    freshRef.current = null;
    void idbGet<CachedMonth>(`month:${token}`).then(cached => {
      if (!alive || !cached || freshRef.current === token) return;
      setShifts(cached.shifts);
      setLeaves(cached.leaves);
      setNotes(cached.notes);
      setWishes(cached.wishes);
      setHnc(cached.hnc);
      setLastSync(cached.at);
      setFirstLoad(false);
    });
    return () => {
      alive = false;
    };
  }, [year, month]);

  useEffect(() => {
    // Médecins et verrous : cache d'abord (affichage immédiat), puis réseau.
    void idbGet<Doctor[]>('doctors').then(c => {
      if (c) setDoctors(d => (d.length ? d : c));
    });
    listDoctors()
      .then(d => {
        setDoctors(d);
        void idbSet('doctors', d);
      })
      .catch(e => logError('listDoctors', e));
    void idbGet<LockedMonth[]>('locks').then(c => {
      if (c) setLocks(l => (l.length ? l : c));
    });
    listLocks()
      .then(l => {
        setLocks(l);
        void idbSet('locks', l);
      })
      .catch(e => logError('listLocks', e));
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

  return {
    // état brut
    doctors,
    shifts,
    leaves,
    notes,
    wishes,
    hnc,
    locks,
    // setters (mutations optimistes)
    setLeaves,
    setShifts,
    setWishes,
    setHnc,
    setLocks,
    // statut
    firstLoad,
    refreshing,
    reloadKey,
    error,
    offline,
    lastSync,
    loadData,
    // index dérivés
    weeks,
    doctorsById,
    nameById,
    shiftIndex,
    leavesByDate,
    notesByDate,
    wishesByDate,
    hncByDate,
    issuesByDate,
    locked,
    uncovered,
  };
}

export type PlanningData = ReturnType<typeof usePlanningData>;
