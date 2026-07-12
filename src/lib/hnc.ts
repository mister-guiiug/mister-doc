/**
 * Heures Non Cliniques (HNC, ex-« S3 »). Contrairement aux gardes, plusieurs
 * médecins peuvent en saisir le même jour, chacun avec son propre nombre
 * d'heures, n'importe quel jour. Elles s'ajoutent au temps total du médecin ET
 * disposent d'un compteur cumulé dédié.
 */

export const HNC_LABEL = 'Heures non cliniques';
export const HNC_SHORT = 'HNC';
export const HNC_MAX_HOURS = 24;

export interface CountableHnc {
  hours: number;
}

/** Somme des heures non cliniques d'un ensemble d'entrées. */
export function sumHncHours(entries: CountableHnc[]): number {
  return entries.reduce((acc, e) => acc + (e.hours ?? 0), 0);
}
