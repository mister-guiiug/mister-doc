import { z } from 'zod';

/**
 * Validation des variables d'environnement publiques au démarrage : on échoue
 * tôt et clairement si Supabase n'est pas configuré, plutôt que par une erreur
 * obscure au premier appel réseau.
 */
const schema = z.object({
  VITE_SUPABASE_URL: z.string().url('VITE_SUPABASE_URL doit être une URL valide'),
  VITE_SUPABASE_ANON_KEY: z
    .string()
    .min(20, 'VITE_SUPABASE_ANON_KEY manquante ou invalide'),
});

const parsed = schema.safeParse({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
});

if (!parsed.success) {
  const msg = parsed.error.issues.map(i => `• ${i.message}`).join('\n');
  throw new Error(
    `Configuration Supabase incomplète. Copiez .env.example en .env et renseignez :\n${msg}`
  );
}

export const env = parsed.data;
