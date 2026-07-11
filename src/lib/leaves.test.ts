import { describe, expect, it } from 'vitest';
import { computeLeaveStats } from './leaves.ts';

describe('computeLeaveStats', () => {
  it('compte 0 sur une liste vide', () => {
    expect(computeLeaveStats([])).toEqual({
      annualDays: 0,
      trainingDays: 0,
      trainingHours: 0,
    });
  });

  it('sépare congés annuels et heures de formation', () => {
    const s = computeLeaveStats([
      { kind: 'annual', hours: null },
      { kind: 'annual', hours: null },
      { kind: 'training', hours: 8 },
      { kind: 'training', hours: 4.5 },
    ]);
    expect(s.annualDays).toBe(2);
    expect(s.trainingDays).toBe(2);
    expect(s.trainingHours).toBe(12.5);
  });
});
