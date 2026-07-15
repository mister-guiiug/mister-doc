import { getSupabase, subscribeTable } from '../lib/supabase.ts';
import type { LockedMonth } from './types.ts';

export async function listLocks(): Promise<LockedMonth[]> {
  const { data, error } = await getSupabase().from('locked_months').select('*');
  if (error) throw new Error(error.message);
  return (data ?? []) as LockedMonth[];
}

export function isMonthLocked(
  locks: LockedMonth[],
  year: number,
  month: number
): boolean {
  return locks.some(l => l.year === year && l.month === month);
}

export async function lockMonth(
  year: number,
  month: number,
  lockedBy: string | null
): Promise<void> {
  const { error } = await getSupabase()
    .from('locked_months')
    .insert({ year, month, locked_by: lockedBy });
  if (error) throw new Error(error.message);
}

export async function unlockMonth(year: number, month: number): Promise<void> {
  const { error } = await getSupabase()
    .from('locked_months')
    .delete()
    .eq('year', year)
    .eq('month', month);
  if (error) throw new Error(error.message);
}

export function subscribeLocks(onChange: () => void): () => void {
  return subscribeTable('locked_months', onChange);
}
