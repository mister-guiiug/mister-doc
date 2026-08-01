import { describe, expect, it } from 'vitest';
import { sumHncHours, HNC_MAX_HOURS } from './hnc.ts';

describe('sumHncHours', () => {
  it('renvoie 0 sur une liste vide', () => {
    expect(sumHncHours([])).toBe(0);
  });

  it('additionne les heures, demi-heures comprises', () => {
    expect(sumHncHours([{ hours: 4 }, { hours: 2.5 }, { hours: 1.5 }])).toBe(8);
  });

  it('traite une valeur absente comme 0 (donnée partielle)', () => {
    // `hours` peut arriver nul d'une ligne incomplète : ne doit pas produire NaN.
    const entries = [{ hours: 3 }, { hours: null }, { hours: 2 }] as {
      hours: number;
    }[];
    expect(sumHncHours(entries)).toBe(5);
  });

  it('borne métier : une saisie ne dépasse pas 24 h', () => {
    expect(HNC_MAX_HOURS).toBe(24);
  });
});
