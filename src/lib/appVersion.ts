/**
 * Version de l'application. `APP_BUILD` est UNIQUE par déploiement (sha du
 * commit en CI, horodatage en local) : deux bundles différents affichent deux
 * chaînes différentes, ce qui permet de vérifier qu'une mise à jour a bien pris.
 */
export const APP_VERSION: string = __APP_VERSION__;
export const BUILD_ID: string = __BUILD_ID__;
export const APP_BUILD = `v${APP_VERSION} · ${BUILD_ID}`;

/**
 * La portée de CETTE app — préfixe d'URL qui la distingue de ses voisines.
 *
 * DEUX SOURCES, DANS CET ORDRE. Celle de la registration fait autorité : c'est
 * littéralement ce que le navigateur appelle la portée, et ce que Workbox met
 * dans le nom de ses caches. À défaut — pas encore de worker — `BASE_URL` vaut
 * `/mister-doc/` en production et donne la même chose.
 *
 * UNE BASE À LA RACINE NE DISCRIMINE RIEN, et on rend alors `''`. C'est le cas
 * du développement (`BASE_URL` vaut `/`) : `https://…/miss-carbook/` CONTIENT
 * `https://…/`, si bien qu'un filtre par sous-chaîne reprendrait tout. Mieux
 * vaut ne rien purger que purger chez les voisines — un test l'a attrapé.
 */
function appScope(registrationScope?: string): string {
  if (registrationScope) return registrationScope;
  try {
    const base = import.meta.env.BASE_URL;
    if (!base || base === '/') return '';
    return new URL(base, location.origin).href;
  } catch {
    return '';
  }
}

/**
 * Force la récupération de la dernière version : demande la mise à jour du
 * service worker, purge les caches (Workbox + HTTP applicatif) puis recharge la
 * page. Combiné à `registerType: 'autoUpdate'`, garantit un bundle à jour même
 * si l'auto-update n'a pas encore rechargé.
 *
 * NE TOUCHE QUE CETTE APP, et ce n'était pas le cas. Les seize apps de la
 * famille sont publiées sous `https://mister-guiiug.github.io/<app>/` — **une
 * seule origine**. Or `getRegistrations()` et `caches.keys()` portent sur
 * l'origine : cette fonction demandait une mise à jour aux workers des quinze
 * autres apps, et surtout **effaçait leur précache**, donc leur capacité hors
 * ligne. En silence, depuis un bouton nommé « Forcer la mise à jour ».
 *
 * Workbox nomme ses caches `workbox-precache-v2-<portée>` — sa propre routine
 * de nettoyage filtre d'ailleurs sur `self.registration.scope`. Filtrer sur la
 * portée de l'app suffit donc à ne garder que les siens.
 *
 * `getRegistration()` sans argument, enfin : il rend la registration qui
 * contrôle CETTE page, là où `getRegistrations()` les rend toutes.
 */
export async function forceUpdate(): Promise<void> {
  try {
    let porteeDuWorker: string | undefined;
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      porteeDuWorker = registration?.scope;
      await registration?.update().catch(() => undefined);
    }
    const scope = appScope(porteeDuWorker);
    // Sans portée connue, on ne peut pas distinguer nos caches de ceux des
    // voisines : on s'abstient. `update()` et le rechargement suffisent, et un
    // « Forcer » un peu moins fort vaut mieux que quinze apps cassées.
    if ('caches' in window && scope) {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter(k => k.includes(scope)).map(k => caches.delete(k))
      );
    }
  } catch {
    /* on recharge quoi qu'il arrive */
  } finally {
    location.reload();
  }
}
