/**
 * Journalisation centralisée des erreurs. Volontairement minimale (aucun
 * service externe) : un point unique, facile à brancher plus tard sur un
 * collecteur. Sert à remplacer les `catch {}` muets qui masquaient de vraies
 * pannes sans laisser de trace.
 */
export function logError(context: string, error: unknown): void {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`[mister-doc] ${context}: ${detail}`, error);
}
