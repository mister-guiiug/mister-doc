import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.ts';

let client: SupabaseClient | null = null;

/**
 * Client Supabase créé paresseusement. La clé anon est publique (sûre dans un
 * bundle) : la sécurité repose entièrement sur les policies RLS côté serveur.
 * `flowType: 'pkce'` pour un flux d'authentification robuste.
 *
 * `experimental.passkey` active les passkeys / WebAuthn (`signInWithPasskey`,
 * `registerPasskey`, `auth.passkey.*`) — connexion par empreinte / Face ID /
 * Windows Hello. API Supabase en **beta** ; sans ce drapeau, ces méthodes lèvent.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;
  client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      flowType: 'pkce',
      experimental: { passkey: true },
    },
  });
  return client;
}

/**
 * Abonnement Realtime générique à une table : appelle `onChange` à chaque
 * INSERT/UPDATE/DELETE et renvoie une fonction de désabonnement. Factorise le
 * boilerplate identique des modules `backend/*` (un canal par table).
 */
export function subscribeTable(
  table: string,
  onChange: () => void
): () => void {
  const sb = getSupabase();
  const channel = sb
    .channel(`${table}-changes`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      () => onChange()
    )
    .subscribe();
  return () => {
    void sb.removeChannel(channel);
  };
}
