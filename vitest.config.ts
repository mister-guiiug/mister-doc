import { defineConfig } from 'vitest/config';
import {
  baseTestOptions,
  coveragePreset,
  pwaRegisterAlias,
} from '@mister-guiiug/dev-wpa-config/vitest-base';

// Base famille : include scopé à `src/**` — les specs Playwright
// (`e2e/**/*.spec.ts`) tournent sous leur propre runner isolé et NE doivent
// pas être ramassées par vitest (elles importent `@playwright/test`).
export default defineConfig({
  // `virtual:pwa-register` n'est fourni que par vite-plugin-pwa, absent d'ici :
  // sans ce double, tout test qui le monte échoue à l'import, avant d'avoir
  // rien éprouvé. Le double du socle est PILOTABLE (`swStub.needRefresh()`),
  // là où la copie locale était muette.
  resolve: { alias: { ...pwaRegisterAlias } },
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
