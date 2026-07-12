import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8')) as {
  version: string;
};

// Identifiant de build UNIQUE : sha court du commit en CI, sinon horodatage.
// Sert à afficher une version distincte à chaque déploiement et à confirmer
// qu'un « forcer la mise à jour » a bien chargé le dernier bundle.
const buildId =
  (process.env.GITHUB_SHA ?? '').slice(0, 7) ||
  new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');

// Déployé sur GitHub Pages : https://mister-guiiug.github.io/mister-doc/
export default defineConfig(({ command }) => {
  // Honore VITE_BASE_PATH (deploy → /mister-doc/, dev/preview local → /) ;
  // sinon /mister-doc/ au build, / en dev.
  const basePath =
    process.env.VITE_BASE_PATH ?? (command === 'build' ? '/mister-doc/' : '/');

  return {
    base: basePath,
    define: {
      __APP_VERSION__: JSON.stringify(version),
      __BUILD_ID__: JSON.stringify(buildId),
    },
    build: {
      sourcemap: true,
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            const norm = id.replace(/\\/g, '/');
            if (norm.includes('/@supabase/')) return 'supabase';
            if (norm.includes('/lucide-react/')) return 'icons';
            if (
              norm.includes('/react-dom/') ||
              norm.includes('/node_modules/react/') ||
              norm.includes('/scheduler/')
            ) {
              return 'react-vendor';
            }
            if (norm.includes('/react-router')) return 'router';
            return 'vendor';
          },
        },
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'icons/icon-192.png',
          'icons/icon-512.png',
          'icons/apple-touch-icon.png',
        ],
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,svg,png,woff2,webmanifest}'],
          navigateFallback: 'index.html',
          cleanupOutdatedCaches: true,
          maximumFileSizeToCacheInBytes: 4_000_000,
        },
        manifest: {
          id: '/mister-doc/',
          name: 'mister-doc — Planning de gardes',
          short_name: 'mister-doc',
          description:
            "Synchronisation du planning de gardes des médecins d'un hôpital : vue mensuelle des créneaux, numéro de semaine, compteurs week-end et heures par médecin.",
          theme_color: '#0f766e',
          background_color: '#f8fafc',
          display: 'standalone',
          orientation: 'portrait',
          scope: basePath,
          start_url: basePath,
          lang: 'fr',
          dir: 'ltr',
          categories: ['medical', 'productivity', 'health'],
          icons: [
            {
              src: 'icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'icons/icon-512-maskable.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
      }),
    ],
  };
});
