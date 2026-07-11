import { describe, expect, it } from 'vitest';
import { activeShiftTypes, computeCounters, SHIFT_HOURS } from './shifts.ts';
import { isoWeek } from './dates.ts';

describe('SHIFT_HOURS', () => {
  it('respecte la base horaire métier', () => {
    expect(SHIFT_HOURS).toEqual({ S1J: 10, S1N: 15, S2J: 8, S3: 8 });
  });
});

describe('isoWeek', () => {
  it('numérote correctement quelques semaines de 2026', () => {
    expect(isoWeek(new Date(2026, 0, 1))).toBe(1); // jeudi 1 janv → S1
    expect(isoWeek(new Date(2026, 0, 5))).toBe(2); // lundi 5 janv → S2
    expect(isoWeek(new Date(2026, 11, 31))).toBe(53); // 2026 a 53 semaines ISO
  });
});

describe('activeShiftTypes', () => {
  it('propose les 4 créneaux un jour de semaine ordinaire', () => {
    // 2026-07-07 = mardi
    expect(activeShiftTypes(new Date(2026, 6, 7))).toEqual([
      'S1J',
      'S1N',
      'S2J',
      'S3',
    ]);
  });

  it('réduit à S1J/S1N le samedi et le dimanche', () => {
    expect(activeShiftTypes(new Date(2026, 6, 4))).toEqual(['S1J', 'S1N']); // sam
    expect(activeShiftTypes(new Date(2026, 6, 5))).toEqual(['S1J', 'S1N']); // dim
  });

  it('réduit à S1J/S1N un jour férié en semaine', () => {
    expect(activeShiftTypes(new Date(2026, 4, 1))).toEqual(['S1J', 'S1N']); // 1er mai (ven)
    expect(activeShiftTypes(new Date(2026, 3, 6))).toEqual(['S1J', 'S1N']); // Lundi de Pâques
  });
});

describe('computeCounters', () => {
  it('compte 0 partout sur une liste vide', () => {
    expect(computeCounters([])).toEqual({
      fridays: 0,
      saturdays: 0,
      sundays: 0,
      weekendHours: 0,
      totalHours: 0,
      shiftCount: 0,
    });
  });

  it('additionne les heures et distingue les jours de week-end', () => {
    // 2026-01-02 = vendredi, 2026-01-03 = samedi, 2026-01-04 = dimanche,
    // 2026-01-05 = lundi.
    const c = computeCounters([
      { work_date: '2026-01-02', shift_type: 'S1J' }, // ven, 10 h
      { work_date: '2026-01-02', shift_type: 'S1N' }, // ven (même jour), 15 h
      { work_date: '2026-01-03', shift_type: 'S1J' }, // sam, 10 h
      { work_date: '2026-01-04', shift_type: 'S2J' }, // dim, 8 h
      { work_date: '2026-01-05', shift_type: 'S1J' }, // lun, 10 h (hors week-end)
    ]);
    expect(c.fridays).toBe(1); // 1 jour distinct malgré 2 créneaux
    expect(c.saturdays).toBe(1);
    expect(c.sundays).toBe(1);
    expect(c.weekendHours).toBe(10 + 15 + 10 + 8); // 43 h ven+sam+dim
    expect(c.totalHours).toBe(53);
    expect(c.shiftCount).toBe(5);
  });
});
