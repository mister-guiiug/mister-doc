import {
  createClient,
  type RealtimeChannel,
  type SupabaseClient,
} from '@supabase/supabase-js';
import { createSupabaseClientFactory } from '@mister-guiiug/dev-pwa-config/supabase-client';
import { env } from './env.ts';

/**
 * Client Supabase : la fabrique du SOCLE, avec les options de cette app.
 *
 * La clé anon est publique (sûre dans un bundle) : la sécurité repose
 * entièrement sur les policies RLS côté serveur. `flowType: 'pkce'` pour un
 * flux d'authentification robuste — et une nécessité de routage : la connexion
 * par lien renvoie alors `?code=`, que le `HashRouter` ne touche pas, là où un
 * jeton dans le fragment serait perdu (voir `signInWithLink`).
 *
 * `experimental.passkey` active les passkeys / WebAuthn (`signInWithPasskey`,
 * `registerPasskey`, `auth.passkey.*`) — connexion par empreinte / Face ID /
 * Windows Hello. API Supabase en **beta** ; sans ce drapeau, ces méthodes lèvent.
 * `persistSession` et `autoRefreshToken` sont les défauts de la fabrique.
 *
 * LE SDK RESTE DANS LE MORCEAU PRÉCHARGÉ, ET C'EST VOULU. Par défaut, la
 * fabrique importe `@supabase/supabase-js` à la demande, au premier
 * `getClient()` — le motif de mister-molkky, où la plupart des visiteurs ne
 * touchent jamais à la synchronisation. Ici c'est l'inverse : la porte d'accès
 * a besoin du client dès le premier rendu, pour lire la session. Un import
 * différé n'épargnerait rien, il ajouterait un aller-retour réseau AVANT
 * l'écran de connexion, à chaque première visite. `loader` rend donc l'import
 * statique : le morceau `supabase` reste `modulepreload` dans le document
 * (`manualChunks`, vite.config.ts), exactement comme avant.
 *
 * `env` est celui de `./env.ts`, validé au chargement du module : c'est lui
 * qui échoue tôt et clairement quand la configuration manque, comme avant. La
 * fabrique, qui ne lève qu'au premier `getClient()`, ne trouve donc jamais
 * rien à redire.
 */
export const supabase = createSupabaseClientFactory<SupabaseClient>({
  env,
  auth: { flowType: 'pkce', experimental: { passkey: true } },
  loader: () => Promise.resolve({ createClient }),
});

/**
 * Le client partagé, créé au premier appel. Asynchrone parce que la fabrique
 * l'est — c'est la promesse qui est gardée : deux appels concurrents ne créent
 * qu'un client, donc une seule connexion temps réel.
 */
export function getSupabase(): Promise<SupabaseClient> {
  return supabase.getClient();
}

/**
 * Abonnement Realtime générique à une table : appelle `onChange` à chaque
 * INSERT/UPDATE/DELETE et renvoie une fonction de désabonnement. Factorise le
 * boilerplate identique des modules `backend/*` (un canal par table).
 *
 * LE CONTRAT RESTE SYNCHRONE — un `useEffect` rend son nettoyage tout de
 * suite — alors que le client, lui, arrive par une promesse. Le canal est donc
 * ouvert à la résolution (une micro-tâche : le client existe déjà, la porte
 * d'accès l'a créé), et un désabonnement survenu AVANT est honoré : `arrete`
 * empêche l'ouverture, sans quoi le canal survivrait à son composant.
 */
export function subscribeTable(
  table: string,
  onChange: () => void
): () => void {
  let arrete = false;
  let ouvert: { sb: SupabaseClient; channel: RealtimeChannel } | undefined;
  void getSupabase().then(sb => {
    if (arrete) return;
    const channel = sb
      .channel(`${table}-changes`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () =>
        onChange()
      )
      .subscribe();
    ouvert = { sb, channel };
  });
  return () => {
    arrete = true;
    if (ouvert) void ouvert.sb.removeChannel(ouvert.channel);
  };
}
