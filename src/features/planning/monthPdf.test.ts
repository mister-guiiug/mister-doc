import { describe, expect, it } from 'vitest';
import { buildMonthPdfHtml } from './monthPdf.ts';
import { weeksOfMonth } from '../../lib/dates.ts';
import type { Doctor, Shift } from '../../backend/types.ts';

function doctor(id: string, name: string): Doctor {
  return {
    id,
    auth_id: null,
    name,
    email: null,
    color: '#000',
    is_admin: false,
    approved: true,
    created_at: '',
  };
}
function shift(work_date: string, shift_type: Shift['shift_type'], doctor_id: string): Shift {
  return { id: `${work_date}-${shift_type}`, work_date, shift_type, doctor_id, created_by: null, created_at: '', updated_at: '' };
}

describe('buildMonthPdfHtml', () => {
  const weeks = weeksOfMonth(2026, 6); // juillet 2026 (mois 0-indexé)
  const doctorsById = new Map([
    ['d1', doctor('d1', 'FLACHER')],
    ['d2', doctor('d2', 'ROBIN')],
  ]);
  // 2026-07-07 = mardi (jour ouvré, S2J actif) ; 2026-07-04 = samedi (réduit).
  const shiftIndex = new Map<string, Shift>([
    ['2026-07-07|S1J', shift('2026-07-07', 'S1J', 'd1')],
    ['2026-07-07|S2J', shift('2026-07-07', 'S2J', 'd2')],
    ['2026-07-04|S1J', shift('2026-07-04', 'S1J', 'd1')],
  ]);
  const html = buildMonthPdfHtml({ title: 'Juillet 2026', weeks, shiftIndex, doctorsById });

  it('contient le titre et les colonnes Sem/Jour/S1J/S1N/S2J', () => {
    expect(html).toContain('Juillet 2026');
    for (const h of ['<th>Sem</th>', '<th>Jour</th>', '<th>S1J</th>', '<th>S1N</th>', '<th>S2J</th>'])
      expect(html).toContain(h);
  });

  it('place les médecins affectés dans les cellules', () => {
    expect(html).toContain('FLACHER'); // S1J du 7
    expect(html).toContain('ROBIN'); // S2J du 7
  });

  it('grise les jours de week-end et supprime le S2J', () => {
    expect(html).toContain('class="we"'); // au moins une ligne week-end
    expect(html).toContain('class="off"'); // cellule S2J neutralisée le week-end
  });

  it('affiche un numéro de semaine ISO', () => {
    // Juillet 2026 couvre les semaines ISO 27 à 31.
    expect(html).toMatch(/class="sem">(2[7-9]|3[01])</);
  });
});
