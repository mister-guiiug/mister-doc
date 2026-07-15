import { describe, expect, it } from 'vitest';
import { computeEquity, type EquityShift } from './equity.ts';

const doctors = [
  { id: 'a', name: 'Alice' },
  { id: 'b', name: 'Bob' },
  { id: 'c', name: 'Carla' }, // aucune garde
];

// Juillet 2026 : 4/7 vendredi, 5/7 samedi, 6/7 dimanche ; 14/7 = Fête nationale.
const shifts: EquityShift[] = [
  { doctor_id: 'a', work_date: '2026-07-05', shift_type: 'S1J' }, // dim
  { doctor_id: 'a', work_date: '2026-07-05', shift_type: 'S1N' }, // dim + nuit (même jour)
  { doctor_id: 'a', work_date: '2026-07-14', shift_type: 'S1J' }, // férié
  { doctor_id: 'b', work_date: '2026-07-04', shift_type: 'S1N' }, // sam + nuit
  { doctor_id: 'b', work_date: '2026-07-11', shift_type: 'S1N' }, // sam + nuit
];

describe('computeEquity', () => {
  const { rows, mean, max } = computeEquity(doctors, shifts);
  const byId = Object.fromEntries(rows.map(r => [r.doctorId, r]));

  it('compte les jours de week-end DISTINCTS', () => {
    // Alice : dimanche 05 (2 créneaux le même jour = 1 jour WE).
    expect(byId.a.weekendDays).toBe(1);
    // Bob : samedis 04 et 11 = 2 jours WE.
    expect(byId.b.weekendDays).toBe(2);
    expect(byId.c.weekendDays).toBe(0);
  });

  it('compte les nuits (S1N) et les jours fériés distincts', () => {
    expect(byId.a.nights).toBe(1);
    expect(byId.a.holidays).toBe(1); // 14/07
    expect(byId.b.nights).toBe(2);
    expect(byId.b.holidays).toBe(0);
  });

  it('somme les heures cliniques (S1J=10, S1N=15)', () => {
    expect(byId.a.totalHours).toBe(10 + 15 + 10); // 35
    expect(byId.b.totalHours).toBe(15 + 15); // 30
    expect(byId.c.totalHours).toBe(0);
  });

  it('calcule moyenne et maximum par indicateur', () => {
    expect(mean.nights).toBeCloseTo((1 + 2 + 0) / 3);
    expect(max.nights).toBe(2);
    expect(max.totalHours).toBe(35);
  });

  it('inclut les médecins sans garde (zéros)', () => {
    expect(byId.c).toMatchObject({
      weekendDays: 0,
      nights: 0,
      holidays: 0,
      totalHours: 0,
    });
  });
});
