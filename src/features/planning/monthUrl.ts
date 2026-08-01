/**
 * Sérialisation du mois affiché dans l'URL (`?m=YYYY-MM`) : le lien du planning
 * reste partageable et le mois survit au rechargement.
 */

/** Sérialise un mois affiché pour l'URL (`?m=YYYY-MM`). */
export function monthParam(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/** Lit un paramètre `?m=YYYY-MM` ; renvoie null si absent ou invalide. */
export function parseMonthParam(
  v: string | null
): { year: number; month: number } | null {
  const match = v && /^(\d{4})-(\d{2})$/.exec(v);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  if (month < 0 || month > 11) return null;
  return { year, month };
}
