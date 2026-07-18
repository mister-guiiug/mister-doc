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
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    cwd: '..',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
