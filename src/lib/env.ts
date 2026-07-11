/**
 * Validation des variables d'environnement publiques au démarrage : on échoue
 * tôt et clairement si Supabase n'est pas configuré, plutôt que par une erreur
 * obscure au premier appel réseau. Validation en JS simple (aucune dépendance),
 * pour éviter tout `eval`/`new Function` incompatible avec la CSP.
 */
function readEnv() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const errors: string[] = [];
  if (!url || !/^https?:\/\/.+/i.test(url)) {
    errors.push('VITE_SUPABASE_URL doit être une URL valide');
  }
  if (!anonKey || anonKey.length < 20) {
    errors.push('VITE_SUPABASE_ANON_KEY manquante ou invalide');
  }

  if (errors.length > 0) {
    throw new Error(
      `Configuration Supabase incomplète. Copiez .env.example en .env et renseignez :\n${errors
        .map(e => `• ${e}`)
        .join('\n')}`
    );
  }

  return {
    VITE_SUPABASE_URL: url,
    VITE_SUPABASE_ANON_KEY: anonKey,
  };
}

export const env = readEnv();
