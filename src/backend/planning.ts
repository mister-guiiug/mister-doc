import { getSupabase } from '../lib/supabase.ts';
import { toISODate } from '../lib/dates.ts';
import type { ShiftType } from '../lib/shifts.ts';
import type { Shift } from './types.ts';

/** Bornes ISO d'un mois (année, mois 0-indexé) : [premier, dernier] inclus. */
function monthBounds(year: number, month: number): [string, string] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  return [toISODate(first), toISODate(last)];
}

/** Toutes les affectations d'un mois. */
export async function listMonthShifts(
  year: number,
  month: number
): Promise<Shift[]> {
  const [from, to] = monthBounds(year, month);
  const { data, error } = await getSupabase()
    .from('shifts')
    .select('*')
    .gte('work_date', from)
    .lte('work_date', to)
    .order('work_date');
  if (error) throw new Error(error.message);
  return (data ?? []) as Shift[];
}

/** Gardes sur une plage de dates (bornes ISO incluses). */
export async function listShiftsBetween(
  fromISO: string,
  toISO: string
): Promise<Shift[]> {
  const { data, error } = await getSupabase()
    .from('shifts')
    .select('*')
    .gte('work_date', fromISO)
    .lte('work_date', toISO);
  if (error) throw new Error(error.message);
  return (data ?? []) as Shift[];
}

/** Affecte (ou réaffecte) un médecin à un créneau donné (1 médecin/créneau/jour). */
export async function assignShift(
  workDate: string,
  shiftType: ShiftType,
  doctorId: string,
  createdBy: string | null
): Promise<Shift> {
  const { data, error } = await getSupabase()
    .from('shifts')
    .upsert(
      {
        work_date: workDate,
        shift_type: shiftType,
        doctor_id: doctorId,
        created_by: createdBy,
      },
      { onConflict: 'work_date,shift_type' }
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Shift;
}

/** Libère un créneau (supprime l'affectation). */
export async function clearShift(
  workDate: string,
  shiftType: ShiftType
): Promise<void> {
  const { error } = await getSupabase()
    .from('shifts')
    .delete()
    .eq('work_date', workDate)
    .eq('shift_type', shiftType);
  if (error) throw new Error(error.message);
}

/**
 * Abonnement Realtime aux changements de planning. Renvoie une fonction de
 * désabonnement. `onChange` est appelé à chaque INSERT/UPDATE/DELETE.
 */
export function subscribeShifts(onChange: () => void): () => void {
  const channel = getSupabase()
    .channel('shifts-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'shifts' },
      () => onChange()
    )
    .subscribe();
  return () => {
    void getSupabase().removeChannel(channel);
  };
}
