import { describe, expect, it } from 'vitest';
import { buildXlsx } from './xlsx.ts';

const dec = new TextDecoder();

/** CRC32 de référence (indépendant de l'implémentation testée). */
function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Mini-extracteur d'archive ZIP « stored » (méthode 0) : parcourt les en-têtes
 * locaux depuis l'offset 0. Suffisant pour relire ce que produit `buildXlsx`.
 */
function unzipStored(zip: Uint8Array): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>();
  const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  let p = 0;
  while (p + 4 <= zip.length && dv.getUint32(p, true) === 0x04034b50) {
    const method = dv.getUint16(p + 8, true);
    const crc = dv.getUint32(p + 14, true);
    const size = dv.getUint32(p + 18, true);
    const nameLen = dv.getUint16(p + 26, true);
    const extraLen = dv.getUint16(p + 28, true);
    const nameStart = p + 30;
    const name = dec.decode(zip.subarray(nameStart, nameStart + nameLen));
    const dataStart = nameStart + nameLen + extraLen;
    const data = zip.subarray(dataStart, dataStart + size);
    expect(method).toBe(0); // STORE
    expect(crc32(data)).toBe(crc); // le CRC stocké est correct
    files.set(name, data);
    p = dataStart + size;
  }
  return files;
}

describe('buildXlsx', () => {
  it('produit une archive ZIP OOXML relisible', () => {
    const zip = buildXlsx({
      name: 'Compteurs',
      header: ['Médecin', 'Heures'],
      rows: [
        ['Alice', 12],
        ['Bob', 7],
      ],
    });

    // Signature ZIP « PK\x03\x04 ».
    expect(Array.from(zip.subarray(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);

    const files = unzipStored(zip);
    // Toutes les parties minimales sont présentes.
    for (const part of [
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/worksheets/sheet1.xml',
    ]) {
      expect(files.has(part)).toBe(true);
    }

    const sheet = dec.decode(files.get('xl/worksheets/sheet1.xml'));
    // En-tête en gras (style 1) + chaîne en ligne.
    expect(sheet).toContain('<c r="A1" s="1" t="inlineStr">');
    expect(sheet).toContain('<t xml:space="preserve">Médecin</t>');
    // Cellule numérique réellement typée (pas de t="inlineStr").
    expect(sheet).toContain('<c r="B2"><v>12</v></c>');
    // Nom du médecin en chaîne en ligne.
    expect(sheet).toContain('<t xml:space="preserve">Alice</t>');
  });

  it('échappe le XML et assainit le nom d’onglet', () => {
    const zip = buildXlsx({
      name: 'A/B:C*[très long nom d onglet au-delà de trente et un caractères]',
      header: ['x'],
      rows: [['a & b <c>']],
    });
    const files = unzipStored(zip);
    const sheet = dec.decode(files.get('xl/worksheets/sheet1.xml'));
    expect(sheet).toContain('a &amp; b &lt;c&gt;');

    const workbook = dec.decode(files.get('xl/workbook.xml'));
    const m = workbook.match(/name="([^"]*)"/);
    expect(m).not.toBeNull();
    const sheetName = m![1];
    expect(sheetName.length).toBeLessThanOrEqual(31);
    expect(sheetName).not.toMatch(/[\\/?*[\]:]/); // caractères interdits retirés
  });
});
