import { getSupabase } from '../lib/supabase.ts';
import { toISODate } from '../lib/dates.ts';
import type { LeaveKind } from '../lib/leaves.ts';
import type { Leave } from './types.ts';

function monthBounds(year: number, month: number): [string, string] {
  return [toISODate(new Date(year, month, 1)), toISODate(new Date(year, month + 1, 0))];
}

/** Toutes les absences d'un mois. */
export async function listMonthLeaves(
  year: number,
  month: number
): Promise<Leave[]> {
  const [from, to] = monthBounds(year, month);
  const { data, error } = await getSupabase()
    .from('leaves')
    .select('*')
    .gte('work_date', from)
    .lte('work_date', to)
    .order('work_date');
  if (error) throw new Error(error.message);
  return (data ?? []) as Leave[];
}

/** Absences sur une plage de dates (bornes ISO incluses). */
export async function listLeavesBetween(
  fromISO: string,
  toISO: string
): Promise<Leave[]> {
  const { data, error } = await getSupabase()
    .from('leaves')
    .select('*')
    .gte('work_date', fromISO)
    .lte('work_date', toISO);
  if (error) throw new Error(error.message);
  return (data ?? []) as Leave[];
}

/** Pose (ou met à jour) une absence pour un médecin un jour donné. */
export async function setLeave(
  doctorId: string,
  workDate: string,
  kind: LeaveKind,
  hours: number | null,
  createdBy: string | null
): Promise<Leave> {
  const { data, error } = await getSupabase()
    .from('leaves')
    .upsert(
      {
        doctor_id: doctorId,
        work_date: workDate,
        kind,
        hours: kind === 'training' ? hours : null,
        created_by: createdBy,
      },
      { onConflict: 'doctor_id,work_date' }
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Leave;
}

/** Pose la même absence sur une plage de jours (bornes incluses). */
export async function setLeaveRange(
  doctorId: string,
  fromISO: string,
  toISO: string,
  kind: LeaveKind,
  hours: number | null,
  createdBy: string | null
): Promise<void> {
  const rows: {
    doctor_id: string;
    work_date: string;
    kind: LeaveKind;
    hours: number | null;
    created_by: string | null;
  }[] = [];
  const cursor = new Date(`${fromISO}T00:00:00`);
  const end = new Date(`${toISO}T00:00:00`);
  while (cursor <= end) {
    rows.push({
      doctor_id: doctorId,
      work_date: toISODate(cursor),
      kind,
      hours: kind === 'training' ? hours : null,
      created_by: createdBy,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  const { error } = await getSupabase()
    .from('leaves')
    .upsert(rows, { onConflict: 'doctor_id,work_date' });
  if (error) throw new Error(error.message);
}

export async function clearLeave(id: string): Promise<void> {
  const { error } = await getSupabase().from('leaves').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export function subscribeLeaves(onChange: () => void): () => void {
  const channel = getSupabase()
    .channel('leaves-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'leaves' },
      () => onChange()
    )
    .subscribe();
  return () => {
    void getSupabase().removeChannel(channel);
  };
}
