import { describe, expect, it, afterEach } from 'vitest';
import { planMonthCopy, type CopyableShift } from './monthCopy.ts';
import { fromISODate, mondayIndex } from './dates.ts';
import { setShiftTypes, DEFAULT_SHIFT_TYPES } from './shifts.ts';

// Repères utilisés par les cas ci-dessous (mois 0-indexés) :
//   juin 2026    — le 1er est un LUNDI  (30 jours)
//   juillet 2026 — le 1er est un MERCREDI, le 14 est férié (31 jours)
//   août 2026    — le 1er est un SAMEDI (31 jours)
const JUIN = { year: 2026, month: 5 };
const JUILLET = { year: 2026, month: 6 };
const AOUT = { year: 2026, month: 7 };

const DOC = '11111111-1111-1111-1111-111111111111';

/** Raccourci de construction d'une garde source. */
function garde(iso: string, type = 'S1J', doctor = DOC): CopyableShift {
  return { work_date: iso, shift_type: type, doctor_id: doctor };
}

describe('planMonthCopy', () => {
  // Les tests qui injectent une config doivent rendre les défauts aux suivants.
  afterEach(() => setShiftTypes(DEFAULT_SHIFT_TYPES));

  it('aligne sur le jour de semaine, pas sur le quantième', () => {
    // Juillet → août : le 1er juillet (mercredi) se projette sur le premier
    // mercredi d'août (le 5), d'où un décalage de 35 jours.
    const p = planMonthCopy(
      [garde('2026-07-01'), garde('2026-07-07')],
      JUILLET,
      AOUT,
      []
    );
    expect(p.rows.map(r => r.work_date)).toEqual(['2026-08-05', '2026-08-11']);
    // Le mardi 7 juillet reste un mardi.
    expect(mondayIndex(fromISODate('2026-07-07'))).toBe(
      mondayIndex(fromISODate('2026-08-11'))
    );
    expect(p.skippedOutside).toBe(0);
    expect(p.skippedInactive).toBe(0);
    expect(p.skippedOccupied).toBe(0);
  });

  it('conserve le médecin et le type de créneau', () => {
    const p = planMonthCopy([garde('2026-07-02', 'S1N')], JUILLET, AOUT, []);
    expect(p.rows).toEqual([
      { work_date: '2026-08-06', shift_type: 'S1N', doctor_id: DOC },
    ]);
  });

  it('écarte les dates qui débordent du mois cible (fin de mois)', () => {
    // Le 28 juillet se projetterait sur le 1er septembre.
    const p = planMonthCopy(
      [garde('2026-07-27'), garde('2026-07-28')],
      JUILLET,
      AOUT,
      []
    );
    expect(p.rows.map(r => r.work_date)).toEqual(['2026-08-31']);
    expect(p.skippedOutside).toBe(1);
  });

  it('écarte les créneaux non requis un jour férié', () => {
    // Juin → juillet : le 9 juin (mardi) tombe sur le 14 juillet, férié. S2J
    // n'est pas couvert les jours à couverture réduite, S1J si.
    const p = planMonthCopy(
      [garde('2026-06-09', 'S2J'), garde('2026-06-09', 'S1J')],
      JUIN,
      JUILLET,
      []
    );
    expect(p.rows).toEqual([
      { work_date: '2026-07-14', shift_type: 'S1J', doctor_id: DOC },
    ]);
    expect(p.skippedInactive).toBe(1);
  });

  it('écarte les créneaux de semaine tombant un week-end', () => {
    // Le 13 juin (samedi) se projette sur le samedi 18 juillet : S2J n'y est
    // pas à couvrir.
    const p = planMonthCopy([garde('2026-06-13', 'S2J')], JUIN, JUILLET, []);
    expect(p.rows).toEqual([]);
    expect(p.skippedInactive).toBe(1);
  });

  it("n'écrase jamais un créneau déjà attribué", () => {
    const dejaPris = [{ work_date: '2026-08-11', shift_type: 'S1J' }];
    const p = planMonthCopy(
      [garde('2026-07-07', 'S1J'), garde('2026-07-07', 'S1N')],
      JUILLET,
      AOUT,
      dejaPris
    );
    expect(p.rows).toEqual([
      { work_date: '2026-08-11', shift_type: 'S1N', doctor_id: DOC },
    ]);
    expect(p.skippedOccupied).toBe(1);
  });

  it('ne planifie rien depuis un mois source vide', () => {
    const p = planMonthCopy([], JUILLET, AOUT, []);
    expect(p.rows).toEqual([]);
    expect(p.skippedOutside).toBe(0);
    expect(p.skippedInactive).toBe(0);
    expect(p.skippedOccupied).toBe(0);
  });

  it('trie le plan par date puis par créneau, quel que soit l’ordre reçu', () => {
    const p = planMonthCopy(
      [garde('2026-07-08', 'S1N'), garde('2026-07-01'), garde('2026-07-08')],
      JUILLET,
      AOUT,
      []
    );
    expect(p.rows.map(r => `${r.work_date} ${r.shift_type}`)).toEqual([
      '2026-08-05 S1J',
      '2026-08-12 S1J',
      '2026-08-12 S1N',
    ]);
  });

  it('suit la configuration des créneaux (type désactivé)', () => {
    setShiftTypes([
      {
        code: 'S1J',
        label: 'S1 Jour',
        hours: 10,
        clinical: true,
        isNight: false,
        weekend: true,
        sortOrder: 0,
        startTime: null,
        endTime: null,
        endDayOffset: 0,
        color: null,
        active: false, // désactivé par l'admin : plus rien à couvrir
      },
    ]);
    const p = planMonthCopy([garde('2026-07-07')], JUILLET, AOUT, []);
    expect(p.rows).toEqual([]);
    expect(p.skippedInactive).toBe(1);
  });

  it('classe chaque garde source dans exactement une catégorie', () => {
    const source = [
      garde('2026-07-01'), // copiée
      garde('2026-07-02'), // déjà attribuée dans le mois cible
      garde('2026-07-30'), // déborde de septembre
      garde('2026-06-30'), // hors du mois source
    ];
    const p = planMonthCopy(source, JUILLET, AOUT, [
      { work_date: '2026-08-06', shift_type: 'S1J' },
    ]);
    expect(
      p.rows.length + p.skippedOutside + p.skippedInactive + p.skippedOccupied
    ).toBe(source.length);
    expect(p.rows.map(r => r.work_date)).toEqual(['2026-08-05']);
    expect(p.skippedOccupied).toBe(1);
    expect(p.skippedOutside).toBe(2);
  });
});
