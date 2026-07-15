import {
  PAGE,
  PdfContent,
  buildPdf,
  downloadPdf,
  textWidth,
  type Rgb,
} from '../../lib/pdf.ts';
import { buildXlsx, downloadXlsx, type XlsxValue } from '../../lib/xlsx.ts';

/**
 * Exports de la page « Compteurs de l'équipe » (admin) dans trois formats :
 * CSV, Excel (.xlsx) et PDF. Les trois partagent la même définition de colonnes
 * (`COLS`) pour rester cohérents.
 */

/** Compteurs d'un médecin, agrégés sur la période affichée. */
export interface CounterRow {
  name: string;
  fridays: number;
  saturdays: number;
  sundays: number;
  weekendHours: number;
  hncHours: number;
  totalHours: number;
  annualDays: number;
  trainingHours: number;
}

interface Col {
  /** En-tête long (CSV / Excel). */
  head: string;
  /** En-tête compact (PDF, colonnes étroites). */
  short: string;
  /** Colonne numérique (cellule typée en Excel, centrée en PDF). */
  num: boolean;
  val: (r: CounterRow) => XlsxValue;
  /** Suffixe d'unité ajouté dans le PDF (ex. « h », « j »). */
  unit: string;
}

const COLS: Col[] = [
  { head: 'Médecin', short: 'Médecin', num: false, val: r => r.name, unit: '' },
  { head: 'Vendredis', short: 'Ven', num: true, val: r => r.fridays, unit: '' },
  { head: 'Samedis', short: 'Sam', num: true, val: r => r.saturdays, unit: '' },
  { head: 'Dimanches', short: 'Dim', num: true, val: r => r.sundays, unit: '' },
  { head: 'Heures WE', short: 'h WE', num: true, val: r => r.weekendHours, unit: ' h' },
  { head: 'Heures non cliniques', short: 'HNC', num: true, val: r => r.hncHours, unit: ' h' },
  { head: 'Heures totales', short: 'h Total', num: true, val: r => r.totalHours, unit: ' h' },
  { head: 'Congés (j)', short: 'Congés', num: true, val: r => r.annualDays, unit: ' j' },
  { head: 'Formation (h)', short: 'Format.', num: true, val: r => r.trainingHours, unit: ' h' },
];

/** `Juillet 2026` → `juillet-2026` (nom de fichier sûr). */
function slug(label: string): string {
  return (
    label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'export'
  );
}

function fileName(label: string, ext: string): string {
  return `compteurs-${slug(label)}.${ext}`;
}

// ---------------------------------- CSV ----------------------------------

