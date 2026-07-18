import { describe, expect, it } from 'vitest';
import { auditActionLabel, auditTargetLabel } from './auditLabels.ts';
import type { AuditEntry } from '../backend/types.ts';

function entry(partial: Partial<AuditEntry>): AuditEntry {
  return {
    id: 1,
    at: '2026-07-01T00:00:00Z',
    actor_id: null,
    actor_name: null,
    action: '',
    target_id: null,
    target_name: null,
    details: null,
    ...partial,
  };
}

describe('auditActionLabel', () => {
  it('mappe les actions connues', () => {
    expect(auditActionLabel('doctor.approve')).toBe('a approuvé');
    expect(auditActionLabel('doctor.grant_admin')).toBe('a promu administrateur');
    expect(auditActionLabel('month.lock')).toBe('a verrouillé');
    expect(auditActionLabel('mfa.reset')).toBe('a réinitialisé la 2FA de');
  });

  it('repli sur le code brut pour une action inconnue', () => {
    expect(auditActionLabel('x.y')).toBe('x.y');
  });
});

describe('auditTargetLabel', () => {
  it('renvoie le nom de la cible quand présent', () => {
    expect(auditTargetLabel(entry({ target_name: 'MARTIN' }))).toBe('MARTIN');
  });

  it('reconstruit le mois depuis details (verrou de mois)', () => {
    expect(
      auditTargetLabel(entry({ details: { year: 2026, month: 6 } }))
    ).toBe('juillet 2026');
  });

  it('chaîne vide si ni cible ni mois', () => {
    expect(auditTargetLabel(entry({}))).toBe('');
  });
});
