import { registerSW } from 'virtual:pwa-register';
import { UpdatePromptBanner } from '@mister-guiiug/dev-wpa-config/react/update-prompt-banner';
import type { RegisterSW } from '@mister-guiiug/dev-wpa-config/react/use-update-prompt';
import { useI18n } from '../i18n/index.ts';
import { logError } from '../lib/logger.ts';

/**
 * `registerSW`, enrobé pour garder la JOURNALISATION que la bannière locale
 * faisait et que le socle ne propose pas : un enregistrement de service worker
 * qui échoue ne laissait aucune trace avant `logError`, et la bannière
 * silencieuse qui en résulte est indiscernable d'une app à jour.
 *
 * Déclarée AU NIVEAU MODULE, jamais dans le rendu : le socle mémorise sa
 * connexion PAR IDENTITÉ de fonction injectée (WeakMap, ce qui neutralise
 * aussi le double effet de `StrictMode`). Une fonction recréée à chaque rendu
 * ré-enregistrerait le service worker et doublerait ses écouteurs.
 */
const registerSWLogged: RegisterSW = options =>
  registerSW({
    ...options,
    onRegisterError(error) {
      logError('serviceWorker', error);
    },
  });

/**
 * Bandeau « nouvelle version disponible » : le bandeau du socle, POSÉ.
 *
 * Le service worker est en `prompt` (et non `autoUpdate`) : la nouvelle
 * version est téléchargée en fond, puis l'utilisateur choisit QUAND recharger.
 * En `autoUpdate`, la page pouvait se recharger EN PLEINE SAISIE — affectation
 * d'une garde, formulaire ouvert. Refuser laisse l'application en l'état ; la
 * mise à jour s'appliquera au prochain démarrage.
 *
 * Ce que l'app garde, parce que le socle ne peut pas le connaître :
 *  - `registerSW` (enrobé ci-dessus), qui ne peut venir que d'elle : le module
 *    virtuel `virtual:pwa-register` n'existe que dans un build vite-plugin-pwa,
 *    c'est pourquoi le socle l'exige EN PARAMÈTRE au lieu de l'importer ;
 *  - les libellés, traduits par l'i18n de l'app : le catalogue métier porte
 *    déjà ces chaînes, et la PROP l'emporte sur le `LabelsProvider` monté
 *    dans `App.tsx` ;
 *  - le placement flottant en bas d'écran, par-dessus `BottomNav`.
 *
 * `snoozeHours` reste à 0 (défaut) : le bouton secondaire ÉCARTE le bandeau
 * pour la session, exactement comme la croix qu'il remplace.
 */
export function UpdatePrompt() {
  const { t } = useI18n();

  return (
    <UpdatePromptBanner
      registerSW={registerSWLogged}
      title={t('update.available')}
      updateLabel={t('update.reload')}
      updatingLabel={t('update.updating')}
      dismissLabel={t('common.close')}
      // `components.css` habille la boîte (fond, filet, rayon, cibles
      // tactiles) mais pas sa PLACE : elle flotte au-dessus de `BottomNav`
      // (z-30) et de la zone sûre iOS, comme la bannière qu'elle remplace.
      className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-sm shadow-lg"
    />
  );
}
