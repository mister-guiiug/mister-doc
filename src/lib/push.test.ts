import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  currentPushEndpoint,
  disablePush,
  enablePush,
  pushBrowserSupport,
  pushConfigured,
  pushDeployed,
  pushDenied,
} from './push.ts';
import {
  deletePushSubscription,
  savePushSubscription,
} from '../backend/push.ts';

// Le transport parle à Supabase : on l'isole pour observer ce qui est écrit.
vi.mock('../backend/push.ts', () => ({
  savePushSubscription: vi.fn(async () => undefined),
  deletePushSubscription: vi.fn(async () => undefined),
}));

/** Une clé VAPID réaliste : 65 octets (point P-256 non compressé) en base64url. */
const VAPID = btoa(
  String.fromCharCode(...Array.from({ length: 65 }, (_, i) => (i * 7) % 256))
)
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/, '');

const P256DH = new Uint8Array([1, 2, 3, 4]);
const AUTH = new Uint8Array([250, 251, 252]);
/** Ce que `uint8ArrayToUrlBase64` doit produire pour les deux clés ci-dessus. */
const P256DH_B64 = 'AQIDBA';
const AUTH_B64 = '-vv8';

function fakeSubscription(endpoint = 'https://push.example/abc') {
  return {
    endpoint,
    expirationTime: null,
    getKey: (name: string) => (name === 'p256dh' ? P256DH : AUTH).buffer,
    unsubscribe: vi.fn(async () => true),
  };
}

/**
 * Un environnement navigateur minimal — le socle lit tout via `env`, ce qui
 * évite de bricoler les globales de jsdom (qui n'a ni `Notification` ni
 * `PushManager`).
 */
function fakeEnv(
  options: {
    permission?: NotificationPermission;
    subscription?: ReturnType<typeof fakeSubscription> | null;
    pushManager?: boolean;
    serviceWorker?: boolean;
    standalone?: boolean;
    onSubscribe?: () => ReturnType<typeof fakeSubscription>;
  } = {}
) {
  const {
    permission = 'default',
    subscription = null,
    pushManager = true,
    serviceWorker = true,
    standalone = false,
  } = options;

  const registration = {
    pushManager: {
      getSubscription: vi.fn(async () => subscription),
      subscribe: vi.fn(
        async () => options.onSubscribe?.() ?? fakeSubscription()
      ),
    },
  };

  const env: Record<string, unknown> = {
    navigator: serviceWorker
      ? { serviceWorker: { ready: Promise.resolve(registration) } }
      : {},
    matchMedia: () => ({ matches: standalone }),
    Notification: {
      permission,
      requestPermission: vi.fn(async () => permission),
    },
  };
  if (pushManager) env.PushManager = class {};
  return { env, registration };
}

