import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupAuthenticated } from './mockSupabase';

/**
 * Scans d'accessibilité axe-core — WCAG 2.0/2.1 A et AA.
 *
 * Politique identique au helper famille
 * `@mister-guiiug/dev-pwa-config/playwright-a11y` (mêmes tags, même rapport),
 * recopiée ici : le sous-projet e2e/ reste autonome (aucune dépendance au
 * registre GitHub Packages, cf. e2e/package.json).
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

interface AxeViolation {
  id: string;
  impact?: string | null;
  help: string;
  helpUrl: string;
  nodes: { target: unknown[] }[];
}

function formatViolations(violations: AxeViolation[]): string {
  if (!violations.length) return 'Aucune violation a11y.';
  return violations
    .map(v => {
      const nodes = v.nodes
        .map(n => `      - ${n.target.join(' ')}`)
        .join('\n');
      return `  [${v.impact ?? 'n/a'}] ${v.id} — ${v.help}\n${nodes}\n    ${v.helpUrl}`;
    })
    .join('\n\n');
}

async function expectNoA11yViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const violations = results.violations as AxeViolation[];
  expect(
    violations,
    `Violations a11y détectées :\n${formatViolations(violations)}`
  ).toEqual([]);
}

test.describe('Accessibilité — WCAG A/AA', () => {
  // L'app est internationalisée (FR/EN). Sur CI la locale navigateur (en-US)
  // basculerait l'UI en anglais et casserait les locators FR ci-dessous : on
  // épingle le français (createI18n lit `misterdoc_locale` en premier).
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('misterdoc_locale', 'fr');
      } catch {
        /* contexte sans storage : la locale fr-FR du projet Playwright prend le relais */
      }
    });
  });

  test('page de connexion sans violation', async ({ page }) => {
    await page.route(/supabase\.co/, route => route.abort());
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Mister Doc' })
    ).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test('politique de confidentialité sans violation', async ({ page }) => {
    await page.route(/supabase\.co/, route => route.abort());
    await page.goto('/');
    await page
      .getByRole('button', { name: 'Politique de confidentialité' })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Politique de confidentialité' })
    ).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test('planning authentifié sans violation', async ({ page }) => {
    await setupAuthenticated(page);
    await page.goto('/');
    // La garde des fixtures (juillet 2026) confirme que le planning est rendu.
    await expect(page.getByText('S1J').first()).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test('profil authentifié sans violation', async ({ page }) => {
    await setupAuthenticated(page);
    await page.goto('/#/profil');

    // La grille est groupée par catégorie (`groupBy`), et depuis le socle 6.6.0
    // les groupes naissent DÉPLIÉS. Ce qui compte ici n'a pas changé : `axe` ne
    // lit pas un `<details>` fermé, donc une grille repliée faisait passer la
    // règle sans avoir analysé une seule carte. On vérifie que les cartes sont
    // bien visibles AVANT l'audit — il n'y a plus de `summary` à cliquer.
    const groupes = page.locator('[data-dwc="family-app-group"]');
    await expect(groupes.first()).toBeVisible();
    await expect(page.locator('[data-dwc="family-app"]').first()).toBeVisible();

    await expectNoA11yViolations(page);
  });
});
