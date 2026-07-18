import { describe, expect, it } from 'vitest';
import { timeAgo } from './relativeTime.ts';

const ago = (seconds: number) =>
  new Date(Date.now() - seconds * 1000).toISOString();

describe('timeAgo', () => {
  it('« à l’instant » sous une minute', () => {
    expect(timeAgo(ago(10))).toBe("à l'instant");
  });

  it('minutes / heures / jours', () => {
    expect(timeAgo(ago(5 * 60))).toBe('il y a 5 min');
    expect(timeAgo(ago(3 * 3600))).toBe('il y a 3 h');
    expect(timeAgo(ago(2 * 86400))).toBe('il y a 2 j');
  });

  it('la date locale au-delà d’une semaine', () => {
    expect(timeAgo(ago(30 * 86400))).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });
});
