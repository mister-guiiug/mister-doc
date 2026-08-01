import { describe, expect, it, afterEach } from 'vitest';
import { planWeeklyRepeat } from './repeatPlan.ts';
import { setShiftTypes, DEFAULT_SHIFT_TYPES } from './shifts.ts';

/** Aucun mois verrouillé : le cas courant. */
const jamaisVerrouille = () => false;

describe('planWeeklyRepeat', () => {
  // Les tests qui injectent une config doivent rendre les défauts aux suivants.
  afterEach(() => setShiftTypes(DEFAULT_SHIFT_TYPES));

  it('sans répétition, ne retient que le jour choisi', () => {
    // 2026-07-07 = mardi ordinaire.
    const p = planWeeklyRepeat('2026-07-07', 'S1J', 1, jamaisVerrouille);
    expect(p.dates).toEqual(['2026-07-07']);
    expect(p.skippedInactive).toBe(0);
    expect(p.skippedLocked).toBe(0);
  });

  it('répète le même jour de semaine, de 7 en 7', () => {
    const p = planWeeklyRepeat('2026-07-07', 'S1J', 4, jamaisVerrouille);
    expect(p.dates).toEqual([
      '2026-07-07',
      '2026-07-14',
      '2026-07-21',
      '2026-07-28',
    ]);
  });

  it('écarte les dates où le créneau n’est pas à couvrir (férié)', () => {
    // S2J n'est pas requis les jours à couverture réduite ; le 14/07 est férié.
    const p = planWeeklyRepeat('2026-07-07', 'S2J', 3, jamaisVerrouille);
    expect(p.dates).toEqual(['2026-07-07', '2026-07-21']);
    expect(p.skippedInactive).toBe(1);
  });

  it('écarte les dates du week-end pour un créneau de semaine', () => {
    // 2026-07-04 = samedi : S2J (weekend: false) n'y est pas couvert.
    const p = planWeeklyRepeat('2026-07-04', 'S2J', 2, jamaisVerrouille);
    expect(p.dates).toEqual([]);
    expect(p.skippedInactive).toBe(2);
  });

  it('écarte les dates dont le mois est verrouillé, y compris en débordant', () => {
    // Répétition depuis fin juillet : les dates d'août tombent dans un mois
    // verrouillé (mois 0-indexé : 7 = août).
    const aoutVerrouille = (_y: number, mo: number) => mo === 7;
    const p = planWeeklyRepeat('2026-07-21', 'S1J', 4, aoutVerrouille);
    expect(p.dates).toEqual(['2026-07-21', '2026-07-28']);
    expect(p.skippedLocked).toBe(2);
  });

  it('ne retient rien si tout est écarté', () => {
    const toutVerrouille = () => true;
    const p = planWeeklyRepeat('2026-07-07', 'S1J', 3, toutVerrouille);
    expect(p.dates).toEqual([]);
    expect(p.skippedLocked).toBe(3);
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
    const p = planWeeklyRepeat('2026-07-07', 'S1J', 2, jamaisVerrouille);
    expect(p.dates).toEqual([]);
    expect(p.skippedInactive).toBe(2);
  });
});
