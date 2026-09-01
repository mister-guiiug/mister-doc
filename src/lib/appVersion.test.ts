/**
 * `forceUpdate` — le bouton « Forcer la mise à jour » des réglages.
 *
 * LE DÉFAUT, SIGNALÉ EN USAGE le 01/09/2026 : « si on ouvre plusieurs apps et
 * qu'on clique sur forcer la mise à jour, des fois on bascule sur la page
 * d'accueil d'une autre app que celle en cours ».
 *
 * Les seize apps de la famille sont publiées sous
 * `https://mister-guiiug.github.io/<app>/` — **une seule origine**. Or
 * `getRegistrations()` et `caches.keys()` portent sur l'origine, pas sur
 * l'application. Cette fonction demandait donc une mise à jour aux workers des
 * quinze autres apps, et surtout **effaçait leur précache** : leur capacité
 * hors ligne, détruite en silence depuis un bouton d'une app voisine.
 *
 * Workbox nomme ses caches `workbox-precache-v2-<portée>`, et sa propre
 * routine de nettoyage filtre sur `self.registration.scope`. C'est cette règle
 * qui manquait ici.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';

const PORTEE = 'https://mister-guiiug.github.io/mister-doc/';
const VOISINE = 'https://mister-guiiug.github.io/miss-carbook/';

/** Un `CacheStorage` de comptoir, qui dit ce qu'on lui a supprimé. */
function fauxCaches(noms: string[]) {
  const restants = new Set(noms);
  return {
    restants,
    api: {
      keys: () => Promise.resolve([...restants]),
      delete: (nom: string) => {
        restants.delete(nom);
        return Promise.resolve(true);
      },
    },
  };
}

function installer(noms: string[]) {
  const store = fauxCaches(noms);
  const registrations = { propre: 0, toutes: 0 };
  const reload = vi.fn();

  vi.stubGlobal('caches', store.api);
  vi.stubGlobal('location', {
    origin: 'https://mister-guiiug.github.io',
    href: `${PORTEE}reglages`,
    reload,
  });
  vi.stubGlobal('navigator', {
    serviceWorker: {
      getRegistration: () => {
        registrations.propre++;
        return Promise.resolve({
          scope: PORTEE,
          update: () => Promise.resolve(),
        });
      },
      // Si elle est appelée, c'est déjà le défaut : elle rend TOUTE l'origine.
      getRegistrations: () => {
        registrations.toutes++;
        return Promise.resolve([]);
      },
    },
  });
  return { store, registrations, reload };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('forceUpdate', () => {
  it('n’efface pas le précache des apps voisines', async () => {
    const { store } = installer([
      `workbox-precache-v2-${PORTEE}`,
      `workbox-precache-v2-${VOISINE}`,
      `workbox-runtime-${VOISINE}`,
    ]);
    const { forceUpdate } = await import('./appVersion.ts');

    await forceUpdate();

    expect([...store.restants].sort()).toEqual([
      `workbox-precache-v2-${VOISINE}`,
      `workbox-runtime-${VOISINE}`,
    ]);
  });

  it('efface bien les siens : le bouton doit encore forcer', async () => {
    const { store } = installer([
      `workbox-precache-v2-${PORTEE}`,
      `workbox-runtime-${PORTEE}`,
    ]);
    const { forceUpdate } = await import('./appVersion.ts');

    await forceUpdate();

    expect(store.restants.size).toBe(0);
  });

  it('ne demande la mise à jour qu’à SON worker', async () => {
    const { registrations } = installer([]);
    const { forceUpdate } = await import('./appVersion.ts');

    await forceUpdate();

    expect(registrations.propre).toBe(1);
    expect(registrations.toutes).toBe(0);
  });

  it('recharge quoi qu’il arrive, même si le Cache Storage lève', async () => {
    const { reload } = installer([]);
    vi.stubGlobal('caches', {
      keys: () => Promise.reject(new Error('refusé')),
      delete: () => Promise.resolve(false),
    });
    const { forceUpdate } = await import('./appVersion.ts');

    await forceUpdate();

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
