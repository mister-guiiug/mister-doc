import { getSupabase, subscribeTable } from '../lib/supabase.ts';
import type { ShiftType } from '../lib/shifts.ts';
import type { SwapRequest } from './types.ts';

/** Toutes les propositions (RLS : approuvés) — le client filtre par pertinence. */
export async function listSwaps(): Promise<SwapRequest[]> {
  const { data, error } = await getSupabase()
    .from('swap_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as SwapRequest[];
}

export async function proposeSwap(
  workDate: string,
  shiftType: ShiftType,
  toDoctor: string | null,
  message: string
): Promise<void> {
  const { error } = await getSupabase().rpc('propose_swap', {
    p_work_date: workDate,
    p_shift_type: shiftType,
    p_to_doctor: toDoctor,
    p_message: message,
  });
  if (error) throw new Error(error.message);
}

export async function acceptSwap(id: string): Promise<void> {
  const { error } = await getSupabase().rpc('accept_swap', { p_id: id });
  if (error) throw new Error(error.message);
}

export async function declineSwap(id: string): Promise<void> {
  const { error } = await getSupabase().rpc('decline_swap', { p_id: id });
  if (error) throw new Error(error.message);
}

export async function cancelSwap(id: string): Promise<void> {
  const { error } = await getSupabase().rpc('cancel_swap', { p_id: id });
  if (error) throw new Error(error.message);
}

export function subscribeSwaps(onChange: () => void): () => void {
  return subscribeTable('swap_requests', onChange);
}
