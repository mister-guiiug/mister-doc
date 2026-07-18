import type { AuditEntry } from '../backend/types.ts';

const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

// Verbe français par code d'action (cf. triggers de la migration 0017).
const ACTIONS: Record<string, string> = {
  'doctor.signup': 'a demandé un accès',
  'doctor.add': 'a ajouté au roster',
  'doctor.approve': 'a approuvé',
  'doctor.unapprove': "a retiré l'approbation de",
  'doctor.grant_admin': 'a promu administrateur',
  'doctor.revoke_admin': 'a retiré les droits admin de',
  'doctor.remove': 'a supprimé',
  'mfa.reset': 'a réinitialisé la 2FA de',
  'mfa.recovery_used': 'a utilisé un code de secours 2FA',
  'month.lock': 'a verrouillé',
  'month.unlock': 'a déverrouillé',
};

/** Libellé FR de l'action (repli : le code brut, pour un code inconnu). */
export function auditActionLabel(action: string): string {
  return ACTIONS[action] ?? action;
}

/**
 * Objet de l'action : le nom de la cible (médecin), ou le mois « juillet 2026 »
 * reconstruit depuis `details` (verrous), ou une chaîne vide.
 */
export function auditTargetLabel(entry: AuditEntry): string {
  if (entry.target_name) return entry.target_name;
  const d = entry.details;
  if (d && typeof d.month === 'number' && typeof d.year === 'number') {
    return `${MONTHS[d.month] ?? '?'} ${d.year}`;
  }
  return '';
}
