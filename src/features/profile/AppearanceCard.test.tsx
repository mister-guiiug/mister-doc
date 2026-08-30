import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mister-guiiug/dev-wpa-config/react/theme-provider';
import { I18nProvider } from '../../i18n/index.ts';
import { AppearanceCard } from './AppearanceCard.tsx';

/**
 * L'écran Apparence est le SEUL point de contact entre l'utilisateur et le
 * thème : ce qui est éprouvé ici, c'est le câblage de l'app, pas la mécanique
 * du socle (elle a ses propres tests chez lui).
 *
 * Deux choses peuvent casser en silence, et une seule fois :
 *  - `legacyKeys` : sans la clé historique `mister-doc:theme`, l'adoption du
 *    hook partagé orpheline la préférence de CHAQUE utilisateur déjà installé,
 *    qui se retrouve sur le thème système sans avoir rien demandé ;
 *  - le troisième segment : `useTheme` connaît `system`, et une fois sorti de
 *    cet état, une bascule à deux positions ne permet plus d'y revenir.
 */

/** `prefers-color-scheme: dark` piloté depuis le test (jsdom répond toujours faux). */
function stubPrefersDark(dark: boolean) {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: dark && query.includes('dark'),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList
  );
}

function renderCard() {
  localStorage.setItem('misterdoc_locale', 'fr');
  return render(
    // Même câblage que `main.tsx` : la clé historique DOIT y rester alignée.
    <ThemeProvider legacyKeys={['mister-doc:theme']}>
      <I18nProvider>
        <AppearanceCard />
      </I18nProvider>
    </ThemeProvider>
  );
}

beforeEach(() => {
  stubPrefersDark(false);
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.theme;
  document.documentElement.style.colorScheme = '';
});

describe('AppearanceCard', () => {
  it('reprend la préférence enregistrée sous l’ancienne clé et la réécrit sous la neuve', () => {
    localStorage.setItem('mister-doc:theme', 'dark');

    renderCard();

    expect(screen.getByRole('tab', { name: /Sombre/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(document.documentElement.dataset.theme).toBe('dark');
    // Migrée une fois pour toutes : les chargements suivants lisent la clé
    // famille, partagée avec le script anti-FOUC.
    expect(localStorage.getItem('dwc_theme')).toBe('dark');
  });

  it('offre un retour au thème du système, qui suit alors prefers-color-scheme', async () => {
    const user = userEvent.setup();
    stubPrefersDark(true);
    localStorage.setItem('mister-doc:theme', 'light');

    renderCard();
    expect(document.documentElement.dataset.theme).toBe('light');

    await user.click(screen.getByRole('tab', { name: /Système/ }));

    expect(localStorage.getItem('dwc_theme')).toBe('system');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('applique un choix explicite au document', async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole('tab', { name: /Sombre/ }));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(localStorage.getItem('dwc_theme')).toBe('dark');
  });
});
