import { defineConfig } from 'vitest/config';
import {
  baseTestOptions,
  coveragePreset,
  pwaRegisterAlias,
} from '@mister-guiiug/dev-pwa-config/vitest-base';

// Base famille : include scopé à `src/**` — les specs Playwright
// (`e2e/**/*.spec.ts`) tournent sous leur propre runner isolé et NE doivent
// pas être ramassées par vitest (elles importent `@playwright/test`).
export default defineConfig({
  // `__APP_VERSION__` et `__BUILD_ID__` sont des `define` de `vite.config.ts` :
  // sans eux, tout test qui importe `src/lib/appVersion.ts` échoue à l'import
  // sur un `ReferenceError`, avant d'avoir rien éprouvé. Les valeurs ne servent
  // qu'à l'affichage — ce sont des repères de test, pas la version réelle.
  define: {
    __APP_VERSION__: JSON.stringify('0.0.0-test'),
    __BUILD_ID__: JSON.stringify('test'),
  },
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
