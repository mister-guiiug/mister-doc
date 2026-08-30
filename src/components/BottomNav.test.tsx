import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { HashRouter } from 'react-router-dom';
import { AuthContext, type AuthValue } from '../auth/useAuth.ts';
import { I18nProvider } from '../i18n/index.ts';
import type { Doctor } from '../backend/types.ts';
import { BottomNav } from './BottomNav.tsx';

/**
 * LA BARRE REND-ELLE QUELQUE CHOSE ?
 *
 * Ce n'est pas une question rhétorique. Le `BottomNav` du socle prend ses
 * destinations en PROP : sans `items`, il compile, il se monte, et il rend une
 * barre VIDE — un défaut qu'aucun type ne signale. C'est le piège que le
 * journal de campagne écrit noir sur blanc, et le seul moyen de s'en prémunir
 * est de vérifier les liens.
 *
 * Second point tenu ici : sous `HashRouter`, le `location.pathname` global —
 * le défaut du socle — ne voit jamais la route. Le test navigue par le hash,
 * exactement comme l'app.
 */

const DOCTOR: Doctor = {
  id: 'd1',
  auth_id: 'a1',
  name: 'Dr Test',
  email: 'test@example.org',
  color: '#0f766e',
  is_admin: false,
  approved: true,
  created_at: '2026-01-01T00:00:00.000Z',
};

function renderNav(options: { admin?: boolean; hash?: string } = {}) {
  const { admin = false, hash = '#/' } = options;
  localStorage.setItem('misterdoc_locale', 'fr');
  window.location.hash = hash;
  const auth = {
    doctor: { ...DOCTOR, is_admin: admin },
    isAdmin: admin,
  } as unknown as AuthValue;

  return render(
    <AuthContext.Provider value={auth}>
      <I18nProvider>
        <HashRouter>
          <BottomNav />
        </HashRouter>
      </I18nProvider>
    </AuthContext.Provider>
  );
}

function bar() {
  return screen.getByRole('navigation', { name: 'Navigation principale' });
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.location.hash = '';
});

describe('BottomNav', () => {
  it('rend les destinations d’un médecin approuvé', () => {
    renderNav();

    const links = within(bar()).getAllByRole('link');
    expect(links.map(l => l.textContent)).toEqual([
      'PlanningPage actuelle',
      'Moi',
      'Échanges',
      'Profil',
    ]);
  });

  it('ajoute Compteurs et Admin pour un admin, sans repli sous « Plus »', () => {
    renderNav({ admin: true });

    // Six destinations : le socle bascule au-delà de cinq, `maxVisible={6}`
    // empêche « Profil » de partir dans un tiroir.
    expect(within(bar()).getAllByRole('link')).toHaveLength(6);
    expect(
      within(bar()).queryByRole('button', { name: 'Plus' })
    ).not.toBeInTheDocument();
  });

  it('marque l’onglet courant autrement que par la couleur', () => {
    renderNav({ hash: '#/echanges' });

    const current = within(bar()).getByRole('link', { current: 'page' });
    expect(current).toHaveAttribute('href', '#/echanges');
    // Un texte lu double `aria-current` : en contraste forcé, la distinction
    // par l'encre disparaît entièrement (WCAG 1.4.1).
    expect(current).toHaveTextContent('Page actuelle');
    // Et l'habillage s'y accroche sans reposer sur une classe à synchroniser.
    expect(current).toHaveAttribute('data-current');
  });

  it('reste muette tant que le médecin n’est pas chargé', () => {
    localStorage.setItem('misterdoc_locale', 'fr');
    render(
      <AuthContext.Provider
        value={{ doctor: null, isAdmin: false } as unknown as AuthValue}
      >
        <I18nProvider>
          <HashRouter>
            <BottomNav />
          </HashRouter>
        </I18nProvider>
      </AuthContext.Provider>
    );

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});
