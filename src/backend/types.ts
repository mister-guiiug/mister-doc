import type { ShiftType } from '../lib/shifts.ts';
import type { LeaveKind } from '../lib/leaves.ts';

export interface Doctor {
  id: string;
  auth_id: string | null;
  name: string;
  email: string | null;
  color: string;
  is_admin: boolean;
  approved: boolean;
  created_at: string;
}

export interface Shift {
  id: string;
  work_date: string; // YYYY-MM-DD
  shift_type: ShiftType;
  doctor_id: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Leave {
  id: string;
  work_date: string; // YYYY-MM-DD
  kind: LeaveKind;
  hours: number | null; // renseigné pour les formations
  doctor_id: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DayNote {
  work_date: string; // YYYY-MM-DD
  note: string;
  created_by: string | null;
  updated_at: string;
}

export interface LockedMonth {
  year: number;
  month: number; // 0 = janvier (convention JS)
  locked_by: string | null;
  locked_at: string;
}

export interface AppSettings {
  /** Compter le Lundi de Pentecôte comme férié (couverture réduite). */
  pentecote_ferie?: boolean;
}

export interface Notification {
  id: string;
  doctor_id: string;
  type: string;
  title: string;
  body: string | null;
  work_date: string | null;
  read: boolean;
  created_at: string;
}

export interface BackupMeta {
  id: string;
  kind: 'auto' | 'manual';
  size: number | null;
  created_at: string;
}

export type WishKind = 'prefer' | 'avoid';
export interface Wish {
  id: string;
  doctor_id: string;
  work_date: string;
  kind: WishKind;
  note: string | null;
  created_at: string;
}

export type SwapStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';
export interface SwapRequest {
  id: string;
  work_date: string;
  shift_type: ShiftType;
  from_doctor: string;
  to_doctor: string | null;
  status: SwapStatus;
  message: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}
