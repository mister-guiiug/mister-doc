// Génère les icônes PWA (PNG) à partir d'un SVG inline, via sharp.
// Lancement : npm run icons
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'icons');

const TEAL = '#0f766e';

/** Logo « M » (mister-doc) centré. `pad` = marge (0–1) pour le maskable. */
function svg(size, pad = 0) {
  const inset = size * pad;
  const inner = size - inset * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${TEAL}" rx="${pad ? 0 : size * 0.18}" />
    <g transform="translate(${inset},${inset})">
      <path d="M ${inner * 0.2} ${inner * 0.72}
               L ${inner * 0.2} ${inner * 0.28}
               L ${inner * 0.33} ${inner * 0.28}
               L ${inner * 0.5} ${inner * 0.55}
               L ${inner * 0.67} ${inner * 0.28}
               L ${inner * 0.8} ${inner * 0.28}
               L ${inner * 0.8} ${inner * 0.72}
               L ${inner * 0.67} ${inner * 0.72}
               L ${inner * 0.67} ${inner * 0.48}
               L ${inner * 0.5} ${inner * 0.74}
               L ${inner * 0.33} ${inner * 0.48}
               L ${inner * 0.33} ${inner * 0.72} Z"
            fill="#ffffff" />
      <circle cx="${inner * 0.86}" cy="${inner * 0.3}" r="${inner * 0.07}" fill="#5eead4" />
    </g>
  </svg>`;
}

async function png(size, pad, name) {
  const buf = await sharp(Buffer.from(svg(size, pad))).png().toBuffer();
  await writeFile(join(outDir, name), buf);
  console.log('✓', name);
}

await mkdir(outDir, { recursive: true });
await png(192, 0, 'icon-192.png');
await png(512, 0, 'icon-512.png');
await png(512, 0.14, 'icon-512-maskable.png');
await png(180, 0, 'apple-touch-icon.png');
console.log('Icônes générées dans public/icons/');
