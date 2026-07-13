import type { MonthDay } from '../../lib/dates.ts';
import { WEEKDAY_LABELS } from '../../lib/dates.ts';
import type { Doctor, Shift } from '../../backend/types.ts';
import { PAGE, PdfContent, buildPdf, downloadPdf, type Rgb } from '../../lib/pdf.ts';

/**
 * Export d'un **vrai fichier PDF** du mois affiché, sous la forme : n° de semaine,
 * jour, puis les colonnes cliniques S1J / S1N / S2J (médecin affecté). Les
 * week-ends et jours fériés sont grisés et sans S2J (couverture réduite). Aucune
 * dépendance : le binaire est produit par `src/lib/pdf.ts` et téléchargé
 * directement (pas de dialogue d'impression).
 */

export interface MonthPdfOptions {
  title: string; // ex. « Juillet 2026 »
  weeks: { week: number; days: MonthDay[] }[];
  shiftIndex: Map<string, Shift>;
  doctorsById: Map<string, Doctor>;
}

/** Une ligne « jour » du tableau (modèle pur, testable). */
export interface MonthPdfRow {
  week: string; // n° de semaine ISO, uniquement sur le 1er jour de la semaine
  day: string; // ex. « Mardi 14 * » (* = jour férié)
  reduced: boolean; // week-end ou férié → ligne grisée, sans S2J
  s1j: string;
  s1n: string;
  s2j: string;
}

export interface MonthPdfModel {
  title: string;
  rows: MonthPdfRow[];
}

/** Construit le modèle du tableau (fonction pure, testable). */
export function buildMonthPdfModel(opts: MonthPdfOptions): MonthPdfModel {
  const { title, weeks, shiftIndex, doctorsById } = opts;
  const nameFor = (iso: string, type: string) => {
    const s = shiftIndex.get(`${iso}|${type}`);
    return s ? (doctorsById.get(s.doctor_id)?.name ?? '') : '';
  };

  const rows: MonthPdfRow[] = [];
  for (const { week, days } of weeks) {
    days.forEach((d, i) => {
      rows.push({
        week: i === 0 ? String(week) : '',
        day: `${WEEKDAY_LABELS[d.weekday]} ${d.date.getDate()}${d.holiday ? ' *' : ''}`,
        reduced: d.reduced,
        s1j: nameFor(d.iso, 'S1J'),
        s1n: nameFor(d.iso, 'S1N'),
        s2j: d.reduced ? '' : nameFor(d.iso, 'S2J'),
      });
    });
  }
  return { title, rows };
}

// -------------------------------- Mise en page --------------------------------

const M = 36; // marge page
const CONTENT_W = PAGE.w - 2 * M;
const COL_SEM = 44;
const COL_JOUR = 150;
const COL_CLIN = (CONTENT_W - COL_SEM - COL_JOUR) / 3;
const X_SEM = M;
const X_JOUR = X_SEM + COL_SEM;
const X_S1J = X_JOUR + COL_JOUR;
const X_S1N = X_S1J + COL_CLIN;
const X_S2J = X_S1N + COL_CLIN;
const X_END = M + CONTENT_W;

const TITLE_Y = M + 8;
const TABLE_TOP = M + 30;
const HEADER_H = 20;
const ROW_H = 16;
const FONT = 9;
const HEADER_FONT = 9.5;
const GRID_GRAY = 0.5;

const C_HEADER: Rgb = [0.42, 0.12, 0.42]; // en-tête violet
const C_WHITE: Rgb = [1, 1, 1];
const C_SEM: Rgb = [1, 0.9, 0]; // colonne semaine (jaune)
const C_WE: Rgb = [0.82, 0.82, 0.82]; // week-end / férié
const C_OFF: Rgb = [0.6, 0.6, 0.6]; // S2J neutralisé
const C_BLACK: Rgb = [0, 0, 0];

const COLS = [X_SEM, X_JOUR, X_S1J, X_S1N, X_S2J, X_END];

/** Lignes par page (l'en-tête est répété), avec repli à ≥ 1. */
function rowsPerPage(): number {
  const usable = PAGE.h - TABLE_TOP - M - HEADER_H;
  return Math.max(1, Math.floor(usable / ROW_H));
}

