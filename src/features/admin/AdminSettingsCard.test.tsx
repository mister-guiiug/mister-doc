import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '../../i18n/index.ts';
import { AdminSettingsCard } from './AdminSettingsCard.tsx';

/**
 * LES DEUX BOUTONS « ENVOYER » RÉVEILLENT TOUT LE SERVICE.
 *
 * Ils appellent une fonction d'Edge qui pousse une notification à chaque
 * médecin concerné. Hors connexion l'appel échoue, silencieusement du point de
 * vue de l'administrateur : rien n'arrive, alors il recommence. Deux envois
 * pour un seul geste, c'est le service entier réveillé deux fois — le genre de
 * défaut qu'on ne découvre qu'après.
 *
 * Ce qui est éprouvé ici n'est PAS « le socle sait griser un bouton » (il a ses
 * propres tests) mais l'usage : le bouton est-il inerte, et DIT-IL pourquoi ?
 * Un bouton bloqué et muet est exactement le défaut que `useActionGuard`
 * existe pour empêcher.
 *
 * `disabled` NATIF, et non les `disabledProps` du garde : le `Button` du socle
 * retire `aria-disabled` de son type de props, parce qu'il le pilote lui-même
 * pour l'état « occupé ». Le motif ne peut donc pas vivre sur le bouton — d'où
 * le `role="status"` juste en dessous, doublé en infobulle.
 */
function setNavigatorOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => value,
  });
}

const onSendReminders = vi.fn();
const onSendDigest = vi.fn();

function renderCard() {
  localStorage.setItem('misterdoc_locale', 'fr');
  return render(
    <I18nProvider>
      <AdminSettingsCard
        pentecoteFerie
        onTogglePentecote={() => {}}
        reminderBusy={false}
        reminderMsg={null}
        onSendReminders={onSendReminders}
        digestBusy={false}
        digestMsg={null}
        onSendDigest={onSendDigest}
      />
    </I18nProvider>
  );
}

beforeEach(() => {
  onSendReminders.mockClear();
  onSendDigest.mockClear();
  setNavigatorOnline(true);
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  setNavigatorOnline(true);
});

describe('AdminSettingsCard — envois programmés', () => {
  it('en ligne, les deux boutons sont actifs et déclenchent l’envoi', async () => {
    renderCard();
    const user = userEvent.setup();

    const [reminders, digest] = screen.getAllByRole('button', {
      name: 'Envoyer',
    });
    expect(reminders).toBeEnabled();
    expect(digest).toBeEnabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    await user.click(reminders!);
    await user.click(digest!);

    expect(onSendReminders).toHaveBeenCalledTimes(1);
    expect(onSendDigest).toHaveBeenCalledTimes(1);
  });

  it('hors connexion, les boutons sont désactivés ET portent leur motif', async () => {
    // Avant le rendu : `useOnline` lit `navigator.onLine` à l'initialisation.
    setNavigatorOnline(false);
    renderCard();
    const user = userEvent.setup();

    const boutons = screen.getAllByRole('button', { name: 'Envoyer' });
    for (const bouton of boutons) {
      expect(bouton).toBeDisabled();
      expect(bouton).toHaveAttribute('title', 'Indisponible hors ligne');
    }

    // Le motif est LU, pas seulement dessiné : `role="status"` l'annonce.
    const motifs = screen.getAllByRole('status');
    expect(motifs).toHaveLength(2);
    expect(motifs[0]).toHaveTextContent('Indisponible hors ligne');

    await user.click(boutons[0]!);
    expect(onSendReminders).not.toHaveBeenCalled();
  });

  it('le retour du réseau rend les boutons à leur action', () => {
    setNavigatorOnline(false);
    renderCard();
    expect(screen.getAllByRole('status')).toHaveLength(2);

    setNavigatorOnline(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    for (const bouton of screen.getAllByRole('button', { name: 'Envoyer' })) {
      expect(bouton).toBeEnabled();
    }
  });
});
