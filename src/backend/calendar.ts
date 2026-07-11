import { getSupabase } from '../lib/supabase.ts';
import { env } from '../lib/env.ts';

/** Token du flux calendrier (réservé aux médecins approuvés, via RPC). */
export async function getCalendarToken(): Promise<string | null> {
  const { data, error } = await getSupabase().rpc('calendar_token');
  if (error) throw new Error(error.message);
  return (data as string | null) ?? null;
}

/** URL du flux iCalendar (.ics). `doctorId` optionnel = flux personnel. */
export function calendarFeedUrl(token: string, doctorId?: string): string {
  const base =
    env.VITE_SUPABASE_URL.replace(/\/$/, '') + '/functions/v1/calendar';
  const params = new URLSearchParams({ token });
  if (doctorId) params.set('doctor', doctorId);
  return `${base}?${params.toString()}`;
}
