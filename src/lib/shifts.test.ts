import { describe, expect, it, afterEach } from 'vitest';
import {
  activeShiftTypes,
  clinicalShiftTypes,
  computeCounters,
  isNightShift,
  shiftHours,
  shiftLabel,
  setShiftTypes,
  DEFAULT_SHIFT_TYPES,
  type ShiftTypeDef,
} from './shifts.ts';
import { isoWeek } from './dates.ts';

describe('shiftHours (défauts)', () => {
  it('respecte la base horaire métier', () => {
    expect(shiftHours('S1J')).toBe(10);
    expect(shiftHours('S1N')).toBe(15);
    expect(shiftHours('S2J')).toBe(8);
    expect(shiftHours('S3')).toBe(8);
    expect(shiftHours('INCONNU')).toBe(0); // repli
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
  it('propose les 3 créneaux cliniques un jour de semaine ordinaire', () => {
    // 2026-07-07 = mardi. S3 n'est plus un créneau clinique (heures non cliniques).
    expect(activeShiftTypes(new Date(2026, 6, 7))).toEqual([
      'S1J',
      'S1N',
      'S2J',
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

describe('configuration dynamique des créneaux', () => {
  // Restaure les défauts après chaque test (état de module partagé).
  afterEach(() => setShiftTypes(DEFAULT_SHIFT_TYPES));

  function def(over: Partial<ShiftTypeDef>): ShiftTypeDef {
    return {
      code: 'X',
      label: 'X',
      hours: 8,
      clinical: true,
      isNight: false,
      weekend: true,
      sortOrder: 0,
      startTime: null,
      endTime: null,
      endDayOffset: 0,
      color: null,
      active: true,
      ...over,
    };
  }

  it('prend en compte un 4ᵉ créneau clinique en semaine', () => {
    setShiftTypes([
      def({ code: 'S1J', label: 'S1 Jour', hours: 10, weekend: true, sortOrder: 0 }),
      def({ code: 'S1N', label: 'S1 Nuit', hours: 15, isNight: true, weekend: true, sortOrder: 1 }),
      def({ code: 'S2J', label: 'S2 Jour', hours: 8, weekend: false, sortOrder: 2 }),
      def({ code: 'S4', label: 'S4 Jour', hours: 6, weekend: false, sortOrder: 3 }),
    ]);
    // mardi ordinaire : les 4 cliniques actifs
    expect(activeShiftTypes(new Date(2026, 6, 7))).toEqual(['S1J', 'S1N', 'S2J', 'S4']);
    expect(clinicalShiftTypes()).toEqual(['S1J', 'S1N', 'S2J', 'S4']);
  });

  it('exclut les créneaux non-week-end le samedi', () => {
    setShiftTypes([
      def({ code: 'S1J', hours: 10, weekend: true, sortOrder: 0 }),
      def({ code: 'S4', hours: 6, weekend: false, sortOrder: 1 }),
    ]);
    expect(activeShiftTypes(new Date(2026, 6, 4))).toEqual(['S1J']); // samedi
    expect(activeShiftTypes(new Date(2026, 6, 7))).toEqual(['S1J', 'S4']); // mardi
  });

  it('ignore les types inactifs et non cliniques dans la couverture', () => {
    setShiftTypes([
      def({ code: 'S1J', sortOrder: 0 }),
      def({ code: 'S2J', sortOrder: 1, active: false }), // désactivé
      def({ code: 'HNC', sortOrder: 2, clinical: false }), // non clinique
    ]);
    expect(activeShiftTypes(new Date(2026, 6, 7))).toEqual(['S1J']);
  });

  it('généralise heures fractionnaires, libellé et statut nuit', () => {
    setShiftTypes([
      def({ code: 'GN', label: 'Grande nuit', hours: 12.5, isNight: true }),
      def({ code: 'CD', label: 'Court jour', hours: 4.5, isNight: false }),
    ]);
    expect(shiftHours('GN')).toBe(12.5);
    expect(shiftLabel('GN')).toBe('Grande nuit');
    expect(isNightShift('GN')).toBe(true);
    expect(isNightShift('CD')).toBe(false);
    // Les heures fractionnaires remontent dans les compteurs.
    expect(computeCounters([{ work_date: '2026-01-05', shift_type: 'GN' }]).totalHours).toBe(12.5);
  });

  it('conserve les défauts si on tente d’injecter une liste vide', () => {
    setShiftTypes([]);
    expect(activeShiftTypes(new Date(2026, 6, 7))).toEqual(['S1J', 'S1N', 'S2J']);
  });
});
