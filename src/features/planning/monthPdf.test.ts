import { describe, expect, it } from 'vitest';
import { buildMonthPdfModel, renderMonthPdf } from './monthPdf.ts';
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
  return {
    id: `${work_date}-${shift_type}`,
    work_date,
    shift_type,
    doctor_id,
    created_by: null,
    created_at: '',
    updated_at: '',
  };
}

function latin1(u8: Uint8Array): string {
  let s = '';
  for (const b of u8) s += String.fromCharCode(b);
  return s;
}

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

describe('buildMonthPdfModel', () => {
  const model = buildMonthPdfModel({ title: 'Juillet 2026', weeks, shiftIndex, doctorsById });
  const col = (code: string) => model.columns.findIndex(c => c.code === code);

  it('produit une ligne par jour du mois avec le titre', () => {
    expect(model.title).toBe('Juillet 2026');
    expect(model.rows).toHaveLength(31); // juillet
  });

  it('a une colonne par créneau clinique actif (défaut S1J/S1N/S2J)', () => {
    expect(model.columns.map(c => c.code)).toEqual(['S1J', 'S1N', 'S2J']);
  });

  it('place les médecins affectés dans les bonnes colonnes', () => {
    const mardi7 = model.rows.find(r => r.day === 'Mardi 7');
    expect(mardi7?.cells[col('S1J')].name).toBe('FLACHER');
    expect(mardi7?.cells[col('S2J')].name).toBe('ROBIN');
    expect(mardi7?.reduced).toBe(false);
  });

  it('grise les week-ends et neutralise le S2J', () => {
    const samedi4 = model.rows.find(r => r.day === 'Samedi 4');
    expect(samedi4?.reduced).toBe(true);
    expect(samedi4?.cells[col('S1J')].name).toBe('FLACHER'); // S1J conservé
    expect(samedi4?.cells[col('S2J')].name).toBe(''); // pas de S2J le week-end
    expect(samedi4?.cells[col('S2J')].off).toBe(true);
  });

  it('marque les fériés et n’affiche le n° de semaine qu’une fois par semaine', () => {
    const ferie = model.rows.find(r => r.day.startsWith('Mardi 14'));
    expect(ferie?.day).toBe('Mardi 14 *'); // 14 juillet
    expect(ferie?.reduced).toBe(true);
    const weekLabels = model.rows.filter(r => r.week !== '').map(r => r.week);
    expect(weekLabels).toEqual(['27', '28', '29', '30', '31']);
  });
});

describe('renderMonthPdf', () => {
  const model = buildMonthPdfModel({ title: 'Juillet 2026', weeks, shiftIndex, doctorsById });
  const bytes = renderMonthPdf(model);

  it('produit un binaire PDF bien formé (en-tête + trailer)', () => {
    expect(latin1(bytes.subarray(0, 8))).toBe('%PDF-1.4');
    expect(latin1(bytes.subarray(bytes.length - 8)).trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('a une table xref dont chaque offset pointe sur son objet', () => {
    const text = latin1(bytes);
    const sx = text.lastIndexOf('startxref');
    const xrefOffset = parseInt(text.slice(sx + 9).trim().split(/\s/)[0], 10);
    expect(latin1(bytes.subarray(xrefOffset, xrefOffset + 4))).toBe('xref');

    // Analyse robuste de l'en-tête « xref\n0 N\n » quel que soit l'EOL.
    const after = latin1(bytes.subarray(xrefOffset));
    const nl1 = after.indexOf('\n');
    const nl2 = after.indexOf('\n', nl1 + 1);
    const count = parseInt(after.slice(nl1 + 1, nl2).trim().split(/\s+/)[1], 10);
    expect(count).toBeGreaterThanOrEqual(7);

    // Entrées 20 octets ; on saute l'entrée libre 0, puis on vérifie « i 0 obj ».
    const entriesStart = xrefOffset + nl2 + 1 + 20;
    for (let i = 1; i < count; i++) {
      const entry = latin1(bytes.subarray(entriesStart + (i - 1) * 20, entriesStart + i * 20));
      const off = parseInt(entry.slice(0, 10), 10);
      expect(latin1(bytes.subarray(off, off + `${i} 0 obj`.length))).toBe(`${i} 0 obj`);
    }
  });
});
