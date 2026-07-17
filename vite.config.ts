import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8')) as {
  version: string;
};

/**
 * Injecte la Content-Security-Policy (défense en profondeur) dans le <head>.
 * En PROD : `script-src` = 'self' + hash SHA-256 de CHAQUE script inline sans
 * attribut (le script anti-FOUC) — pas de 'unsafe-inline'. En DEV, on conserve
 * 'unsafe-inline' pour le préambule Fast Refresh inline de @vitejs/plugin-react.
 * Le hash est recalculé à partir du HTML final : il reste correct si le script
 * change.
 */
function cspPlugin(isDev: boolean): Plugin {
  return {
    name: 'mister-doc-csp',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        // Le navigateur normalise les fins de ligne (CRLF → LF) du contenu du
        // script avant d'en calculer le hash CSP : on normalise donc AUSSI ici,
        // sinon un build Windows (CRLF) produirait un hash qui ne correspond pas
        // et le script serait bloqué.
        const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
          m =>
            `'sha256-${createHash('sha256')
              .update(m[1].replace(/\r\n/g, '\n'))
              .digest('base64')}'`
        );
        const scriptSrc = isDev
          ? "'self' 'unsafe-inline'"
          : ["'self'", ...hashes].join(' ');
        const csp = [
          "default-src 'self'",
          `script-src ${scriptSrc}`,
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          "font-src 'self' data:",
          "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
          "manifest-src 'self'",
          "worker-src 'self'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; ');
        return html.replace(
          '<meta charset="UTF-8" />',
          `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`
        );
      },
    },
  };
}

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
      // Pas de sourcemaps en production : le site est public, inutile de
      // publier la cartographie du bundle (2,6 Mo de .map) et de faciliter
      // sa rétro-analyse. Le dev garde les sourcemaps inline d'esbuild.
      sourcemap: false,
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
      cspPlugin(command === 'serve'),
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
          // Handlers Web Push (fichier statique servi à la racine du scope) ;
          // ajoutés au SW généré sans changer sa stratégie de cache.
          importScripts: ['push-sw.js'],
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
