import { getSupabase } from '../lib/supabase.ts';
import { env } from '../lib/env.ts';

/**
 * Le compte a-t-il déjà un token calendrier ? (monde « hashé au repos » : le token
 * n'est jamais ré-affichable, seul son statut l'est.) Renvoie `null` si la RPC
 * n'existe pas encore (base non migrée) → l'appelant retombe en mode legacy.
 */
export async function calendarTokenStatus(): Promise<boolean | null> {
  const { data, error } = await getSupabase().rpc('calendar_token_status');
  if (error) return null;
  return Boolean(data);
}

/**
 * (Legacy, avant migration 0018) Token en clair, créé à la volée. Utilisé
 * uniquement en repli quand `calendar_token_status` n'existe pas encore.
 */
export async function getMyCalendarToken(): Promise<string> {
  const { data, error } = await getSupabase().rpc('my_calendar_token');
  if (error) throw new Error(error.message);
  return data as string;
}

/** Régénère le token personnel (révoque l'ancien). */
export async function rotateCalendarToken(): Promise<string> {
  const { data, error } = await getSupabase().rpc('rotate_calendar_token');
  if (error) throw new Error(error.message);
  return data as string;
}

export interface FeedOptions {
  scope?: 'team' | 'me';
  timed?: boolean;
}

/** URL du flux iCalendar (.ics). */
export function calendarFeedUrl(token: string, opts: FeedOptions = {}): string {
  const base =
    env.VITE_SUPABASE_URL.replace(/\/$/, '') + '/functions/v1/calendar';
  const params = new URLSearchParams({ token });
  if (opts.scope === 'me') params.set('scope', 'me');
  if (opts.timed) params.set('timed', '1');
  return `${base}?${params.toString()}`;
}