/** Tronque un nom pour tenir dans une colonne clinique. */
function fit(name: string): string {
  return name.length > 16 ? `${name.slice(0, 15)}…` : name;
}

/** Dessine une page (titre + en-tête + un lot de lignes). */
function drawPage(c: PdfContent, title: string, rows: MonthPdfRow[]): void {
  c.text(M, TITLE_Y, 16, title, {
    bold: true,
    align: 'center',
    width: CONTENT_W,
  });

  // En-tête
  c.fillRect(X_SEM, TABLE_TOP, CONTENT_W, HEADER_H, C_HEADER);
  const headBase = TABLE_TOP + HEADER_H * 0.5 + HEADER_FONT * 0.35;
  const head = (x: number, w: number, label: string) =>
    c.text(x, headBase, HEADER_FONT, label, {
      bold: true,
      color: C_WHITE,
      align: 'center',
      width: w,
    });
  head(X_SEM, COL_SEM, 'Sem');
  c.text(X_JOUR + 6, headBase, HEADER_FONT, 'Jour', { bold: true, color: C_WHITE });
  head(X_S1J, COL_CLIN, 'S1J');
  head(X_S1N, COL_CLIN, 'S1N');
  head(X_S2J, COL_CLIN, 'S2J');

  // Lignes
  rows.forEach((r, i) => {
    const y = TABLE_TOP + HEADER_H + i * ROW_H;
    if (r.reduced) c.fillRect(X_JOUR, y, X_END - X_JOUR, ROW_H, C_WE);
    c.fillRect(X_SEM, y, COL_SEM, ROW_H, C_SEM); // colonne semaine toujours jaune
    if (r.reduced) c.fillRect(X_S2J, y, COL_CLIN, ROW_H, C_OFF);

    const base = y + ROW_H * 0.5 + FONT * 0.35;
    if (r.week)
      c.text(X_SEM, base, FONT, r.week, { bold: true, align: 'center', width: COL_SEM });
    c.text(X_JOUR + 6, base, FONT, r.day, { color: C_BLACK });
    if (r.s1j) c.text(X_S1J, base, FONT, fit(r.s1j), { align: 'center', width: COL_CLIN });
    if (r.s1n) c.text(X_S1N, base, FONT, fit(r.s1n), { align: 'center', width: COL_CLIN });
    if (r.s2j) c.text(X_S2J, base, FONT, fit(r.s2j), { align: 'center', width: COL_CLIN });
  });

  // Grille : verticales + horizontales par-dessus les aplats
  const bottom = TABLE_TOP + HEADER_H + rows.length * ROW_H;
  for (const x of COLS) c.line(x, TABLE_TOP, x, bottom, 0.6, GRID_GRAY);
  c.line(X_SEM, TABLE_TOP, X_END, TABLE_TOP, 0.8, GRID_GRAY);
  c.line(X_SEM, TABLE_TOP + HEADER_H, X_END, TABLE_TOP + HEADER_H, 0.8, GRID_GRAY);
  for (let i = 1; i <= rows.length; i++) {
    const y = TABLE_TOP + HEADER_H + i * ROW_H;
    c.line(X_SEM, y, X_END, y, 0.5, GRID_GRAY);
  }
}

/** Rend le PDF (octets) à partir du modèle, en paginant si besoin. */
export function renderMonthPdf(model: MonthPdfModel): Uint8Array {
  const per = rowsPerPage();
  const pages: PdfContent[] = [];
  for (let i = 0; i < model.rows.length; i += per) {
    const c = new PdfContent();
    drawPage(c, model.title, model.rows.slice(i, i + per));
    pages.push(c);
  }
  if (pages.length === 0) {
    const c = new PdfContent();
    drawPage(c, model.title, []);
    pages.push(c);
  }
  return buildPdf(pages);
}

/** Nom de fichier « planning-juillet-2026.pdf » à partir du titre. */
function fileName(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `planning-${slug || 'mois'}.pdf`;
}

/** Génère et télécharge le vrai fichier PDF du mois. */
export function exportMonthPdf(opts: MonthPdfOptions): void {
  const model = buildMonthPdfModel(opts);
  downloadPdf(renderMonthPdf(model), fileName(model.title));
}
