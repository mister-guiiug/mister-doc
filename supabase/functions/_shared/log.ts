// Journalisation structurée des Edge Functions (JSON sur une ligne).
//
// Les logs Supabase (Dashboard → Edge Functions → Logs) sont interrogeables :
// une ligne JSON permet de filtrer par `fn`, `event` ou `level` au lieu de
// fouiller du texte libre. Jusqu'ici les fonctions ne journalisaient RIEN, et
// les échecs d'envoi push étaient avalés silencieusement (`catch {}`) : une
// panne de masse (VAPID expiré, quota atteint) passait inaperçue.
//
// Le dossier `_shared` n'est pas déployé comme fonction (préfixe `_`) : il est
// simplement inclus dans le bundle des fonctions qui l'importent.
//
// RGPD : ne JAMAIS journaliser de donnée identifiante (nom, e-mail, endpoint
// push complet). Les identifiants techniques (uuid) et les compteurs suffisent
// au diagnostic.

type Level = 'info' | 'warn' | 'error';

/** Champs libres du log — valeurs simples uniquement (sérialisation sûre). */
export type LogFields = Record<string, string | number | boolean | null>;

function emit(
  level: Level,
  fn: string,
  event: string,
  fields: LogFields = {}
): void {
  const line = JSON.stringify({ level, fn, event, ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

/**
 * Journal attaché à une fonction (`fn` répété sur chaque ligne).
 * Usage : `const log = createLogger('push'); log.info('sent', { count: 3 });`
 */
export function createLogger(fn: string) {
  return {
    info: (event: string, fields?: LogFields) =>
      emit('info', fn, event, fields),
    warn: (event: string, fields?: LogFields) =>
      emit('warn', fn, event, fields),
    error: (event: string, fields?: LogFields) =>
      emit('error', fn, event, fields),
  };
}

/** Message d'une erreur inconnue, sans divulguer la pile. */
export function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
