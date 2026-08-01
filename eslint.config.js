import base from '@mister-guiiug/dev-wpa-config/eslint-react';

/**
 * Config ESLint = base famille + garde-fous d'architecture propres au projet.
 *
 * INVARIANT « couche d'accès aux données » : le client Supabase ne doit être
 * utilisé que par `src/backend/*` (et `src/auth/*`, qui pilote la session).
 * L'UI passe TOUJOURS par ces modules — jamais de requête inline dans un écran.
 * Cette règle transforme cette convention (aujourd'hui respectée à 100 %) en
 * échec de lint, pour qu'elle ne se dégrade pas silencieusement.
 */
export default [
  ...(Array.isArray(base) ? base : [base]),
  {
    files: ['src/features/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/lib/supabase', '**/lib/supabase.ts'],
              message:
                "L'accès Supabase passe par src/backend/* (ex. listShiftsBetween), jamais directement depuis l'UI.",
            },
            {
              group: ['@supabase/supabase-js'],
              message:
                'Importez les types/fonctions via src/backend/* plutôt que le SDK Supabase directement.',
            },
          ],
        },
      ],
    },
  },
];
