import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { I18nProvider } from '../i18n/index.ts';
import { ConfirmProvider } from '../components/ui/ConfirmProvider.tsx';
import { AuthProvider } from './AuthContext.tsx';
import { useAuth } from './useAuth.ts';

/**
 * LE DÉMARRAGE SANS RÉSEAU, verrouillé par un test parce qu'il s'est cassé en
 * silence.
 *
 * Ce que faisait l'application avant : elle appelait `auth.getSession()` sans
 * condition. Cet appel n'est pas une lecture — jeton d'accès périmé, il part le
 * RENOUVELER contre le réseau, avec des reprises à intervalle croissant.
 * Mesuré sur la production : 27 secondes de « Chargement… », puis l'écran de
 * CONNEXION, qu'on ne peut pas franchir hors ligne. Un médecin de garde au
 * sous-sol se retrouvait dehors de son propre planning, pourtant en cache sur
 * son téléphone.
 *
 * Le test ne mesure pas un délai — il fixe la CAUSE : hors ligne, on ne demande
 * rien au réseau. Si quelqu'un remet un appel Supabase sur ce chemin, les
 * espions ci-dessous le disent tout de suite.
 */
// `vi.hoisted` : les fabriques de `vi.mock` sont remontées en tête de
// fichier, avant les `const` ordinaires — sans cela elles liraient des
// variables non encore initialisées.
const { getSession, onAuthStateChange, ensureSelfDoctor, getAssuranceLevel } =
  vi.hoisted(() => ({
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
    ensureSelfDoctor: vi.fn(),
    getAssuranceLevel: vi.fn(),
  }));

vi.mock('../lib/supabase.ts', () => ({
  getSupabase: () => ({ auth: { getSession, onAuthStateChange } }),
  subscribeTable: () => () => {},
}));
vi.mock('../backend/doctors.ts', () => ({ ensureSelfDoctor }));
vi.mock('../backend/mfa.ts', async importOriginal => {
  // `assuranceLevelFromSession` et `mfaChallengeNeeded` sont du calcul pur :
  // on garde les vrais, sinon le test ne prouverait rien du défi TOTP.
  const vrai = await importOriginal<typeof import('../backend/mfa.ts')>();
  return { ...vrai, getAssuranceLevel };
});
vi.mock('../backend/settings.ts', () => ({ getSettings: vi.fn() }));
vi.mock('../backend/shiftTypes.ts', () => ({ listShiftTypes: vi.fn() }));
vi.mock('../backend/passkey.ts', () => ({ signInWithPasskey: vi.fn() }));

const { MEDECIN } = vi.hoisted(() => ({
  MEDECIN: {
    id: 'doc-1',
    user_id: 'uid-1',
    name: 'Docteur Test',
    approved: true,
    is_admin: false,
  },
}));
vi.mock('../lib/idbCache.ts', () => ({
  idbGet: vi.fn(async (key: string) =>
    key === 'self-doctor:uid-1' ? MEDECIN : undefined
  ),
  idbSet: vi.fn(async () => {}),
}));

/** Un jeton dont le claim `aal` est lisible sans serveur. */
function jeton(aal: string) {
  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_');
  return `${b64({ alg: 'HS256' })}.${b64({ sub: 'uid-1', aal })}.signature`;
}

/** La session telle que Supabase l'écrit, PÉRIMÉE depuis deux heures. */
function rangerSessionPerimee(
  aal = 'aal1',
  factors?: Array<{ status: string }>
) {
  localStorage.setItem(
    'sb-projetdetest-auth-token',
    JSON.stringify({
      access_token: jeton(aal),
      refresh_token: 'jeton-de-rafraichissement',
      expires_at: Math.floor(Date.now() / 1000) - 7200,
      expires_in: 3600,
      token_type: 'bearer',
      user: { id: 'uid-1', email: 'docteur@exemple.fr', factors },
    })
  );
}

