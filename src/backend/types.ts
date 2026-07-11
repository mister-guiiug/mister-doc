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
