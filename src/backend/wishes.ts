import { getSupabase } from '../lib/supabase.ts';
import { toISODate } from '../lib/dates.ts';
import type { Wish, WishKind } from './types.ts';

function monthBounds(year: number, month: number): [string, string] {
  return [toISODate(new Date(year, month, 1)), toISODate(new Date(year, month + 1, 0))];
}

export async function listMonthWishes(
  year: number,
  month: number
): Promise<Wish[]> {
  const [from, to] = monthBounds(year, month);
  const { data, error } = await getSupabase()
    .from('wishes')
    .select('*')
    .gte('work_date', from)
    .lte('work_date', to);
  if (error) throw new Error(error.message);
  return (data ?? []) as Wish[];
}

/** Pose/met à jour son vœu pour un jour (RLS : soi uniquement). */
export async function setWish(
  doctorId: string,
  workDate: string,
  kind: WishKind,
  note: string | null
): Promise<void> {
  const { error } = await getSupabase()
    .from('wishes')
    .upsert(
      { doctor_id: doctorId, work_date: workDate, kind, note },
      { onConflict: 'doctor_id,work_date' }
    );
  if (error) throw new Error(error.message);
}

export async function clearWish(
  doctorId: string,
  workDate: string
): Promise<void> {
  const { error } = await getSupabase()
    .from('wishes')
    .delete()
    .eq('doctor_id', doctorId)
    .eq('work_date', workDate);
  if (error) throw new Error(error.message);
}

export function subscribeWishes(onChange: () => void): () => void {
  const channel = getSupabase()
    .channel('wishes-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'wishes' },
      () => onChange()
    )
    .subscribe();
  return () => {
    void getSupabase().removeChannel(channel);
  };
}
