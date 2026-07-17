import type { MonthDay } from '../../lib/dates.ts';
import type { ShiftType } from '../../lib/shifts.ts';
import type { Issue } from '../../lib/validation.ts';
import type {
  Doctor,
  DayNote,
  HncEntry,
  Leave,
  Shift,
  Wish,
} from '../../backend/types.ts';

/**
 * Types partagés par les deux rendus du planning (`MonthGrid` en liste et
 * `MonthCalendarGrid` en grille 7 colonnes) et leurs sous-composants jour.
 * Une seule source de vérité évite de redéclarer les mêmes ~15 props dans
 * quatre endroits.
 */

/** Actions déclenchées depuis une case de jour. */
export interface DayCallbacks {
  onSlotClick: (iso: string, shiftType: ShiftType) => void;
  onAddLeave: (iso: string) => void;
  onRemoveLeave: (leave: Leave) => void;
  onEditNote: (iso: string) => void;
  onCycleWish: (iso: string) => void;
  onEditHnc: (iso: string) => void;
}

/** Index mensuels (clé = date ISO) partagés par les deux grilles. */
export interface GridData {
  shiftIndex: Map<string, Shift>;
  leavesByDate: Map<string, Leave[]>;
  notesByDate: Map<string, DayNote>;
  issuesByDate: Map<string, Issue[]>;
  wishesByDate: Map<string, Wish[]>;
  hncByDate: Map<string, HncEntry[]>;
  doctorsById: Map<string, Doctor>;
}

/** Props communes aux deux composants de grille (liste et calendrier). */
export interface PlanningGridProps extends GridData, DayCallbacks {
  weeks: { week: number; days: MonthDay[] }[];
  selfDoctorId: string;
  highlightId: string | null;
  todayIso: string;
  locked: boolean;
  dayRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
}

/** Props d'un sous-composant jour (`DayRow` en liste, `DayCell` en grille). */
export interface DayProps extends DayCallbacks {
  day: MonthDay;
  shiftIndex: Map<string, Shift>;
  leaves: Leave[];
  note?: DayNote;
  issues: Issue[];
  wishes: Wish[];
  hnc: HncEntry[];
  doctorsById: Map<string, Doctor>;
  selfDoctorId: string;
  highlightId: string | null;
  isToday: boolean;
  locked: boolean;
  dayRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
}
