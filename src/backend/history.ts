import { getSupabase } from '../lib/supabase.ts';
import type { ShiftType } from '../lib/shifts.ts';
import type { ShiftHistory } from './types.ts';

/** Derniers changements d'une case (créneau), du plus récent au plus ancien. */
export async function listSlotHistory(
  workDate: string,
  shiftType: ShiftType,
  limit = 10
): Promise<ShiftHistory[]> {
  const { data, error } = await getSupabase()
    .from('shift_history')
    .select('*')
    .eq('work_date', workDate)
    .eq('shift_type', shiftType)
    .order('changed_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as ShiftHistory[];
}
