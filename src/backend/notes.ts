import { getSupabase } from '../lib/supabase.ts';
import { toISODate } from '../lib/dates.ts';
import type { DayNote } from './types.ts';

function monthBounds(year: number, month: number): [string, string] {
  return [toISODate(new Date(year, month, 1)), toISODate(new Date(year, month + 1, 0))];
}

export async function listMonthNotes(
  year: number,
  month: number
): Promise<DayNote[]> {
  const [from, to] = monthBounds(year, month);
  const { data, error } = await getSupabase()
    .from('day_notes')
    .select('*')
    .gte('work_date', from)
    .lte('work_date', to);
  if (error) throw new Error(error.message);
  return (data ?? []) as DayNote[];
}

export async function setNote(
  workDate: string,
  note: string,
  createdBy: string | null
): Promise<void> {
  const { error } = await getSupabase()
    .from('day_notes')
    .upsert(
      { work_date: workDate, note, created_by: createdBy },
      { onConflict: 'work_date' }
    );
  if (error) throw new Error(error.message);
}

export async function clearNote(workDate: string): Promise<void> {
  const { error } = await getSupabase()
    .from('day_notes')
    .delete()
    .eq('work_date', workDate);
  if (error) throw new Error(error.message);
}

export function subscribeNotes(onChange: () => void): () => void {
  const channel = getSupabase()
    .channel('notes-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'day_notes' },
      () => onChange()
    )
    .subscribe();
  return () => {
    void getSupabase().removeChannel(channel);
  };
}
