import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '../i18n/index.ts';
import { UpdatePrompt } from './UpdatePrompt.tsx';

/**
 * Le bandeau ne doit rien dire tant qu'aucune version n'attend — sans quoi il
 * s'imposerait à chaque ouverture de l'app.
 *
 * FICHIER SÉPARÉ À DESSEIN. Le hook du socle mémorise sa connexion dans une
 * `WeakMap` de module, par identité de `registerSW` ; `registerSWLogged` étant
 * une constante de module (elle DOIT l'être, sinon chaque rendu
 * ré-enregistrerait le service worker), un `onNeedRefresh` déclenché une fois
 * reste vrai pour tout le fichier. Un second fichier = un graphe de modules
 * neuf, donc l'état vierge que ce cas exige — sans dépendre de l'ordre
 * d'exécution des tests voisins.
 */

type RegisterOptions = {
  onNeedRefresh?: () => void;
  onRegisterError?: (error: unknown) => void;
};

let captured: RegisterOptions | undefined;

vi.mock('virtual:pwa-register', () => ({
  registerSW: (options: RegisterOptions) => {
    captured = options;
    return () => Promise.resolve();
  },
}));

describe('UpdatePrompt, au repos', () => {
  it('injecte registerSW et ne montre rien tant qu’aucune version n’attend', () => {
    localStorage.setItem('misterdoc_locale', 'fr');
    render(
      <I18nProvider>
        <UpdatePrompt />
      </I18nProvider>
    );

    // L'injection a bien eu lieu : le socle a pu poser ses écouteurs. C'est
    // CETTE prop qui manquait à une app de la famille, dont la bannière est
    // restée muette des mois sans que rien ne le signale.
    expect(captured?.onNeedRefresh).toBeTypeOf('function');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
