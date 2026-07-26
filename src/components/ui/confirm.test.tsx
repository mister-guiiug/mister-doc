import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmProvider } from './ConfirmProvider.tsx';
import { useConfirm } from './confirmContext.ts';
import { I18nProvider } from '../../i18n/index.ts';

/** Composant d'essai : déclenche une confirmation et affiche son résultat. */
function Harness() {
  const confirm = useConfirm();
  const [result, setResult] = useState('—');
  return (
    <div>
      <button
        onClick={async () => {
          const ok = await confirm({
            message: 'Supprimer la garde ?',
            confirmLabel: 'Supprimer',
            danger: true,
          });
          setResult(ok ? 'confirmed' : 'cancelled');
        }}
      >
        déclencher
      </button>
      <span data-testid="result">{result}</span>
    </div>
  );
}

function setup() {
  // Semé en français : jsdom rapporte navigator.language=en-US, ce qui
  // rendrait sinon les libellés par défaut (Annuler…) en anglais.
  localStorage.setItem('misterdoc_locale', 'fr');
  return render(
    <I18nProvider>
      <ConfirmProvider>
        <Harness />
      </ConfirmProvider>
    </I18nProvider>
  );
}

describe('ConfirmProvider / useConfirm', () => {
  it('affiche le dialogue et résout true à la confirmation', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText('déclencher'));
    expect(await screen.findByText('Supprimer la garde ?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Supprimer' }));
    await waitFor(() =>
      expect(screen.getByTestId('result')).toHaveTextContent('confirmed')
    );
    // Le dialogue est refermé après la réponse.
    expect(screen.queryByText('Supprimer la garde ?')).not.toBeInTheDocument();
  });

  it('résout false à l’annulation', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText('déclencher'));
    await screen.findByText('Supprimer la garde ?');
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    await waitFor(() =>
      expect(screen.getByTestId('result')).toHaveTextContent('cancelled')
    );
  });
});
