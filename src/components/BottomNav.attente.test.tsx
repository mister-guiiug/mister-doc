import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Suspense, lazy, type ComponentType } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext, type AuthValue } from '../auth/useAuth.ts';
import { I18nProvider } from '../i18n/index.ts';
import type { Doctor } from '../backend/types.ts';
import { BottomNav } from './BottomNav.tsx';

/**
 * LE DÉFAUT QUE CES TESTS VERROUILLENT : un clic de menu sans aucun effet
 * visible.
 *
 * Diagnostiqué sur miss-badminton le 20/09/2026 (PR #80), puis retrouvé sur
 * onze dépôts du parc. Mesuré à froid sur deux sites publiés, première visite,
 * service worker pas encore installé : 133 ms d'écran figé sur mister-settle,
 * 161 ms sur mister-molkky, `aria-busy` faux d'un bout à l'autre.
 *
 * La cause n'est pas une lenteur anormale : react-router 7 enveloppe tout
 * changement d'URL dans `startTransition`, et React 19 garde alors
 * délibérément l'écran déjà affiché plutôt que de montrer le repli de
 * `Suspense`. Le repli d'`App` existait bien — il n'a simplement jamais pu
 * paraître sur un clic.
 *
 * Ces tests tiennent le CONTRAT, pas la mise en forme : tant que la vue n'est
 * pas là, l'entrée cliquée se dit occupée et la barre reste à l'écran pour le
 * montrer.
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

/** Monte la barre face à une vue dont on décide nous-même de l'arrivée. */
function monterFaceAUneVueLente() {
  let resous!: () => void;
  const VueLente = lazy(
    () =>
      new Promise<{ default: ComponentType }>(resolve => {
        resous = () => resolve({ default: () => <h1>Les échanges</h1> });
      })
  );

  const auth = { doctor: DOCTOR, isAdmin: false } as unknown as AuthValue;

  render(
    <AuthContext.Provider value={auth}>
      <I18nProvider>
        <MemoryRouter initialEntries={['/']}>
          <BottomNav />
          <Suspense fallback={<p>repli de route</p>}>
            <Routes>
              <Route path="/" element={<h1>Le planning</h1>} />
              <Route path="/echanges" element={<VueLente />} />
            </Routes>
          </Suspense>
        </MemoryRouter>
      </I18nProvider>
    </AuthContext.Provider>
  );

  return {
    // Une expression régulière, pas une chaîne : le socle ajoute « Page
    // actuelle » au nom accessible de l'entrée courante.
    entree: (nom: RegExp) => screen.getByRole('link', { name: nom }),
    livreLaVue: async () => {
      await act(async () => {
        resous();
      });
    },
  };
}

beforeEach(() => {
  localStorage.setItem('misterdoc_locale', 'fr');
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('le clic sur une entrée de la barre répond avant que la vue soit là', () => {
  it("dit l'entrée occupée tant que le morceau n'est pas arrivé", async () => {
    const { entree, livreLaVue } = monterFaceAUneVueLente();

    fireEvent.click(entree(/Échanges/));

    expect(entree(/Échanges/)).toHaveAttribute('aria-busy', 'true');
    // Les autres entrées ne se disent pas occupées : c'est celle qu'on a
    // cliquée qui travaille, pas la barre entière.
    expect(entree(/Profil/)).not.toHaveAttribute('aria-busy');

    await livreLaVue();

    expect(
      screen.getByRole('heading', { name: 'Les échanges' })
    ).toBeInTheDocument();
    expect(entree(/Échanges/)).not.toHaveAttribute('aria-busy');
  });

  it('annonce le chargement dans une zone vive, hors des liens', async () => {
    const { entree, livreLaVue } = monterFaceAUneVueLente();

    fireEvent.click(entree(/Échanges/));

    // HORS des liens : le nom accessible d'« Échanges » ne doit pas changer en
    // cours de route sous le doigt d'un lecteur d'écran.
    expect(
      screen.getAllByRole('status').some(z => z.textContent === 'Chargement…')
    ).toBe(true);
    expect(entree(/Échanges/)).toHaveAccessibleName('Échanges');

    await livreLaVue();

    expect(
      screen.getAllByRole('status').some(z => z.textContent === 'Chargement…')
    ).toBe(false);
  });

  it("garde l'écran précédent ET la barre pendant l'attente", async () => {
    const { entree, livreLaVue } = monterFaceAUneVueLente();

    fireEvent.click(entree(/Échanges/));

    // CE QUE LE REPLI DE `Suspense` NE FERA PAS. React 19 garde l'écran déjà
    // affiché pendant la transition : le planning est toujours là, et le repli
    // de route n'a pas paru. C'est exactement pourquoi la barre doit parler —
    // elle seule le peut.
    expect(
      screen.getByRole('heading', { name: 'Le planning' })
    ).toBeInTheDocument();
    expect(screen.queryByText('repli de route')).toBeNull();

    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(entree(/Échanges/)).toHaveAttribute('aria-busy', 'true');

    await livreLaVue();

    expect(screen.queryByRole('heading', { name: 'Le planning' })).toBeNull();
  });

  it('laisse le navigateur faire quand le clic porte un modificateur', () => {
    const { entree } = monterFaceAUneVueLente();

    fireEvent.click(entree(/Échanges/), { ctrlKey: true });

    // Ouvrir dans un nouvel onglet n'est pas une navigation de cette page :
    // rien ne doit être mis en attente ici.
    expect(entree(/Échanges/)).not.toHaveAttribute('aria-busy');
    expect(
      screen.getByRole('heading', { name: 'Le planning' })
    ).toBeInTheDocument();
  });
});
