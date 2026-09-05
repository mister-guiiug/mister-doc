import { createI18n } from '@mister-guiiug/dev-pwa-config/react/i18n';
import { messages } from './messages';

/**
 * Instance i18n de mister-doc (contexte + provider + hook), construite une fois
 * au niveau module à partir du catalogue FR/EN typé. Repli sur le français ;
 * choix de langue persisté sous `misterdoc_locale`.
 */
export const { I18nProvider, useI18n } = createI18n({
  messages,
  locales: ['fr', 'en'],
  fallbackLocale: 'fr',
  storageKey: 'misterdoc_locale',
});

export type { Locale, Messages } from './messages';