function Sonde() {
  const { loading, session, doctor, mfaRequired } = useAuth();
  if (loading) return <p>chargement</p>;
  return (
    <p>
      {session ? 'session' : 'sans-session'} / {doctor?.name ?? 'sans-medecin'}{' '}
      / {mfaRequired ? 'defi-totp' : 'sans-defi'}
    </p>
  );
}

function monter() {
  return render(
    <I18nProvider>
      <ConfirmProvider>
        <AuthProvider>
          <Sonde />
        </AuthProvider>
      </ConfirmProvider>
    </I18nProvider>
  );
}

let onLineOriginal: PropertyDescriptor | undefined;
function simulerHorsLigne(horsLigne: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => !horsLigne,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  onLineOriginal ??= Object.getOwnPropertyDescriptor(
    Navigator.prototype,
    'onLine'
  );
  // Par défaut, `getSession()` ne répond JAMAIS : c'est exactement ce que fait
  // Supabase hors ligne pendant qu'il retente son renouvellement. Un test qui
  // dépendrait de lui resterait donc bloqué — et c'est le but.
  getSession.mockImplementation(() => new Promise(() => {}));
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  if (onLineOriginal) {
    Object.defineProperty(navigator, 'onLine', onLineOriginal);
  }
});

describe('démarrage hors ligne', () => {
  it('ouvre l’application sur la session et le médecin en cache', async () => {
    simulerHorsLigne(true);
    rangerSessionPerimee();
    monter();

    await waitFor(() =>
      expect(screen.getByText(/session \/ Docteur Test/)).toBeTruthy()
    );
  });

  it('ne demande RIEN au réseau — ni session, ni fiche, ni assurance', async () => {
    simulerHorsLigne(true);
    rangerSessionPerimee();
    monter();

    await waitFor(() => expect(screen.getByText(/Docteur Test/)).toBeTruthy());
    expect(getSession).not.toHaveBeenCalled();
    expect(ensureSelfDoctor).not.toHaveBeenCalled();
    expect(getAssuranceLevel).not.toHaveBeenCalled();
  });

  it('exige toujours le défi TOTP quand la session est en aal1', async () => {
    // LE POINT DE SÉCURITÉ. Passer par le cache ne doit pas ouvrir une porte
    // que le réseau tenait fermée : le niveau d'assurance se calcule sur place.
    simulerHorsLigne(true);
    rangerSessionPerimee('aal1', [{ status: 'verified' }]);
    monter();

    await waitFor(() => expect(screen.getByText(/defi-totp/)).toBeTruthy());
  });

  it('sans session en cache, laisse la porte à l’écran de connexion', async () => {
    // Premier lancement sur cet appareil : il n'y a rien à restaurer, et
    // inventer une session serait pire que d'afficher la connexion.
    simulerHorsLigne(true);
    getSession.mockResolvedValue({ data: { session: null } });
    monter();

    await waitFor(() => expect(screen.getByText(/sans-session/)).toBeTruthy());
  });

  it('en ligne, passe bien par Supabase et non par le cache', async () => {
    // Le repli ne doit pas devenir le chemin normal : avec du réseau, c'est
    // Supabase qui fait foi, et la fiche vient du serveur.
    simulerHorsLigne(false);
    rangerSessionPerimee();
    getSession.mockResolvedValue({
      data: { session: { access_token: jeton('aal1'), user: { id: 'uid-1' } } },
    });
    getAssuranceLevel.mockResolvedValue({ current: 'aal1', next: 'aal1' });
    ensureSelfDoctor.mockResolvedValue({ ...MEDECIN, name: 'Docteur Serveur' });
    monter();

    await waitFor(() =>
      expect(screen.getByText(/Docteur Serveur/)).toBeTruthy()
    );
    expect(getSession).toHaveBeenCalled();
    expect(ensureSelfDoctor).toHaveBeenCalled();
  });
});
