import { test, expect } from '@playwright/test';
import { setupAuthenticated } from './mockSupabase.ts';

test.describe('Verrou de mois', () => {
  test('un mois verrouillé passe le planning en lecture seule', async ({
    page,
  }) => {
    await setupAuthenticated(page, { locked: true });
    await page.goto('/#/?m=2026-07');

    // L'état verrouillé est reconnu : l'admin voit la bascule « Déverrouiller ».
    await expect(
      page.getByRole('button', { name: 'Déverrouiller' })
    ).toBeVisible();

    // Les affectations (et par la même garde `locked`, HNC / notes / vœux) sont
    // en lecture seule : la garde S1J MARTIN est désactivée.
    await expect(page.getByRole('button', { name: /MARTIN/ })).toBeDisabled();
  });

  test('un mois non verrouillé reste éditable', async ({ page }) => {
    await setupAuthenticated(page); // pas de verrou
    await page.goto('/#/?m=2026-07');

    await expect(
      page.getByRole('button', { name: 'Verrouiller' })
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /MARTIN/ })).toBeEnabled();
  });
});