/** Export CSV (séparateur « ; », BOM UTF-8 pour Excel). */
export function exportCountersCsv(rows: CounterRow[], label: string): void {
  const header = COLS.map(c => c.head);
  const lines = rows.map(r =>
    COLS.map(c => `"${String(c.val(r)).replace(/"/g, '""')}"`).join(';')
  );
  const csv = '﻿' + [header.join(';'), ...lines].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName(label, 'csv');
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// --------------------------------- Excel ---------------------------------

/** Export Excel `.xlsx` (cellules numériques réellement typées, sommables). */
export function exportCountersXlsx(rows: CounterRow[], label: string): void {
  const bytes = buildXlsx({
    name: `Compteurs ${label}`,
    header: COLS.map(c => c.head),
    rows: rows.map(r => COLS.map(c => c.val(r))),
  });
  downloadXlsx(bytes, fileName(label, 'xlsx'));
}

// ---------------------------------- PDF ----------------------------------

const M = 34; // marge
const CONTENT_W = PAGE.w - 2 * M;
const COL_NAME = 148;
const NUM_COLS = COLS.length - 1;
const COL_NUM = (CONTENT_W - COL_NAME) / NUM_COLS;

const TITLE_Y = M + 8;
const TABLE_TOP = M + 30;
const HEADER_H = 20;
const ROW_H = 15;
const FONT = 8.5;
const HEADER_FONT = 8.5;
const GRID_GRAY = 0.55;

const C_HEADER: Rgb = [0.42, 0.12, 0.42]; // en-tête violet (identique au planning)
const C_WHITE: Rgb = [1, 1, 1];
const C_ALT: Rgb = [0.95, 0.95, 0.97]; // ligne paire (zébrage léger)
const C_BLACK: Rgb = [0, 0, 0];

/** Abscisse du bord gauche de chaque colonne (name + colonnes numériques). */
const X_COLS: number[] = (() => {
  const xs = [M];
  let x = M + COL_NAME;
  for (let i = 0; i < NUM_COLS; i++) {
    xs.push(x);
    x += COL_NUM;
  }
  return xs;
})();
const X_END = M + CONTENT_W;

/** Tronque un texte pour tenir dans une largeur (points), avec « … ». */
function fit(text: string, maxW: number, size: number): string {
  if (textWidth(text, size) <= maxW) return text;
  let s = text;
  while (s.length > 1 && textWidth(s + '…', size) > maxW) s = s.slice(0, -1);
  return s + '…';
}

function rowsPerPage(): number {
  const usable = PAGE.h - TABLE_TOP - M - HEADER_H;
  return Math.max(1, Math.floor(usable / ROW_H));
}

function drawPage(
  c: PdfContent,
  title: string,
  rows: CounterRow[],
  pageStart: number
): void {
  c.text(M, TITLE_Y, 15, title, { bold: true, align: 'center', width: CONTENT_W });

  // En-tête
  c.fillRect(M, TABLE_TOP, CONTENT_W, HEADER_H, C_HEADER);
  const headBase = TABLE_TOP + HEADER_H * 0.5 + HEADER_FONT * 0.35;
  c.text(X_COLS[0] + 6, headBase, HEADER_FONT, COLS[0].short, {
    bold: true,
    color: C_WHITE,
  });
  for (let i = 1; i < COLS.length; i++) {
    c.text(X_COLS[i], headBase, HEADER_FONT, COLS[i].short, {
      bold: true,
      color: C_WHITE,
      align: 'center',
      width: COL_NUM,
    });
  }

  // Lignes
  rows.forEach((r, i) => {
    const y = TABLE_TOP + HEADER_H + i * ROW_H;
    if ((pageStart + i) % 2 === 1) c.fillRect(M, y, CONTENT_W, ROW_H, C_ALT);
    const base = y + ROW_H * 0.5 + FONT * 0.35;
    c.text(X_COLS[0] + 6, base, FONT, fit(r.name, COL_NAME - 10, FONT), {
      color: C_BLACK,
    });
    for (let ci = 1; ci < COLS.length; ci++) {
      const col = COLS[ci];
      c.text(X_COLS[ci], base, FONT, `${col.val(r)}${col.unit}`, {
        align: 'center',
        width: COL_NUM,
      });
    }
  });

  // Grille
  const bottom = TABLE_TOP + HEADER_H + rows.length * ROW_H;
  for (const x of [...X_COLS, X_END]) c.line(x, TABLE_TOP, x, bottom, 0.6, GRID_GRAY);
  c.line(M, TABLE_TOP, X_END, TABLE_TOP, 0.8, GRID_GRAY);
  c.line(M, TABLE_TOP + HEADER_H, X_END, TABLE_TOP + HEADER_H, 0.8, GRID_GRAY);
  for (let i = 1; i <= rows.length; i++) {
    const y = TABLE_TOP + HEADER_H + i * ROW_H;
    c.line(M, y, X_END, y, 0.5, GRID_GRAY);
  }
}

/** Rend les octets du PDF (paginé) du tableau des compteurs — fonction pure. */
export function renderCountersPdf(rows: CounterRow[], label: string): Uint8Array {
  const title = `Compteurs — ${label}`;
  const per = rowsPerPage();
  const pages: PdfContent[] = [];
  for (let i = 0; i < rows.length; i += per) {
    const c = new PdfContent();
    drawPage(c, title, rows.slice(i, i + per), i);
    pages.push(c);
  }
  if (pages.length === 0) {
    const c = new PdfContent();
    drawPage(c, title, [], 0);
    pages.push(c);
  }
  return buildPdf(pages);
}

/** Génère et télécharge le PDF du tableau des compteurs. */
export function exportCountersPdf(rows: CounterRow[], label: string): void {
  downloadPdf(renderCountersPdf(rows, label), fileName(label, 'pdf'));
}
