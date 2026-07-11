/**
 * Version de l'application. `APP_BUILD` est UNIQUE par déploiement (sha du
 * commit en CI, horodatage en local) : deux bundles différents affichent deux
 * chaînes différentes, ce qui permet de vérifier qu'une mise à jour a bien pris.
 */
export const APP_VERSION: string = __APP_VERSION__;
export const BUILD_ID: string = __BUILD_ID__;
export const APP_BUILD = `v${APP_VERSION} · ${BUILD_ID}`;

/**
 * Force la récupération de la dernière version : demande la mise à jour du
 * service worker, purge les caches (Workbox + HTTP applicatif) puis recharge la
 * page. Combiné à `registerType: 'autoUpdate'`, garantit un bundle à jour même
 * si l'auto-update n'a pas encore rechargé.
 */
export async function forceUpdate(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.update().catch(() => undefined)));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch {
    /* on recharge quoi qu'il arrive */
  } finally {
    location.reload();
  }
}
