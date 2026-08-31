import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { I18nProvider } from '../i18n/index.ts';
import { OfflineBanner } from './OfflineBanner.tsx';

/**
 * CE QUE CES TESTS VERROUILLENT : que le bandeau se TAIT quand il faut, et
 * qu'il PARLE quand il faut — dans cet ordre, parce que le premier défaut est
 * le plus insidieux.
 *
 * La temporisation du socle (1,5 s hors ligne CONTINU) n'est pas un détail
 * d'implémentation : un médecin qui traverse un couloir de sous-sol ne doit
 * pas voir une alerte clignoter à chaque pas. Or un test qui se contenterait
 * de « offline ⇒ bandeau » passerait tout aussi bien avec une version SANS
 * temporisation. On éprouve donc les deux bords : rien à 1499 ms, le bandeau à
 * 1500 ms — et le fait que deux coupures brèves ne s'additionnent pas.
 *
 * `navigator.onLine` est en lecture seule : jsdom laisse la redéfinir, et
 * c'est le seul moyen de faire croire au socle qu'on démarre hors connexion.
 * Les évènements `online`/`offline` se rejouent directement sur `window` —
 * c'est à eux que `useOnline` s'abonne.
 */
function setNavigatorOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => value,
  });
}

function goOffline() {
  setNavigatorOnline(false);
  act(() => {
    window.dispatchEvent(new Event('offline'));
  });
}

function goOnline() {
  setNavigatorOnline(true);
  act(() => {
    window.dispatchEvent(new Event('online'));
  });
}

/** Laisse passer `ms` de temps simulé, rendus React compris. */
function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function mount() {
  return render(
    <I18nProvider>
      <OfflineBanner />
    </I18nProvider>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  // La locale est persistée, et jsdom annonce `en-US` : sans ce réglage les
  // libellés attendus plus bas basculeraient selon la machine.
  localStorage.setItem('misterdoc_locale', 'fr');
  setNavigatorOnline(true);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
  setNavigatorOnline(true);
});

describe('OfflineBanner', () => {
  it('ne rend rien tant que le réseau est là', () => {
    const { container } = mount();

    expect(container).toBeEmptyDOMElement();
  });

  it('ne clignote pas sur une micro-coupure : rien avant la temporisation', () => {
    mount();

    goOffline();
    advance(1499);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('s’affiche après 1,5 s hors ligne continu', () => {
    mount();

    goOffline();
    advance(1500);

    const banner = screen.getByRole('status');
    expect(banner).toHaveAttribute('data-dwc', 'connection-banner');
    // Le texte est celui de l'app, pas le défaut français en dur du socle, qui
    // promettait une reconnexion que mister-doc n'orchestre pas. Il dit les
    // deux choses vraies pour un planning de gardes.
    expect(banner).toHaveTextContent(
      'Hors connexion — le planning affiché peut être périmé, et aucune modification ne partira.'
    );
  });

  it('disparaît dès le retour du réseau, sans attendre', () => {
    mount();
    goOffline();
    advance(1500);
    expect(screen.getByRole('status')).toBeInTheDocument();

    goOnline();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('deux coupures brèves ne s’additionnent pas : le compteur repart de zéro', () => {
    mount();

    goOffline();
    advance(1000);
    goOnline();
    goOffline();
    advance(1000);

    // 2 000 ms hors ligne au total, mais jamais 1 500 d'affilée.
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    advance(500);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('parle la langue choisie dans l’application', () => {
    localStorage.setItem('misterdoc_locale', 'en');
    mount();

    goOffline();
    advance(1500);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Offline — the schedule shown may be stale, and no change will be sent.'
    );
  });
});
