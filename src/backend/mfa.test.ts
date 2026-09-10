import { describe, expect, it } from 'vitest';
import {
  assuranceLevelFromSession,
  mfaChallengeNeeded,
  type AssuranceLevel,
} from './mfa.ts';

describe('mfaChallengeNeeded', () => {
  const cases: Array<[AssuranceLevel, boolean]> = [
    // Facteur TOTP vérifié mais session encore au 1er niveau → défi requis.
    [{ current: 'aal1', next: 'aal2' }, true],
    // Déjà élevée en aal2 (code déjà saisi) → plus de défi.
    [{ current: 'aal2', next: 'aal2' }, false],
    // Aucun facteur vérifié → jamais de défi (opt-in).
    [{ current: 'aal1', next: 'aal1' }, false],
    // Session absente / niveau inconnu → pas de défi (ne bloque pas).
    [{ current: null, next: null }, false],
  ];

  it.each(cases)('%o → %s', (level, expected) => {
    expect(mfaChallengeNeeded(level)).toBe(expected);
  });
});

/**
 * LE CALCUL LOCAL EST CE QUI TIENT LA PORTE HORS LIGNE. S'il rendait « pas de
 * défi » par facilité, un démarrage sans réseau contournerait la 2FA ; s'il se
 * trompait dans l'autre sens, il enfermerait le médecin devant un champ à six
 * chiffres qu'aucun serveur ne peut valider. Ces cas fixent les deux bords.
 */
describe('assuranceLevelFromSession', () => {
  const jeton = (payload: Record<string, unknown> | null) => {
    const b64 = (o: unknown) =>
      btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_');
    return payload === null
      ? 'pas-un-jeton'
      : `${b64({ alg: 'HS256' })}.${b64(payload)}.signature`;
  };
  const session = (
    payload: Record<string, unknown> | null,
    factors?: Array<{ status: string }>
  ) =>
    ({
      access_token: jeton(payload),
      user: factors ? { factors } : {},
    }) as unknown as Parameters<typeof assuranceLevelFromSession>[0];

  it('lit le niveau courant dans le claim `aal` du jeton', () => {
    expect(assuranceLevelFromSession(session({ aal: 'aal2' })).current).toBe(
      'aal2'
    );
  });

  it('rend `aal2` atteignable dès qu’un facteur est vérifié', () => {
    const a = assuranceLevelFromSession(
      session({ aal: 'aal1' }, [{ status: 'verified' }])
    );
    expect(a).toEqual({ current: 'aal1', next: 'aal2' });
    // Le point qui compte : hors ligne aussi, le défi reste exigé.
    expect(mfaChallengeNeeded(a)).toBe(true);
  });

  it('ignore un facteur non vérifié — l’inscription en cours ne verrouille pas', () => {
    const a = assuranceLevelFromSession(
      session({ aal: 'aal1' }, [{ status: 'unverified' }])
    );
    expect(a).toEqual({ current: 'aal1', next: 'aal1' });
    expect(mfaChallengeNeeded(a)).toBe(false);
  });

  it('sans facteur, le niveau atteignable est le niveau courant', () => {
    expect(assuranceLevelFromSession(session({ aal: 'aal1' }))).toEqual({
      current: 'aal1',
      next: 'aal1',
    });
  });

  it('jeton illisible → niveau inconnu, et donc pas de défi', () => {
    const a = assuranceLevelFromSession(session(null));
    expect(a).toEqual({ current: null, next: null });
    expect(mfaChallengeNeeded(a)).toBe(false);
  });

  it('claim `aal` absent → niveau inconnu plutôt qu’une valeur inventée', () => {
    expect(
      assuranceLevelFromSession(session({ sub: 'uid' })).current
    ).toBeNull();
  });
});
