/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __APP_VERSION__: string;
declare const __BUILD_ID__: string;

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Clé publique VAPID (Web Push). Vide/absente → push désactivé côté UI. */
  readonly VITE_VAPID_PUBLIC_KEY?: string;
  readonly VITE_SENTRY_DSN?: string;
  /**
   * Identifiant de mesure GA4 (`G-…`), propre à CETTE application.
   *
   * NE PAS LA POSER tant que les mentions légales de `PrivacyDialog` portent
   * `[À compléter]` : sans responsable du traitement ni base légale, la
   * politique ne peut pas fonder la collecte. Absente, le bandeau de
   * consentement ne rend rien et rien n'est mesuré.
   */
  readonly VITE_GA_MEASUREMENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
