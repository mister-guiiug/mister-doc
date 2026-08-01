import { describe, expect, it } from 'vitest';
import { TONE_CLASSES, type Tone } from './tones.ts';

describe('TONE_CLASSES', () => {
  const tones = Object.keys(TONE_CLASSES) as Tone[];

  it('définit chaque ton avec bordure, fond et texte', () => {
    for (const tone of tones) {
      const cls = TONE_CLASSES[tone];
      expect(cls, tone).toMatch(/\bborder-/);
      expect(cls, tone).toMatch(/\bbg-/);
      expect(cls, tone).toMatch(/\btext-/);
    }
  });

  it('fournit une variante sombre pour chaque propriété', () => {
    for (const tone of tones) {
      const cls = TONE_CLASSES[tone];
      expect(cls, tone).toMatch(/dark:border-/);
      expect(cls, tone).toMatch(/dark:bg-/);
      expect(cls, tone).toMatch(/dark:text-/);
    }
  });

  it('n’utilise pas d’opacité sur le texte (contraste AA)', () => {
    for (const tone of tones) {
      expect(TONE_CLASSES[tone], tone).not.toMatch(/text-\S+\/\d/);
    }
  });
});
