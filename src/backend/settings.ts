import { getSupabase } from '../lib/supabase.ts';
import type { AppSettings } from './types.ts';

export async function getSettings(): Promise<AppSettings> {
  const { data, error } = await getSupabase().rpc('get_settings');
  if (error) throw new Error(error.message);
  return (data ?? {}) as AppSettings;
}

export async function setSettings(settings: AppSettings): Promise<AppSettings> {
  const { data, error } = await getSupabase().rpc('set_settings', {
    p: settings,
  });
  if (error) throw new Error(error.message);
  return (data ?? {}) as AppSettings;
}
