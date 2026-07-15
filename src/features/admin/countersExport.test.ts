import { describe, expect, it } from 'vitest';
import { renderCountersPdf, type CounterRow } from './countersExport.ts';

const dec = new TextDecoder('latin1');

function makeRows(n: number): CounterRow[] {
  return Array.from({ length: n }, (_, i) => ({
    name: `Dr ${i}`,
    fridays: 0,
    saturdays: 0,
    sundays: 0,
    weekendHours: 0,
    hncHours: 0,
    totalHours: 0,
    annualDays: 0,
    trainingHours: 0,
  }));
}

/** Compte les objets « page » (`/Type /Page ` — l'espace exclut `/Pages`). */
function pageCount(bytes: Uint8Array): number {
  return (dec.decode(bytes).match(/\/Type \/Page /g) ?? []).length;
}

describe('renderCountersPdf', () => {
  it('produit un binaire PDF bien formé', () => {
    const pdf = renderCountersPdf(makeRows(3), 'Juillet 2026');
    const text = dec.decode(pdf);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('pagine au-delà de la hauteur d’une page', () => {
    expect(pageCount(renderCountersPdf(makeRows(10), '2026'))).toBe(1);
    expect(pageCount(renderCountersPdf(makeRows(60), '2026'))).toBe(2);
  });

  it('reste valide sans aucune ligne (en-tête seul)', () => {
    const pdf = renderCountersPdf([], 'Juillet 2026');
    expect(pageCount(pdf)).toBe(1);
    expect(dec.decode(pdf).trimEnd().endsWith('%%EOF')).toBe(true);
  });
});
