import { test, expect } from '@playwright/test';
import { setupAuthenticated } from './mockSupabase.ts';

test.describe('Admin — journal d’audit', () => {
  test('affiche les actions sensibles récentes', async ({ page }) => {
    await setupAuthenticated(page); // le compte E2E est admin (is_admin: true)
    await page.goto('/#/admin');

    const journal = page
      .locator('section')
      .filter({ hasText: "Journal d'activité" });
    await expect(journal).toBeVisible();

    // Une approbation et un verrouillage de mois (libellés FR + cible/mois).
    await expect(journal.getByText(/a approuvé/)).toBeVisible();
    await expect(journal.getByText('MARTIN')).toBeVisible();
    await expect(journal.getByText(/a verrouillé/)).toBeVisible();
    await expect(journal.getByText('juillet 2026')).toBeVisible();
  });
});
