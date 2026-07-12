import type { MonthDay } from '../../lib/dates.ts';
import { WEEKDAY_LABELS } from '../../lib/dates.ts';
import type { Doctor, Shift } from '../../backend/types.ts';

/**
 * Export PDF du mois affiché sous la forme : n° de semaine, jour, puis les
 * colonnes cliniques S1J / S1N / S2J (médecin affecté). Les week-ends et jours
 * fériés sont grisés et sans S2J (couverture réduite). Sans dépendance : on
 * imprime un tableau HTML dédié via une iframe (l'utilisateur choisit
 * « Enregistrer au format PDF »).
 */

export interface MonthPdfOptions {
  title: string; // ex. « Juillet 2026 »
  weeks: { week: number; days: MonthDay[] }[];
  shiftIndex: Map<string, Shift>;
  doctorsById: Map<string, Doctor>;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Construit le document HTML imprimable (fonction pure, testable). */
export function buildMonthPdfHtml(opts: MonthPdfOptions): string {
  const { title, weeks, shiftIndex, doctorsById } = opts;

  const cell = (iso: string, type: string) => {
    const s = shiftIndex.get(`${iso}|${type}`);
    return s ? esc(doctorsById.get(s.doctor_id)?.name ?? '') : '';
  };

  let rows = '';
  for (const { week, days } of weeks) {
    days.forEach((day, i) => {
      const reduced = day.reduced; // week-end ou férié → pas de S2J
      const dayName = WEEKDAY_LABELS[day.weekday];
      rows += `<tr class="${reduced ? 'we' : ''}">
        <td class="sem">${i === 0 ? week : ''}</td>
        <td class="jour">${esc(dayName)} ${day.date.getDate()}${day.holiday ? ' *' : ''}</td>
        <td>${cell(day.iso, 'S1J')}</td>
        <td>${cell(day.iso, 'S1N')}</td>
        <td class="${reduced ? 'off' : ''}">${reduced ? '' : cell(day.iso, 'S2J')}</td>
      </tr>`;
    });
  }

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { size: A4 portrait; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; }
  h1 { text-align: center; font-size: 20px; letter-spacing: 1px; margin: 0 0 10px; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #8a8a8a; padding: 4px 6px; text-align: center; }
  thead th { background: #6b1f6b; color: #fff; font-weight: bold; }
  td.sem { background: #ffe600; font-weight: bold; width: 8%; }
  td.jour { text-align: left; width: 26%; }
  tr.we td { background: #cfcfcf; }
  tr.we td.sem { background: #ffe600; }
  td.off { background: #9a9a9a; }
  tfoot td { border: 0; font-size: 10px; color: #666; padding-top: 8px; text-align: left; }
</style></head>
<body>
  <h1>${esc(title)}</h1>
  <table>
    <thead><tr><th>Sem</th><th>Jour</th><th>S1J</th><th>S1N</th><th>S2J</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td colspan="5">* jour férié — cases grises : week-end / férié (pas de S2J) — mister-doc</td></tr></tfoot>
  </table>
</body></html>`;
}

/** Génère et lance l'impression (→ PDF) du mois via une iframe isolée. */
export function exportMonthPdf(opts: MonthPdfOptions): void {
  const html = buildMonthPdfHtml(opts);
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.dataset.pdfExport = '1';
  iframe.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  iframe.onload = () => {
    const w = iframe.contentWindow;
    if (!w) return;
    w.focus();
    w.print();
    const remove = () => iframe.parentNode && iframe.remove();
    w.onafterprint = remove;
    // Repli si `afterprint` n'est jamais émis.
    setTimeout(remove, 60_000);
  };
  iframe.srcdoc = html;
  document.body.appendChild(iframe);
}
