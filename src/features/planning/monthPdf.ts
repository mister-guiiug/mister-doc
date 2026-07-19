import type { MonthDay } from '../../lib/dates.ts';
import { WEEKDAY_LABELS } from '../../lib/dates.ts';
import type { Doctor, Shift } from '../../backend/types.ts';
import { clinicalShiftTypes, shiftDef, shiftLabel } from '../../lib/shifts.ts';
import { logWarn } from '../../lib/logger.ts';
import { PAGE, PdfContent, buildPdf, downloadPdf, type Rgb } from '../../lib/pdf.ts';

/**
 * Export d'un **vrai fichier PDF** du mois affiché : n° de semaine, jour, puis
 * une colonne par créneau CLINIQUE actif (configurable, cf. `shift_types`) avec
 * le médecin affecté. Les week-ends et jours fériés sont grisés ; les créneaux
 * non couverts ces jours-là (ex. S2J) sont neutralisés. Aucune dépendance : le
 * binaire est produit par `src/lib/pdf.ts` et téléchargé directement.
 */

/** Au-delà, la lisibilité en A4 se dégrade — on l'accepte mais on le journalise. */
const MAX_CLINICAL_COLS = 6;

export interface MonthPdfOptions {
  title: string; // ex. « Juillet 2026 »
  weeks: { week: number; days: MonthDay[] }[];
  shiftIndex: Map<string, Shift>;
  doctorsById: Map<string, Doctor>;
}

/** Une colonne = un créneau clinique (ordre d'affichage). */
export interface MonthPdfColumn {
  code: string;
  label: string;
}

/** Cellule d'affectation : nom du médecin, et `off` si le créneau n'est pas couvert ce jour. */
export interface MonthPdfCell {
  name: string;
  off: boolean;
}

/** Une ligne « jour » du tableau (modèle pur, testable). */
export interface MonthPdfRow {
  week: string; // n° de semaine ISO, uniquement sur le 1er jour de la semaine
  day: string; // ex. « Mardi 14 * » (* = jour férié)
  reduced: boolean; // week-end ou férié → ligne grisée
  cells: MonthPdfCell[]; // alignées sur `columns`
}

export interface MonthPdfModel {
  title: string;
  columns: MonthPdfColumn[];
  rows: MonthPdfRow[];
}

/** Construit le modèle du tableau (fonction pure, testable). */
export function buildMonthPdfModel(opts: MonthPdfOptions): MonthPdfModel {
  const { title, weeks, shiftIndex, doctorsById } = opts;
  const codes = clinicalShiftTypes();
  if (codes.length > MAX_CLINICAL_COLS) {
    logWarn(
      'monthPdf',
      `${codes.length} créneaux cliniques > ${MAX_CLINICAL_COLS} : lisibilité A4 réduite.`
    );
  }
  const columns: MonthPdfColumn[] = codes.map(code => ({
    code,
    label: shiftLabel(code),
  }));

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
        cells: columns.map(col => {
          // Créneau non couvert ce jour : jour réduit et type non requis le WE.
          const off = d.reduced && !(shiftDef(col.code)?.weekend ?? true);
          return { name: off ? '' : nameFor(d.iso, col.code), off };
        }),
      });
    });
  }
  return { title, columns, rows };
}

// -------------------------------- Mise en page --------------------------------

const M = 36; // marge page
const CONTENT_W = PAGE.w - 2 * M;
const COL_SEM = 44;
const COL_JOUR = 150;
const X_SEM = M;
const X_JOUR = X_SEM + COL_SEM;
const X_CLIN = X_JOUR + COL_JOUR; // début des colonnes cliniques
const X_END = M + CONTENT_W;
const CLIN_W = X_END - X_CLIN; // largeur totale des colonnes cliniques

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
const C_OFF: Rgb = [0.6, 0.6, 0.6]; // créneau neutralisé
const C_BLACK: Rgb = [0, 0, 0];

/** Largeur d'une colonne clinique selon leur nombre (repli à 1). */
function colWidth(nCols: number): number {
  return CLIN_W / Math.max(1, nCols);
}
/** Abscisse gauche de la colonne clinique d'indice `i`. */
function colX(i: number, nCols: number): number {
  return X_CLIN + i * colWidth(nCols);
}

/** Lignes par page (l'en-tête est répété), avec repli à ≥ 1. */
function rowsPerPage(): number {
  const usable = PAGE.h - TABLE_TOP - M - HEADER_H;
  return Math.max(1, Math.floor(usable / ROW_H));
}

/** Tronque un nom pour tenir dans une colonne clinique (selon sa largeur). */
function fit(name: string, width: number): string {
  const max = Math.max(4, Math.floor(width / 5.5)); // ~5.5 pt/caractère à 9 pt
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

/** Dessine une page (titre + en-tête + un lot de lignes). */
function drawPage(
  c: PdfContent,
  title: string,
  columns: MonthPdfColumn[],
  rows: MonthPdfRow[]
): void {
  const nCols = columns.length;
  const cw = colWidth(nCols);

  c.text(M, TITLE_Y, 16, title, { bold: true, align: 'center', width: CONTENT_W });

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
  columns.forEach((col, i) => head(colX(i, nCols), cw, col.code));

  // Lignes
  rows.forEach((r, i) => {
    const y = TABLE_TOP + HEADER_H + i * ROW_H;
    if (r.reduced) c.fillRect(X_JOUR, y, X_END - X_JOUR, ROW_H, C_WE);
    c.fillRect(X_SEM, y, COL_SEM, ROW_H, C_SEM); // colonne semaine toujours jaune
    r.cells.forEach((cell, ci) => {
      if (cell.off) c.fillRect(colX(ci, nCols), y, cw, ROW_H, C_OFF);
    });

    const base = y + ROW_H * 0.5 + FONT * 0.35;
    if (r.week)
      c.text(X_SEM, base, FONT, r.week, { bold: true, align: 'center', width: COL_SEM });
    c.text(X_JOUR + 6, base, FONT, r.day, { color: C_BLACK });
    r.cells.forEach((cell, ci) => {
      if (cell.name)
        c.text(colX(ci, nCols), base, FONT, fit(cell.name, cw), {
          align: 'center',
          width: cw,
        });
    });
  });

  // Grille : verticales (Sem, Jour, chaque colonne, fin) + horizontales.
  const bottom = TABLE_TOP + HEADER_H + rows.length * ROW_H;
  const verticals = [X_SEM, X_JOUR, X_CLIN];
  for (let i = 1; i <= nCols; i++) verticals.push(colX(i, nCols));
  for (const x of verticals) c.line(x, TABLE_TOP, x, bottom, 0.6, GRID_GRAY);
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
    drawPage(c, model.title, model.columns, model.rows.slice(i, i + per));
    pages.push(c);
  }
  if (pages.length === 0) {
    const c = new PdfContent();
    drawPage(c, model.title, model.columns, []);
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
