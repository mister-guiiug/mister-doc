/**
 * Générateur PDF minimal, **sans dépendance externe**. Suffisant pour des
 * documents tabulaires simples : page A4 portrait, polices intégrées Helvetica /
 * Helvetica-Bold (aucun embarquement de fonte), texte encodé WinAnsi.
 *
 * On produit un vrai binaire `application/pdf` (Uint8Array) : offsets de la table
 * xref calculés sur les octets réels, ce qui rend le fichier ouvrable par
 * n'importe quel lecteur. Les coordonnées exposées ont pour origine le **coin
 * haut-gauche** de la page (y vers le bas), plus intuitif ; la conversion vers le
 * repère PDF (origine bas-gauche) est faite en interne.
 */

/** Dimensions A4 portrait, en points PostScript (1/72"). */
export const PAGE = { w: 595.28, h: 841.89 } as const;

export type Rgb = [number, number, number];

/** Formatage insensible à la locale (séparateur décimal « . »), 2 décimales. */
function fmt(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/**
 * Largeur approximative d'un texte Helvetica (en points) — heuristique par
 * glyphe suffisante pour centrer des libellés courts sans embarquer les
 * métriques AFM.
 */
function glyphEm(ch: string): number {
  if (ch === ' ') return 0.278;
  if ("iIl.,:;'|!".includes(ch)) return 0.28;
  if ('ftjr()[]-'.includes(ch)) return 0.34;
  if ('mwMW'.includes(ch)) return 0.86;
  if (ch >= 'A' && ch <= 'Z') return 0.68;
  if (ch >= '0' && ch <= '9') return 0.556;
  return 0.5;
}
export function textWidth(str: string, size: number): number {
  let em = 0;
  for (const ch of str) em += glyphEm(ch);
  return em * size;
}

export interface TextOptions {
  bold?: boolean;
  color?: Rgb;
  align?: 'left' | 'center';
  /** Largeur de la colonne pour l'alignement centré. */
  width?: number;
}

/** Flux de contenu d'une page (repère haut-gauche). */
export class PdfContent {
  private ops: number[] = [];

  private ascii(s: string): void {
    for (let i = 0; i < s.length; i++) this.ops.push(s.charCodeAt(i) & 0xff);
  }

  /** Rectangle plein. (x, yTop) = coin haut-gauche ; couleur RVB (0..1). */
  fillRect(x: number, yTop: number, w: number, h: number, color: Rgb): void {
    const yBottom = PAGE.h - (yTop + h);
    this.ascii(`${fmt(color[0])} ${fmt(color[1])} ${fmt(color[2])} rg\n`);
    this.ascii(`${fmt(x)} ${fmt(yBottom)} ${fmt(w)} ${fmt(h)} re f\n`);
  }

  /** Trait. (x1,y1Top)→(x2,y2Top) en repère haut-gauche ; gris de trait (0..1). */
  line(
    x1: number,
    y1Top: number,
    x2: number,
    y2Top: number,
    width: number,
    gray: number
  ): void {
    this.ascii(`${fmt(gray)} G ${fmt(width)} w\n`);
    this.ascii(
      `${fmt(x1)} ${fmt(PAGE.h - y1Top)} m ${fmt(x2)} ${fmt(PAGE.h - y2Top)} l S\n`
    );
  }

  /** Texte. (x, baselineTop) = position de la ligne de base depuis le haut. */
  text(x: number, baselineTop: number, size: number, str: string, opts: TextOptions = {}): void {
    const color = opts.color ?? [0, 0, 0];
    let tx = x;
    if (opts.align === 'center' && opts.width != null) {
      tx = x + (opts.width - textWidth(str, size)) / 2;
    }
    this.ascii(`${fmt(color[0])} ${fmt(color[1])} ${fmt(color[2])} rg\n`);
    this.ascii(
      `BT /${opts.bold ? 'F2' : 'F1'} ${fmt(size)} Tf ${fmt(tx)} ${fmt(PAGE.h - baselineTop)} Td `
    );
    this.showText(str);
    this.ascii(' Tj ET\n');
  }

  /** Littéral chaîne PDF : encodage WinAnsi + échappement de « ( ) \ ». */
  private showText(str: string): void {
    this.ops.push(0x28); // (
    for (const ch of str) {
      let c = ch.codePointAt(0) ?? 0x3f;
      if (c > 0xff) c = 0x3f; // hors WinAnsi → « ? »
      if (c === 0x28 || c === 0x29 || c === 0x5c) this.ops.push(0x5c);
      this.ops.push(c);
    }
    this.ops.push(0x29); // )
  }

  bytes(): number[] {
    return this.ops;
  }
}

/**
 * Assemble un document PDF (une page par flux de contenu) et renvoie ses octets.
 * Objets : 1=Catalog, 2=Pages, 3=Helvetica, 4=Helvetica-Bold, puis pour chaque
 * page (5,7,9…) et son contenu (6,8,10…).
 */
export function buildPdf(contents: PdfContent[]): Uint8Array {
  const out: number[] = [];
  const pushAscii = (s: string) => {
    for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i) & 0xff);
  };
  const pushBytes = (arr: number[]) => {
    for (const b of arr) out.push(b);
  };

  const nPages = Math.max(contents.length, 1);
  const totalObjs = 4 + nPages * 2;
  const offsets = new Array<number>(totalObjs + 1).fill(0);

  pushAscii('%PDF-1.4\n');
  pushBytes([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]); // commentaire binaire

  const startObj = (num: number) => {
    offsets[num] = out.length;
    pushAscii(`${num} 0 obj\n`);
  };
  const endObj = () => pushAscii('\nendobj\n');

  startObj(1);
  pushAscii('<< /Type /Catalog /Pages 2 0 R >>');
  endObj();

  const kids: string[] = [];
  for (let i = 0; i < nPages; i++) kids.push(`${5 + i * 2} 0 R`);
  startObj(2);
  pushAscii(`<< /Type /Pages /Kids [ ${kids.join(' ')} ] /Count ${nPages} >>`);
  endObj();

  startObj(3);
  pushAscii(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
  );
  endObj();
  startObj(4);
  pushAscii(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
  );
  endObj();

  for (let i = 0; i < nPages; i++) {
    const pageNum = 5 + i * 2;
    const contentNum = 6 + i * 2;
    startObj(pageNum);
    pushAscii(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${fmt(PAGE.w)} ${fmt(PAGE.h)}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentNum} 0 R >>`
    );
    endObj();

    const streamBytes = contents[i].bytes();
    startObj(contentNum);
    pushAscii(`<< /Length ${streamBytes.length} >>\nstream\n`);
    pushBytes(streamBytes);
    pushAscii('\nendstream');
    endObj();
  }

  const xrefOffset = out.length;
  pushAscii(`xref\n0 ${totalObjs + 1}\n`);
  pushAscii('0000000000 65535 f\r\n');
  for (let n = 1; n <= totalObjs; n++) {
    pushAscii(`${String(offsets[n]).padStart(10, '0')} 00000 n\r\n`);
  }
  pushAscii(
    `trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  );

  return Uint8Array.from(out);
}

/** Déclenche le téléchargement d'un binaire PDF (navigateur). */
export function downloadPdf(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
