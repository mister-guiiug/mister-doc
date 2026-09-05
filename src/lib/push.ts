import {
  createPushClient,
  permissionState,
  pushSupport,
  type PushSupport,
  type PushTransport,
} from '@mister-guiiug/dev-pwa-config/push';
import {
  deletePushSubscription,
  savePushSubscription,
} from '../backend/push.ts';

/**
 * Web Push côté client : détection du support, (dés)abonnement via le service
 * worker, et enregistrement de l'abonnement en base. Tout est **inerte** si la
 * clé publique VAPID n'est pas configurée (`VITE_VAPID_PUBLIC_KEY`) : l'UI de
 * profil masque alors la section, l'app fonctionne normalement sans push.
 *
 * La MÉCANIQUE vient du socle (`@mister-guiiug/dev-pwa-config/push`) : état de
 * la permission (et le fait de ne pas la redemander quand elle est déjà
 * tranchée), cycle de vie de l'abonnement, conversion de la clé VAPID
 * base64url → octets, sérialisation. Ne reste ici que ce qui est propre à
 * l'app : la clé publique lue de l'environnement, et le TRANSPORT.
 *
 * POURQUOI PAS `push/supabase`. Le transport Supabase du socle écrit une
 * colonne `user_id` — l'identité `auth.users` — et une colonne `user_agent`.
 * Notre table `push_subscriptions` (migration `0013`) porte un `doctor_id` qui
 * référence `public.doctors (id)`, identité DISTINCTE de `auth.uid()` puisque
 * résolue par `current_doctor_id()`, et n'a pas de colonne `user_agent`. Ces
 * noms de colonnes ne sont pas paramétrables (seule la table l'est) : s'y
 * brancher demanderait une migration SQL, qui casserait au passage l'Edge
 * Function `push` et la migration `0019`, toutes deux écrites sur `doctor_id`.
 * On garde donc notre transport — ce que le socle prévoit explicitement, son
 * contrat tenant en trois méthodes.
 */

function pushPublicKey(): string {
  return import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';
}

/**
 * Le transport de l'app : la table `push_subscriptions` et son `doctor_id`.
 * Le médecin est passé en contexte par `enablePush`, faute de pouvoir le
 * déduire de la session (`auth.uid()` n'est pas `doctors.id`).
 */
function transport(): PushTransport {
  return {
    key: () => pushPublicKey() || undefined,

    async save(subscription, context) {
      if (!subscription) throw new Error('push : abonnement illisible');
      const doctorId = context?.doctorId;
      if (typeof doctorId !== 'string' || doctorId.length === 0) {
        throw new Error('push : médecin inconnu');
      }
      await savePushSubscription(doctorId, {
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      });
    },

    async remove(subscription) {
      if (!subscription) return;
      await deletePushSubscription(subscription.endpoint);
    },
  };
}

/**
 * Le client push du socle, reconstruit à chaque appel : `createPushClient`
 * capture son `env`, et un client gardé au niveau module figerait l'état du
 * navigateur au chargement du bundle. La construction ne coûte qu'une clôture.
 */
function client(env: unknown = globalThis) {
  return createPushClient({ transport: transport(), env });
}

/** Ce que ce navigateur sait faire — et, sinon, POURQUOI (dont le cas iOS). */
export function pushBrowserSupport(env: unknown = globalThis): PushSupport {
  return pushSupport(env);
}

/** Le push est-il prévu sur ce déploiement ? (clé VAPID posée au build) */
export function pushDeployed(): boolean {
  return pushPublicKey().length > 0;
}

/** Support navigateur ET clé VAPID configurée : le push est réellement utilisable. */
export function pushConfigured(env: unknown = globalThis): boolean {
  return pushDeployed() && pushSupport(env).supported;
}

/** Autorisation navigateur déjà refusée pour les notifications ? */
export function pushDenied(env: unknown = globalThis): boolean {
  return permissionState(env) === 'denied';
}

/** Endpoint de l'abonnement actif sur ce navigateur, ou `null`. */
export async function currentPushEndpoint(
  env: unknown = globalThis
): Promise<string | null> {
  const subscription = await client(env).current();
  return subscription?.endpoint ?? null;
}

/**
 * `'denied'` couvre le refus ET le rejet de la fenêtre d'autorisation : dans
 * les deux cas l'utilisateur n'a pas dit oui. `'error'` est tout le reste — une
 * vraie panne, qui ne doit pas être annoncée comme un refus.
 */
export type PushEnableResult = 'on' | 'denied' | 'error';

/**
 * Active le push : demande l'autorisation, (ré)abonne via le SW et enregistre
 * l'abonnement en base.
 */
export async function enablePush(
  doctorId: string,
  env: unknown = globalThis
): Promise<PushEnableResult> {
  const { ok, reason } = await client(env).subscribe({ doctorId });
  if (ok) return 'on';
  return reason?.startsWith('permission-') ? 'denied' : 'error';
}

/**
 * Désactive le push : retire l'abonnement en base PUIS désabonne le navigateur.
 * Cet ordre est celui du socle et il compte — désabonner d'abord perdrait
 * l'endpoint qu'il faut donner au serveur pour qu'il oublie l'abonnement, et
 * l'utilisateur qui a dit non continuerait de recevoir. Un échec lève, au lieu
 * d'annoncer une désactivation qui n'a pas eu lieu côté serveur.
 */
export async function disablePush(env: unknown = globalThis): Promise<void> {
  const { ok, reason } = await client(env).unsubscribe();
  if (!ok) throw new Error(`push : désabonnement impossible (${reason})`);
}