beforeEach(() => {
  vi.stubEnv('VITE_VAPID_PUBLIC_KEY', VAPID);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('détection du support', () => {
  it('reconnaît un navigateur complet', () => {
    const { env } = fakeEnv();
    expect(pushBrowserSupport(env)).toMatchObject({
      supported: true,
      reason: null,
    });
    expect(pushConfigured(env)).toBe(true);
  });

  // Le cas qui justifie une raison plutôt qu'un booléen : Safari iOS en onglet
  // n'expose pas `PushManager`, mais l'utilisateur peut y remédier.
  it('distingue l’iPhone hors app installée', () => {
    const { env } = fakeEnv({ pushManager: false, standalone: false });
    expect(pushBrowserSupport(env)).toMatchObject({
      supported: false,
      reason: 'requires-installed-app',
      standalone: false,
    });
  });

  it('en app installée, l’absence de PushManager n’est plus réparable', () => {
    const { env } = fakeEnv({ pushManager: false, standalone: true });
    expect(pushBrowserSupport(env).reason).toBe('no-push-manager');
  });

  it('signale l’absence de service worker', () => {
    const { env } = fakeEnv({ serviceWorker: false });
    expect(pushBrowserSupport(env).reason).toBe('no-service-worker');
  });

  it('sans clé VAPID, le push n’est pas configuré même sur un bon navigateur', () => {
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', '');
    const { env } = fakeEnv();
    expect(pushDeployed()).toBe(false);
    expect(pushConfigured(env)).toBe(false);
  });

  it('rapporte une autorisation refusée', () => {
    expect(pushDenied(fakeEnv({ permission: 'denied' }).env)).toBe(true);
    expect(pushDenied(fakeEnv({ permission: 'granted' }).env)).toBe(false);
  });
});

describe('currentPushEndpoint', () => {
  it('rend l’endpoint de l’abonnement en cours', async () => {
    const { env } = fakeEnv({ subscription: fakeSubscription() });
    await expect(currentPushEndpoint(env)).resolves.toBe(
      'https://push.example/abc'
    );
  });

  it('rend null quand rien n’est abonné', async () => {
    await expect(currentPushEndpoint(fakeEnv().env)).resolves.toBeNull();
  });
});

describe('enablePush', () => {
  it('abonne et enregistre la ligne du médecin', async () => {
    const { env, registration } = fakeEnv({ permission: 'granted' });

    await expect(enablePush('doc-1', env)).resolves.toBe('on');

    // La clé VAPID part en octets, jamais en base64url.
    const key = registration.pushManager.subscribe.mock.calls[0][0]
      .applicationServerKey as Uint8Array;
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.length).toBe(65);

    // Le transport de l'app écrit `doctor_id`, pas `user_id`.
    expect(savePushSubscription).toHaveBeenCalledWith('doc-1', {
      endpoint: 'https://push.example/abc',
      p256dh: P256DH_B64,
      auth: AUTH_B64,
    });
  });

  it('réutilise l’abonnement existant plutôt que d’en créer un second', async () => {
    const existing = fakeSubscription('https://push.example/deja');
    const { env, registration } = fakeEnv({
      permission: 'granted',
      subscription: existing,
    });

    await expect(enablePush('doc-1', env)).resolves.toBe('on');
    expect(registration.pushManager.subscribe).not.toHaveBeenCalled();
    expect(savePushSubscription).toHaveBeenCalledWith(
      'doc-1',
      expect.objectContaining({ endpoint: 'https://push.example/deja' })
    );
  });

  it('rend « denied » sur refus, sans rien écrire', async () => {
    const { env } = fakeEnv({ permission: 'denied' });
    await expect(enablePush('doc-1', env)).resolves.toBe('denied');
    expect(savePushSubscription).not.toHaveBeenCalled();
  });

  it('rend « error » quand la clé VAPID manque — ce n’est pas un refus', async () => {
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', '');
    const { env } = fakeEnv({ permission: 'granted' });
    await expect(enablePush('doc-1', env)).resolves.toBe('error');
  });

  it('rend « error » quand l’enregistrement en base échoue', async () => {
    vi.mocked(savePushSubscription).mockRejectedValueOnce(new Error('RLS'));
    const { env } = fakeEnv({ permission: 'granted' });
    await expect(enablePush('doc-1', env)).resolves.toBe('error');
  });
});

describe('disablePush', () => {
  it('retire la ligne AVANT de désabonner le navigateur', async () => {
    const order: string[] = [];
    const subscription = fakeSubscription();
    subscription.unsubscribe = vi.fn(async () => {
      order.push('navigateur');
      return true;
    });
    vi.mocked(deletePushSubscription).mockImplementationOnce(async () => {
      order.push('serveur');
    });
    const { env } = fakeEnv({ permission: 'granted', subscription });

    await disablePush(env);

    // L'ordre inverse perdrait l'endpoint : le serveur pousserait dans le vide.
    expect(order).toEqual(['serveur', 'navigateur']);
    expect(deletePushSubscription).toHaveBeenCalledWith(
      'https://push.example/abc'
    );
  });

  it('lève si la suppression échoue, et laisse le navigateur abonné', async () => {
    const subscription = fakeSubscription();
    vi.mocked(deletePushSubscription).mockRejectedValueOnce(
      new Error('réseau')
    );
    const { env } = fakeEnv({ permission: 'granted', subscription });

    await expect(disablePush(env)).rejects.toThrow('désabonnement impossible');
    expect(subscription.unsubscribe).not.toHaveBeenCalled();
  });

  it('ne fait rien quand aucun abonnement n’existe', async () => {
    await expect(disablePush(fakeEnv().env)).resolves.toBeUndefined();
    expect(deletePushSubscription).not.toHaveBeenCalled();
  });
});
