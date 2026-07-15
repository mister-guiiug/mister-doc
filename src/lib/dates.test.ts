import { describe, expect, it } from 'vitest';
import {
  quadrimesterBounds,
  quadrimesterIndex,
  quadrimesterLabel,
} from './dates.ts';

describe('quadrimesterIndex', () => {
  it('regroupe l’année en 3 blocs de 4 mois', () => {
    // Janvier–avril → 0, mai–août → 1, septembre–décembre → 2.
    expect([0, 1, 2, 3].map(quadrimesterIndex)).toEqual([0, 0, 0, 0]);
    expect([4, 5, 6, 7].map(quadrimesterIndex)).toEqual([1, 1, 1, 1]);
    expect([8, 9, 10, 11].map(quadrimesterIndex)).toEqual([2, 2, 2, 2]);
  });
});

describe('quadrimesterBounds', () => {
  it('couvre les 4 mois du quadrimestre, bornes incluses', () => {
    // Juillet (mois 6) appartient au quadrimestre mai–août.
    expect(quadrimesterBounds(2026, 6)).toEqual(['2026-05-01', '2026-08-31']);
    // Janvier → janvier–avril.
    expect(quadrimesterBounds(2026, 0)).toEqual(['2026-01-01', '2026-04-30']);
    // Décembre → septembre–décembre.
    expect(quadrimesterBounds(2026, 11)).toEqual(['2026-09-01', '2026-12-31']);
  });
});

describe('quadrimesterLabel', () => {
  it('affiche la plage de mois du quadrimestre', () => {
    expect(quadrimesterLabel(2026, 6)).toBe('Mai – Août 2026');
    expect(quadrimesterLabel(2026, 0)).toBe('Janvier – Avril 2026');
    expect(quadrimesterLabel(2026, 11)).toBe('Septembre – Décembre 2026');
  });
});
