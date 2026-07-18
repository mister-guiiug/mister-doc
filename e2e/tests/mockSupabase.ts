import { expect, type Page } from '@playwright/test';

/**
 * Simule un utilisateur authentifié SANS toucher la vraie base Supabase :
 * - une session est semée dans localStorage (format supabase-js : `sb-<ref>-auth-token`),
 * - toutes les requêtes REST/RPC `supabase.co` sont servies par des fixtures,
 * - la connexion WebSocket Realtime est neutralisée.
 * `goOffline()` fait ensuite échouer les requêtes pour tester le mode hors-ligne.
 */

const REF = 'lgbuytinzukaxrqjwxme'; // ref du projet (URL de .env)
const USER_ID = '00000000-0000-4000-8000-000000000001';

const SELF = {
  id: 'doc-self',
  auth_id: USER_ID,
  name: 'DR E2E',
  email: 'e2e@test.fr',
  color: '#0f766e',
  is_admin: true,
  approved: true,
  created_at: '2026-01-01T00:00:00Z',
};
const MARTIN = {
  id: 'doc-martin',
  auth_id: null,
  name: 'MARTIN',
  email: null,
  color: '#2563eb',
  is_admin: false,
  approved: true,
  created_at: '2026-01-01T00:00:00Z',
};
const SHIFT = {
  id: 'sh1',
  work_date: '2026-07-07',
  shift_type: 'S1J',
  doctor_id: 'doc-martin',
  created_by: 'doc-self',
  created_at: '',
  updated_at: '',
};

