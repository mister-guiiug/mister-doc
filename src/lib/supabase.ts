import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.ts';

let client: SupabaseClient | null = null;

/**
 * Client Supabase créé paresseusement. La clé anon est publique (sûre dans un
 * bundle) : la sécurité repose entièrement sur les policies RLS côté serveur.
 * `flowType: 'pkce'` pour un flux d'authentification robuste.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;
  client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, flowType: 'pkce' },
  });
  return client;
}
