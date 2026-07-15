import {
  deletePushSubscription,
  savePushSubscription,
} from '../backend/push.ts';

/**
 * Web Push côté client : détection du support, (dés)abonnement via le service
 * worker, et enregistrement de l'abonnement en base. Tout est **inerte** si la
 * clé publique VAPID n'est pas configurée (`VITE_VAPID_PUBLIC_KEY`) : l'UI de
 * profil masque alors la section, l'app fonctionne normalement sans push.
 */

export function pushPublicKey(): string {
  return import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';
}

/** Le navigateur sait-il gérer le Web Push ? */
export function pushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** Support navigateur ET clé VAPID configurée : le push est réellement utilisable. */
export function pushConfigured(): boolean {
  return pushSupported() && pushPublicKey().length > 0;
}

/** Convertit une clé VAPID base64url en `Uint8Array` (applicationServerKey). */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/** Endpoint de l'abonnement actif sur ce navigateur, ou `null`. */
export async function currentPushEndpoint(): Promise<string | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return sub?.endpoint ?? null;
}

/** Autorisation navigateur déjà refusée pour les notifications ? */
export function pushDenied(): boolean {
  return pushSupported() && Notification.permission === 'denied';
}

/**
 * Active le push : demande l'autorisation, (ré)abonne via le SW et enregistre
 * l'abonnement en base. Renvoie `'denied'` si l'utilisateur refuse.
 */
export async function enablePush(doctorId: string): Promise<'on' | 'denied'> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(pushPublicKey()),
    }));
  const json = sub.toJSON();
  await savePushSubscription(doctorId, {
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? '',
    auth: json.keys?.auth ?? '',
  });
  return 'on';
}

/** Désactive le push : désabonne le navigateur et retire l'abonnement en base. */
export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const { endpoint } = sub;
  await sub.unsubscribe().catch(() => undefined);
  await deletePushSubscription(endpoint).catch(() => undefined);
}
