import { describe, expect, it } from 'vitest';
import { frAuthError } from './authErrors.ts';

describe('frAuthError', () => {
  it('traduit les identifiants invalides', () => {
    expect(frAuthError('Invalid login credentials')).toBe(
      'E-mail ou mot de passe incorrect.'
    );
  });

  it('traduit un e-mail non confirmé', () => {
    expect(frAuthError('Email not confirmed')).toMatch(/non confirmé/);
  });

  it('traduit un compte déjà existant', () => {
    expect(frAuthError('User already registered')).toMatch(/existe déjà/);
  });

  it('traduit un mot de passe trop court', () => {
    expect(frAuthError('Password should be at least 6 characters')).toMatch(
      /6 caractères/
    );
  });

  it('traduit une limitation de débit', () => {
    expect(
      frAuthError('For security purposes, you can only request this after 40 seconds')
    ).toMatch(/Trop de tentatives/);
  });

  it('traduit une erreur réseau', () => {
    expect(frAuthError('Failed to fetch')).toMatch(/réseau/);
  });

  it('retombe sur un message générique français', () => {
    expect(frAuthError('some unmapped backend error')).toBe(
      'Une erreur est survenue. Réessayez.'
    );
    expect(frAuthError(undefined)).toBe('Une erreur est survenue. Réessayez.');
  });
});
