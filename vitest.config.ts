import { defineConfig } from 'vitest/config';
import {
  baseTestOptions,
  coveragePreset,
} from '@mister-guiiug/dev-wpa-config/vitest-base';

// Base famille : include scopé à `src/**` — les specs Playwright
// (`e2e/**/*.spec.ts`) tournent sous leur propre runner isolé et NE doivent
// pas être ramassées par vitest (elles importent `@playwright/test`).
export default defineConfig({
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
