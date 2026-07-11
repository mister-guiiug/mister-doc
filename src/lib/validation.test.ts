import { describe, expect, it } from 'vitest';
import {
  computeIssues,
  doctorsOnLeave,
  doctorsWorking,
  violatesRest,
} from './validation.ts';

const names = new Map([
  ['a', 'Dr A'],
  ['b', 'Dr B'],
  ['c', 'Dr C'],
]);

describe('computeIssues', () => {
  it('signale le repos de sécurité (garde au lendemain d’une nuit)', () => {
    const issues = computeIssues(
      [
        { work_date: '2026-07-10', shift_type: 'S1N', doctor_id: 'a' },
        { work_date: '2026-07-11', shift_type: 'S1J', doctor_id: 'a' },
      ],
      [],
      names
    );
    const day = issues.get('2026-07-11') ?? [];
    expect(day.some(i => i.level === 'error' && /Repos/.test(i.message))).toBe(true);
  });

  it('signale un conflit garde + absence le même jour', () => {
    const issues = computeIssues(
      [{ work_date: '2026-07-12', shift_type: 'S1J', doctor_id: 'b' }],
      [{ work_date: '2026-07-12', doctor_id: 'b' }],
      names
    );
    expect(
      (issues.get('2026-07-12') ?? []).some(i => /absence/.test(i.message))
    ).toBe(true);
  });

  it('avertit du cumul de créneaux le même jour', () => {
    const issues = computeIssues(
      [
        { work_date: '2026-07-13', shift_type: 'S2J', doctor_id: 'c' },
        { work_date: '2026-07-13', shift_type: 'S3', doctor_id: 'c' },
      ],
      [],
      names
    );
    expect(
      (issues.get('2026-07-13') ?? []).some(
        i => i.level === 'warn' && /créneaux/.test(i.message)
      )
    ).toBe(true);
  });

  it('ne signale rien sur un planning sain', () => {
    const issues = computeIssues(
      [{ work_date: '2026-07-14', shift_type: 'S1J', doctor_id: 'a' }],
      [],
      names
    );
    expect(issues.size).toBe(0);
  });
});

describe('helpers d’affectation', () => {
  const shifts = [
    { work_date: '2026-07-10', shift_type: 'S1N', doctor_id: 'a' },
    { work_date: '2026-07-11', shift_type: 'S1J', doctor_id: 'b' },
  ];
  it('violatesRest détecte une nuit la veille', () => {
    expect(violatesRest('a', '2026-07-11', shifts)).toBe(true);
    expect(violatesRest('b', '2026-07-11', shifts)).toBe(false);
  });
  it('doctorsOnLeave / doctorsWorking', () => {
    expect([...doctorsOnLeave('2026-07-10', [{ work_date: '2026-07-10', doctor_id: 'x' }])]).toEqual(['x']);
    expect(doctorsWorking('2026-07-11', shifts).has('b')).toBe(true);
  });
});
