import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Tests unitaires du code applicatif uniquement. Les specs Playwright
    // (`e2e/**/*.spec.ts`) tournent sous leur propre runner isolé et NE doivent
    // pas être ramassées par vitest (elles importent `@playwright/test`).
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**', 'src/backend/**'],
    },
  },
});
