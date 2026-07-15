import { describe, expect, it } from 'vitest';
import { groupBy } from './collections.ts';

describe('groupBy', () => {
  it('regroupe par clé en préservant l’ordre', () => {
    const items = [
      { d: '2026-07-01', id: 'a' },
      { d: '2026-07-02', id: 'b' },
      { d: '2026-07-01', id: 'c' },
    ];
    const m = groupBy(items, x => x.d);
    expect([...m.keys()]).toEqual(['2026-07-01', '2026-07-02']);
    expect(m.get('2026-07-01')!.map(x => x.id)).toEqual(['a', 'c']);
    expect(m.get('2026-07-02')!.map(x => x.id)).toEqual(['b']);
  });

  it('renvoie une map vide pour une liste vide', () => {
    expect(groupBy([], x => x).size).toBe(0);
  });
});
