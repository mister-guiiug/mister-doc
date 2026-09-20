import { getSupabase } from '../lib/supabase.ts';
import type { AppSettings } from './types.ts';

export async function getSettings(): Promise<AppSettings> {
  const sb = await getSupabase();
  const { data, error } = await sb.rpc('get_settings');
  if (error) throw new Error(error.message);
  return (data ?? {}) as AppSettings;
}

export async function setSettings(settings: AppSettings): Promise<AppSettings> {
  const sb = await getSupabase();
  const { data, error } = await sb.rpc('set_settings', {
    p: settings,
  });
  if (error) throw new Error(error.message);
  return (data ?? {}) as AppSettings;
}
