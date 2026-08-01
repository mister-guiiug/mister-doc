import { getSupabase } from '../lib/supabase.ts';

/**
 * Déclenche manuellement les rappels de garde (« garde demain » / « nuit ce
 * soir ») — réservé aux admins (RPC `admin_send_reminders`). Sinon, un job
 * pg_cron quotidien les envoie automatiquement. Renvoie le nombre créé.
 */
export async function sendReminders(): Promise<number> {
  const { data, error } = await getSupabase().rpc('admin_send_reminders');
  if (error) throw new Error(error.message);
  return (data as number | null) ?? 0;
}

/**
 * Déclenche manuellement le récapitulatif hebdomadaire (toutes les gardes des
 * 7 prochains jours, en une notification par médecin) — réservé aux admins
 * (RPC `admin_send_weekly_digest`). Sinon un job pg_cron l'envoie le dimanche
 * soir. Renvoie le nombre de récapitulatifs créés.
 */
export async function sendWeeklyDigest(): Promise<number> {
  const { data, error } = await getSupabase().rpc('admin_send_weekly_digest');
  if (error) throw new Error(error.message);
  return (data as number | null) ?? 0;
}
