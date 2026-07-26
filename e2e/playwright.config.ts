import { defineConfig, devices } from '@playwright/test';

/**
 * Tests E2E de mister-doc. Le serveur de dev de l'app (Vite, port 5173) est
 * démarré automatiquement. AUCUN test ne doit atteindre la vraie base Supabase :
 * les requêtes `*.supabase.co` sont interceptées (voir tests/mockSupabase.ts).
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    // Port DÉDIÉ (5175, --strictPort) : le 5173 par défaut peut être occupé par
    // un autre dev server local, que `reuseExistingServer` réutiliserait à tort.
    baseURL: 'http://localhost:5175',
    trace: 'on-first-retry',
    // L'app est internationalisée (FR/EN). Sans ça, la locale CI par défaut
    // (en-US) bascule l'UI en anglais et casse les locators FR des specs. Un seed
    // localStorage dans les tests complète (createI18n lit le storage en premier).
    locale: 'fr-FR',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --port 5175 --strictPort',
    cwd: '..',
    url: 'http://localhost:5175',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
