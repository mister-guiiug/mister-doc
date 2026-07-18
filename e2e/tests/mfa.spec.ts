import { test, expect } from '@playwright/test';
import { setupAuthenticated } from './mockSupabase.ts';

test.describe('Double authentification (2FA)', () => {
  test('un compte avec TOTP vérifié est bloqué sur le défi avant le planning', async ({
    page,
  }) => {
    // Session aal1 + facteur TOTP vérifié → l'app doit exiger le code à 6 chiffres.
    await setupAuthenticated(page, { mfa: true });
    await page.goto('/#/?m=2026-07');

    // L'écran de vérification s'affiche…
    await expect(
      page.getByRole('heading', { name: 'Vérification en deux étapes' })
    ).toBeVisible();
    await expect(page.getByPlaceholder('123456')).toBeVisible();
    // …avec l'échappatoire de déconnexion…
    await expect(
      page.getByRole('button', { name: /Se déconnecter/ })
    ).toBeVisible();
    // …et le planning reste inaccessible tant que le défi n'est pas franchi.
    await expect(page.getByText('Juillet 2026', { exact: true })).toHaveCount(0);

    // Voie de récupération : bascule vers le code de secours.
    await page
      .getByRole('button', { name: /Utiliser un code de secours/ })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Code de secours' })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Récupérer mon accès' })
    ).toBeVisible();
  });

  test('sans facteur vérifié, aucun défi (opt-in) : le planning s’affiche', async ({
    page,
  }) => {
    await setupAuthenticated(page); // pas de MFA
    await page.goto('/#/?m=2026-07');

    await expect(page.getByText('Juillet 2026', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Vérification en deux étapes' })
    ).toHaveCount(0);
  });
});
