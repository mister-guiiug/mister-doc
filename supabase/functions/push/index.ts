// Edge Function « push » — envoi des notifications Web Push.
//
// Déclenchée par un WEBHOOK BASE DE DONNÉES sur INSERT dans `public.notifications`
// (Supabase → Database → Webhooks). Corps reçu : { type, table, record, ... }.
// Pour chaque abonnement du médecin concerné, envoie un push chiffré (VAPID) ;
// purge les abonnements expirés (404/410).
//
// Déploiement :  supabase functions deploy push --no-verify-jwt
// Secrets requis :
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY  (npx web-push generate-vapid-keys)
//   VAPID_SUBJECT       ex. mailto:admin@votre-domaine.fr
//   APP_URL             ex. https://mister-guiiug.github.io/mister-doc/
//   WEBHOOK_SECRET      OBLIGATOIRE — partagé avec le header du webhook ; sans
//                       lui la fonction refuse tout appel (fail-closed).
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement.

import webpush from 'npm:web-push@3.6.7';
import { createLogger, errMessage } from '../_shared/log.ts';

const log = createLogger('push');

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT =
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com';
const APP_URL = Deno.env.get('APP_URL') ?? '';
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET') ?? '';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

interface NotificationRecord {
  doctor_id: string;
  type: string;
  title: string;
  body: string | null;
  work_date: string | null;
}

interface SubRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

async function rest<T>(path: string, init?: RequestInit): Promise<T | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`REST ${path}: ${res.status}`);
  return res.status === 204 ? null : ((await res.json()) as T);
}

/** URL d'ouverture (routes en hash) selon le type de notification. */
function targetUrl(rec: NotificationRecord): string {
  const base = APP_URL.endsWith('/') ? APP_URL : `${APP_URL}/`;
  if (rec.type === 'approval_request') return `${base}#/admin`;
  if (rec.work_date) return `${base}#/?d=${rec.work_date}`;
  return `${base}#/`;
}

/**
 * Origine d'un endpoint push (`https://fcm.googleapis.com`) — suffit à
 * identifier le service fautif (FCM, Mozilla, WNS) sans journaliser l'endpoint
 * complet, qui est un identifiant d'appareil (donnée personnelle).
 */
function originOf(endpoint: string): string {
  try {
    return new URL(endpoint).origin;
  } catch {
    return 'inconnu';
  }
}

/** Comparaison à temps constant (évite un oracle temporel sur le secret). */
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('ok'); // sonde santé / GET
  // Fail-closed : la fonction étant déployée `--no-verify-jwt`, le secret partagé
  // avec le webhook base de données est OBLIGATOIRE. Sans lui, la fonction est
  // refusée (sinon n'importe quel POST anonyme enverrait des push arbitraires).
  if (!WEBHOOK_SECRET) {
    log.error('config_missing', { secret: 'WEBHOOK_SECRET' });
    return new Response('WEBHOOK_SECRET non configuré', { status: 500 });
  }
  if (
    !timingSafeEqual(req.headers.get('x-webhook-secret') ?? '', WEBHOOK_SECRET)
  ) {
    // Appel non authentifié : webhook mal configuré, ou sondage extérieur.
    log.warn('forbidden');
    return new Response('forbidden', { status: 401 });
  }
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    log.error('config_missing', { secret: 'VAPID' });
    return new Response('VAPID non configuré', { status: 500 });
  }

  let rec: NotificationRecord | undefined;
  try {
    const body = await req.json();
    rec = (body.record ?? body) as NotificationRecord;
  } catch {
    log.warn('bad_request');
    return new Response('bad request', { status: 400 });
  }
  if (!rec?.doctor_id) {
    log.warn('no_record');
    return new Response('no record', { status: 200 });
  }

  const subs =
    (await rest<SubRow[]>(
      `push_subscriptions?doctor_id=eq.${rec.doctor_id}&select=endpoint,p256dh,auth`
    )) ?? [];

  const payload = JSON.stringify({
    title: rec.title,
    body: rec.body ?? '',
    url: targetUrl(rec),
    tag: rec.type,
  });

  // Bilan d'envoi : jusqu'ici toute erreur était avalée silencieusement, donc
  // une panne de masse (VAPID invalide, quota du service de push) restait
  // invisible. On compte désormais chaque issue et on journalise les échecs.
  let sent = 0;
  let expired = 0;
  let failed = 0;

  await Promise.all(
    subs.map(async s => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        );
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          // Abonnement révoqué côté navigateur : purge normale, pas une panne.
          expired++;
          await rest(
            `push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`,
            { method: 'DELETE' }
          ).catch(err => log.warn('purge_failed', { reason: errMessage(err) }));
        } else {
          failed++;
          // `origin` seul : l'endpoint complet est un identifiant d'appareil.
          log.error('send_failed', {
            status: code ?? null,
            origin: originOf(s.endpoint),
            reason: errMessage(e),
          });
        }
      }
    })
  );

  log.info('delivered', {
    type: rec.type,
    subs: subs.length,
    sent,
    expired,
    failed,
  });

  return new Response(JSON.stringify({ sent, expired, failed }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
