import { test, expect } from '@playwright/test';
import { setupAuthenticated, waitForMonthCache } from './mockSupabase.ts';

test.describe('Planning authentifié (Supabase mocké)', () => {
  test('affiche le mois et une garde attribuée', async ({ page }) => {
    await setupAuthenticated(page);
    await page.goto('/#/?m=2026-07');


    await expect(page.getByText('Juillet 2026', { exact: true })).toBeVisible();
    // La garde S1J du 07/07 attribuée à MARTIN (bouton de créneau « S1J MARTIN »).
    await expect(page.getByRole('button', { name: /MARTIN/ })).toBeVisible();
  });

  test('bascule en mode hors-ligne quand le réseau tombe', async ({ page }) => {
    const { goOffline } = await setupAuthenticated(page);
    await page.goto('/#/?m=2026-07');
    // Chargé en ligne : les données sont mises en cache (IndexedDB).
    await expect(page.getByRole('button', { name: /MARTIN/ })).toBeVisible();
    await waitForMonthCache(page); // s'assurer que le cliché est bien écrit

    // Le réseau tombe ; un rafraîchissement doit basculer en mode hors-ligne
    // (bandeau) tout en gardant les données affichées (depuis le cache).
    goOffline();
    await page.getByRole('button', { name: 'Rafraîchir' }).click();

    await expect(page.getByText(/Hors ligne/)).toBeVisible();
    await expect(page.getByRole('button', { name: /MARTIN/ })).toBeVisible();
  });
});
