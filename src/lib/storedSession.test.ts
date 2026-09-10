import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { storedSession } from './storedSession.ts';

/**
 * CE QUE CE MODULE DOIT GARANTIR, et pourquoi ça compte : c'est lui qui décide
 * si un médecin sans réseau voit son planning ou l'écran de connexion. Il est
 * lu au tout premier rendu, avant tout appel Supabase.
 */
const CASE_SUPABASE = 'sb-lgbuytinzukaxrqjwxme-auth-token';

function session(expiresAt: number) {
  return {
    access_token: 'entete.charge.signature',
    refresh_token: 'jeton-de-rafraichissement',
    expires_at: expiresAt,
    expires_in: 3600,
    token_type: 'bearer',
    user: { id: 'uid-1', email: 'docteur@exemple.fr' },
  };
}

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe('la session écrite sur l’appareil', () => {
  it('est lue sous le nom de case que Supabase construit', () => {
    localStorage.setItem(CASE_SUPABASE, JSON.stringify(session(9_999_999_999)));
    expect(storedSession()?.user.id).toBe('uid-1');
  });

  it('est rendue MÊME PÉRIMÉE — c’est tout l’objet du module', () => {
    // Un jeton d'accès vit une heure. Hors ligne, son expiration ne dit rien
    // de l'utilisateur : elle dit qu'une heure a passé. Refuser ici, ce serait
    // recréer la panne qu'on répare.
    localStorage.setItem(CASE_SUPABASE, JSON.stringify(session(1)));
    expect(storedSession()?.user.id).toBe('uid-1');
  });

  it('ignore les cases voisines de Supabase', () => {
    // `-code-verifier` (PKCE) et `-user` cohabitent sous des noms proches et
    // ne contiennent pas de session.
    localStorage.setItem(
      'sb-lgbuytinzukaxrqjwxme-auth-token-code-verifier',
      JSON.stringify('verifieur')
    );
    localStorage.setItem(
      'sb-lgbuytinzukaxrqjwxme-auth-token-user',
      JSON.stringify({ user: { id: 'uid-1' } })
    );
    expect(storedSession()).toBeNull();
  });

  it('rend null quand rien n’est rangé', () => {
    expect(storedSession()).toBeNull();
  });

  it('rend null sur un contenu illisible plutôt que de lever', () => {
    localStorage.setItem(CASE_SUPABASE, 'ceci n’est pas du JSON');
    expect(storedSession()).toBeNull();
  });

  it('rend null sur un objet auquel il manque un champ', () => {
    const incomplete = { ...session(9_999_999_999), refresh_token: undefined };
    localStorage.setItem(CASE_SUPABASE, JSON.stringify(incomplete));
    expect(storedSession()).toBeNull();
  });

  it('rend null sans utilisateur identifiable', () => {
    // Sans `user.id`, l'application ne saurait pas quelle fiche médecin lire
    // en cache : la session ne servirait à rien.
    const sansId = { ...session(9_999_999_999), user: {} };
    localStorage.setItem(CASE_SUPABASE, JSON.stringify(sansId));
    expect(storedSession()).toBeNull();
  });

  it('ne lève pas quand le stockage est refusé', () => {
    // Navigation privée durcie : l'accès à `localStorage` lève à la lecture.
    const vrai = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('accès refusé', 'SecurityError');
      },
    });
    try {
      expect(storedSession()).toBeNull();
    } finally {
      if (vrai) Object.defineProperty(globalThis, 'localStorage', vrai);
    }
  });
});
