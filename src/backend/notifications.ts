import { getSupabase, subscribeTable } from '../lib/supabase.ts';
import type { Notification } from './types.ts';

/** Dernières notifications du médecin connecté (RLS : les siennes seulement). */
export async function listNotifications(limit = 30): Promise<Notification[]> {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as Notification[];
}

export async function markAllRead(): Promise<void> {
  const sb = await getSupabase();
  const { error } = await sb.rpc('mark_all_notifications_read');
  if (error) throw new Error(error.message);
}

export async function markRead(id: string): Promise<void> {
  const sb = await getSupabase();
  const { error } = await sb
    .from('notifications')
    .update({ read: true })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteNotification(id: string): Promise<void> {
  const sb = await getSupabase();
  const { error } = await sb.from('notifications').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export function subscribeNotifications(onChange: () => void): () => void {
  return subscribeTable('notifications', onChange);
}
