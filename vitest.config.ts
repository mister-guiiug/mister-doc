import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';
import {
  baseTestOptions,
  coveragePreset,
} from '@mister-guiiug/dev-wpa-config/vitest-base';

// Base famille : include scopé à `src/**` — les specs Playwright
// (`e2e/**/*.spec.ts`) tournent sous leur propre runner isolé et NE doivent
// pas être ramassées par vitest (elles importent `@playwright/test`).
export default defineConfig({
  resolve: {
    alias: {
      // `virtual:pwa-register` n'est fourni que par vite-plugin-pwa, absent
      // d'ici : sans ce double, tout test qui monte la bannière de mise à jour
      // échoue à l'import, avant d'avoir rien éprouvé.
      'virtual:pwa-register': fileURLToPath(
        new URL('./src/test/pwa-register-stub.ts', import.meta.url)
      ),
    },
  },
  test: {
    ...baseTestOptions,
    css: false,
    coverage: {
      ...coveragePreset,
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**', 'src/backend/**'],
    },
  },
});
