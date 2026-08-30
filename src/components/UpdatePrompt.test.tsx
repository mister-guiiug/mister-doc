import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '../i18n/index.ts';
import { UpdatePrompt } from './UpdatePrompt.tsx';

/**
 * Le bandeau de mise à jour PEUT-IL S'AFFICHER ?
 *
 * Ce n'est pas une question rhétorique. Le bandeau du socle ne découvre une
 * nouvelle version que par le `registerSW` qu'on lui INJECTE : sans cette
 * prop, il compile, il se monte, il ne dit jamais rien — une bannière muette
 * qu'aucun type ni aucun test d'existence ne signale. Le stub partagé de
 * `vitest-setup` n'appelle jamais `onNeedRefresh` : il faut donc le remplacer
 * ici par un faux PILOTABLE, qui capture les rappels et les déclenche.
 *
 * On rend le composant de l'app — pas celui du socle — pour que la chaîne
 * testée soit exactement celle qui tourne en production : injection comprise,
 * et enrobage de journalisation compris.
 *
 * `captured` est relevé UNE FOIS et gardé : le hook du socle mémorise sa
 * connexion dans une `WeakMap` de module, par identité de `registerSW` — et
 * `registerSWLogged` est (à raison) une constante de module. Il n'y a donc
 * qu'un enregistrement pour tout le fichier. Le cas « rien à annoncer, rien à
 * afficher », lui, exige un graphe neuf : il vit dans `UpdatePrompt.silent`.
 */

type RegisterOptions = {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegisterError?: (error: unknown) => void;
};

/** Options confiées au `registerSW` du module virtuel par le socle. */
let captured: RegisterOptions | undefined;

vi.mock('virtual:pwa-register', () => ({
  registerSW: (options: RegisterOptions) => {
    captured = options;
    return () => Promise.resolve();
  },
}));

function renderPrompt(locale: 'fr' | 'en' = 'fr') {
  // Semé explicitement : jsdom rapporte navigator.language=en-US, ce qui
  // basculerait sinon les libellés en anglais.
  localStorage.setItem('misterdoc_locale', locale);
  return render(
    <I18nProvider>
      <UpdatePrompt />
    </I18nProvider>
  );
}

/** Le service worker annonce qu'une nouvelle version attend. */
function announceUpdate() {
  expect(captured?.onNeedRefresh).toBeTypeOf('function');
  act(() => captured!.onNeedRefresh!());
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('UpdatePrompt', () => {
  it('affiche le bandeau quand une mise à jour est disponible', () => {
    renderPrompt();
    announceUpdate();

    const banner = screen.getByRole('status');
    expect(banner).toBeInTheDocument();
    // L'habillage partagé s'accroche à cet attribut (components.css).
    expect(banner).toHaveAttribute('data-dwc', 'update-banner');
    expect(
      screen.getByText('Une nouvelle version est disponible.')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Recharger' })
    ).toBeInTheDocument();
  });

  it('offre toujours une sortie : « Fermer » referme le bandeau', async () => {
    const user = userEvent.setup();
    renderPrompt();
    announceUpdate();

    await user.click(screen.getByRole('button', { name: 'Fermer' }));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('suit la langue de l’application', () => {
    renderPrompt('en');
    announceUpdate();

    expect(screen.getByText('A new version is available.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('journalise encore un enregistrement de service worker raté', () => {
    // La bannière locale posait `onRegisterError` → `logError`. Le socle ne
    // propose rien de tel : l'enrobage de `UpdatePrompt` doit le préserver,
    // sans quoi une panne d'enregistrement redevient parfaitement silencieuse.
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    renderPrompt();

    expect(captured?.onRegisterError).toBeTypeOf('function');
    captured!.onRegisterError!(new Error('sw injoignable'));

    expect(consoleError).toHaveBeenCalledWith(
      '[mister-doc] serviceWorker: sw injoignable',
      expect.any(Error)
    );
  });
});