async function seedSession(page: Page, mfa: boolean) {
  await page.addInitScript(
    ({ ref, uid, mfa }) => {
      const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365;
      const b64 = (o: unknown) =>
        btoa(JSON.stringify(o)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      // `aal1` = mot de passe seulement ; combiné à un facteur TOTP vérifié dans
      // `user.factors`, `getAuthenticatorAssuranceLevel()` renvoie next=aal2 → défi.
      const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
        sub: uid,
        role: 'authenticated',
        aud: 'authenticated',
        exp,
        email: 'e2e@test.fr',
        ...(mfa ? { aal: 'aal1' } : {}),
      })}.sig`;
      const session = {
        access_token: jwt,
        refresh_token: 'e2e-refresh',
        expires_in: 3600,
        expires_at: exp,
        token_type: 'bearer',
        user: {
          id: uid,
          aud: 'authenticated',
          role: 'authenticated',
          email: 'e2e@test.fr',
          app_metadata: { provider: 'email' },
          user_metadata: { full_name: 'Dr E2E' },
          created_at: '2026-01-01T00:00:00Z',
          factors: mfa
            ? [
                {
                  id: 'factor-totp-1',
                  factor_type: 'totp',
                  status: 'verified',
                  friendly_name: 'e2e',
                  created_at: '2026-01-01T00:00:00Z',
                  updated_at: '2026-01-01T00:00:00Z',
                },
              ]
            : [],
        },
      };
      localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session));
    },
    { ref: REF, uid: USER_ID, mfa }
  );
}

export async function setupAuthenticated(
  page: Page,
  opts: { mfa?: boolean; locked?: boolean } = {}
) {
  await seedSession(page, opts.mfa ?? false);

  // Realtime : ne jamais atteindre le vrai serveur (on n'appelle pas connect).
  await page.routeWebSocket(/supabase\.co/, () => {
    /* intercepté, non relayé */
  });

  // Drapeau partagé lu par la route (les handlers tournent côté Node) : bascule
  // fiable en « hors-ligne » sans dépendre de la précédence des routes.
  const state = { offline: false };

  // Facteurs MFA renvoyés par `GET /auth/v1/user` (source de `listFactors()`).
  const factors = opts.mfa
    ? [{ id: 'factor-totp-1', factor_type: 'totp', status: 'verified' }]
    : [];

  // Mois verrouillé (juillet 2026 = année 2026, mois 6 en index JS 0-based).
  const locks = opts.locked
    ? [
        {
          year: 2026,
          month: 6,
          locked_by: 'doc-self',
          locked_at: '2026-07-01T00:00:00Z',
        },
      ]
    : [];

  await page.route(/supabase\.co\/(rest|auth)\/v1\//, route => {
    const url = route.request().url();
    // Hors-ligne : seules les requêtes de données (/rest/, dont les RPC) échouent ;
    // on laisse /auth/ répondre pour ne pas bloquer l'initialisation de la session.
    // On renvoie une ERREUR SERVEUR plutôt qu'un `route.abort()`. Deux pièges évités :
    //  1. un abort de transport n'est PAS relayé proprement au client supabase-js
    //     sous interception Playwright (le fetch ne rejette jamais → le client boucle) ;
    //  2. postgrest-js retente automatiquement (backoff) les erreurs réseau ET les
    //     statuts 503/520 sur les GET — le `catch` ne s'exécuterait donc qu'après
    //     ~7 s d'attente, rendant le test lent et fragile.
    // Un statut NON retryable (500) est converti en `error` par postgrest dès la
    // 1re tentative → `listMonth*` throw → le `catch` de `loadData` s'exécute
    // immédiatement : exactement la branche empruntée lors d'une coupure réseau.
    if (state.offline && url.includes('/rest/v1/'))
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'offline (mock e2e)' }),
      });
    const json = (body: unknown) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

    // `getUser()` (source de `listFactors()` / carte 2FA du profil).
    if (url.includes('/auth/v1/user'))
      return json({
        id: USER_ID,
        aud: 'authenticated',
        role: 'authenticated',
        email: 'e2e@test.fr',
        app_metadata: { provider: 'email' },
        user_metadata: { full_name: 'Dr E2E' },
        factors,
      });
    if (url.includes('/rpc/ensure_self_doctor')) return json(SELF);
    if (url.includes('/rpc/get_settings')) return json({ pentecote_ferie: true });
    if (url.includes('/rest/v1/doctors')) return json([SELF, MARTIN]);
    if (url.includes('/rest/v1/shifts')) return json([SHIFT]);
    if (url.includes('/rest/v1/leaves')) return json([]);
    if (url.includes('/rest/v1/day_notes')) return json([]);
    if (url.includes('/rest/v1/wishes')) return json([]);
    if (url.includes('/rest/v1/hnc_hours')) return json([]);
    if (url.includes('/rest/v1/locked_months')) return json(locks);
    return json([]);
  });

  /** Coupe le réseau de données : les requêtes `/rest/` échouent (test hors-ligne). */
  return {
    goOffline() {
      state.offline = true;
    },
  };
}

/**
 * Attend que le cliché du mois soit réellement écrit dans IndexedDB. L'app écrit
 * le cache en « fire-and-forget » : sans cette attente, un `reload()` immédiat
 * annulerait la transaction avant qu'elle ne soit committée.
 */
export async function waitForMonthCache(page: Page, key = 'month:2026-6') {
  await expect
    .poll(
      () =>
        page.evaluate(
          k =>
            new Promise<boolean>(resolve => {
              const req = indexedDB.open('mister-doc-cache', 1);
              req.onsuccess = () => {
                const db = req.result;
                try {
                  const g = db
                    .transaction('kv', 'readonly')
                    .objectStore('kv')
                    .get(k);
                  g.onsuccess = () => {
                    db.close(); // ne pas laisser fuir la connexion (bloque l'app)
                    resolve(Boolean(g.result));
                  };
                  g.onerror = () => {
                    db.close();
                    resolve(false);
                  };
                } catch {
                  db.close();
                  resolve(false);
                }
              };
              req.onerror = () => resolve(false);
            }),
          key
        ),
      { timeout: 5000 }
    )
    .toBeTruthy();
}
