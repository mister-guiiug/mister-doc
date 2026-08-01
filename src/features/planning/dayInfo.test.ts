import { describe, expect, it } from 'vitest';
import { computeDayInfo } from './dayInfo.ts';
import { monthDays } from '../../lib/dates.ts';
import type { Shift, Wish } from '../../backend/types.ts';
import type { Issue } from '../../lib/validation.ts';

// Juillet 2026 : le 7 est un mardi (couverture normale), le 4 un samedi (réduite).
const days = monthDays(2026, 6);
const mardi7 = days.find(d => d.iso === '2026-07-07')!;
const samedi4 = days.find(d => d.iso === '2026-07-04')!;

function shift(iso: string, type: string, doctorId: string): Shift {
  return {
    id: `${iso}-${type}`,
    work_date: iso,
    shift_type: type,
    doctor_id: doctorId,
    created_by: null,
    created_at: '',
    updated_at: '',
  };
}
function wish(doctorId: string, kind: Wish['kind']): Wish {
  return {
    id: `${doctorId}-${kind}`,
    doctor_id: doctorId,
    work_date: '2026-07-07',
    kind,
    note: null,
    created_at: '',
  };
}

const base = {
  day: mardi7,
  shiftIndex: new Map<string, Shift>(),
  issues: [] as Issue[],
  wishes: [] as Wish[],
  selfDoctorId: 'moi',
  highlightId: null as string | null,
};

describe('computeDayInfo', () => {
  it('compte tous les créneaux cliniques comme manquants si aucun n’est pourvu', () => {
    const info = computeDayInfo(base);
    expect(info.types).toEqual(['S1J', 'S1N', 'S2J']);
    expect(info.missing).toBe(3);
  });

  it('décompte les créneaux déjà pourvus', () => {
    const info = computeDayInfo({
      ...base,
      shiftIndex: new Map([
        ['2026-07-07|S1J', shift('2026-07-07', 'S1J', 'd1')],
      ]),
    });
    expect(info.missing).toBe(2);
  });

  it('applique la couverture réduite du week-end', () => {
    const info = computeDayInfo({ ...base, day: samedi4 });
    expect(info.types).toEqual(['S1J', 'S1N']); // pas de S2J le samedi
    expect(info.missing).toBe(2);
  });

  it('n’atténue rien sans médecin filtré', () => {
    const { dim } = computeDayInfo(base);
    expect(dim('d1')).toBe(false);
    expect(dim(undefined)).toBe(false);
  });

  it('atténue tout médecin autre que celui filtré', () => {
    const { dim } = computeDayInfo({ ...base, highlightId: 'd1' });
    expect(dim('d1')).toBe(false); // le médecin mis en avant reste net
    expect(dim('d2')).toBe(true);
    expect(dim(undefined)).toBe(true); // créneau vide : atténué aussi
  });

  it('distingue mon vœu de ceux des autres', () => {
    const info = computeDayInfo({
      ...base,
      wishes: [
        wish('moi', 'avoid'),
        wish('d2', 'prefer'),
        wish('d3', 'prefer'),
      ],
    });
    expect(info.myWish).toBe('avoid');
    expect(info.prefers).toHaveLength(2);
    expect(info.avoids).toHaveLength(1);
  });

  it('signale une anomalie bloquante, pas un simple avertissement', () => {
    expect(
      computeDayInfo({ ...base, issues: [{ level: 'warn', message: 'x' }] })
        .hasError
    ).toBe(false);
    expect(
      computeDayInfo({ ...base, issues: [{ level: 'error', message: 'x' }] })
        .hasError
    ).toBe(true);
  });
});
