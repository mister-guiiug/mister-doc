import { test, expect } from '@playwright/test';

/**
 * Surface pré-authentification : aucun appel réseau réel. Par sécurité on coupe
 * toute requête `supabase.co` (aucune n'est attendue ici).
 */
test.beforeEach(async ({ page }) => {
  await page.route(/supabase\.co/, route => route.abort());
});

test.describe('Page de connexion', () => {
  test('affiche le formulaire et bascule connexion / inscription', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: 'mister-doc' })
    ).toBeVisible();

    // Mode connexion : pas de champ « Nom affiché », bouton « Se connecter ».
    await expect(page.getByLabel('Nom affiché')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Se connecter' })
    ).toBeVisible();

    // Bascule vers l'inscription via le SegmentedControl (design system).
    const signup = page.getByRole('tab', { name: 'Créer un compte' });
    await signup.click();

    await expect(signup).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByLabel('Nom affiché')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Créer mon compte' })
    ).toBeVisible();
  });

  test('les champs sont associés à leur label (a11y du composant Field)', async ({
    page,
  }) => {
    await page.goto('/');
    // getByLabel repose sur l'association htmlFor/id générée par `Field`.
    await expect(page.getByLabel('E-mail')).toBeVisible();
    await expect(page.getByLabel('Mot de passe')).toBeVisible();
  });
});
