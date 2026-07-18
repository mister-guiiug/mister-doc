import { describe, expect, it } from 'vitest';
import { mfaChallengeNeeded, type AssuranceLevel } from './mfa.ts';

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
