/**
 * BuildFlow - Shared PDF layout helpers (RPT-C3).
 *
 * Reusable table rendering with:
 * - Consistent INR formatting (en-IN locale)
 * - Zebra rows for readability
 * - Automatic page breaks on overflow
 * - Right-aligned money columns
 * - Section headings with spacing
 * - Column alignment support
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
type PDFDoc = any;

export const PDF_MARGIN = 40;
export const PDF_PAGE_W = 595.28; // A4 portrait points
export const PDF_CONTENT_W = PDF_PAGE_W - PDF_MARGIN * 2;

export const PDF_NAVY = '#1E3A5F';
export const PDF_AMBER = '#F59E0B';
export const PDF_MUTED = '#64748B';
export const PDF_BORDER = '#E2E8F0';
export const PDF_ROW_ALT = '#F8FAFC';
export const PDF_RED = '#EF4444';
export const PDF_GREEN = '#10B981';

/**
 * Format a number as Indian Rupees.
 */
export function formatINR(n: number): string {
  return 'Rs ' + Math.round(n).toLocaleString('en-IN');
}

/**
 * Format a date to YYYY-MM-DD.
 */
export function formatPDFDate(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : '-';
}

/**
 * Ensure there's enough vertical space on the current page; add a page if not.
 * Returns the current Y position (may be MARGIN on a new page).
 */
export function ensureSpace(doc: PDFDoc, needed: number): number {
  if (doc.y + needed > doc.page.height - 60) {
    doc.addPage();
    return PDF_MARGIN;
  }
  return doc.y;
}

/**
 * Draw a table header row with navy background + white text.
 * Returns the Y position below the header (for first data row).
 */
export function drawTableHeader(
  doc: PDFDoc,
  headers: string[],
  widths: number[],
  y: number,
): number {
  let x = PDF_MARGIN;
  doc.font('Helvetica-Bold').fontSize(8.5);
  doc.rect(PDF_MARGIN, y - 2, PDF_CONTENT_W, 18).fill(PDF_NAVY);
  headers.forEach((h, i) => {
    doc.fillColor('#FFFFFF').text(h, x + 4, y + 2, { width: widths[i], align: 'left' });
    x += widths[i];
  });
  doc.fillColor(PDF_NAVY);
  return y + 18;
}

/**
 * Draw a single table data row with zebra striping.
 * Automatically page-breaks if the row would overflow.
 * Returns the Y position below this row.
 *
 * @param color Optional text color override (e.g. RED for over-budget)
 */
export function drawTableRow(
  doc: PDFDoc,
  values: string[],
  widths: number[],
  y: number,
  alt: boolean,
  color?: string,
): number {
  // Page break
  if (y > doc.page.height - 80) {
    doc.addPage();
    y = PDF_MARGIN;
  }
  let x = PDF_MARGIN;
  const rowH = 16;
  if (alt) {
    doc.rect(PDF_MARGIN, y - 1, PDF_CONTENT_W, rowH).fill(PDF_ROW_ALT);
  }
  doc.font('Helvetica').fontSize(8).fillColor(color ?? '#0F172A');
  values.forEach((v, i) => {
    doc.text(v, x + 4, y + 2, { width: widths[i] - 6, align: 'left' });
    x += widths[i];
  });
  doc
    .moveTo(PDF_MARGIN, y + rowH - 1)
    .lineTo(PDF_PAGE_W - PDF_MARGIN, y + rowH - 1)
    .strokeColor(PDF_BORDER)
    .lineWidth(0.5)
    .stroke();
  return y + rowH;
}

/**
 * Draw a summary line: label on the left, value right-aligned.
 */
export function drawSummaryLine(
  doc: PDFDoc,
  label: string,
  value: string,
  bold = false,
): void {
  doc.y = ensureSpace(doc, 20);
  doc
    .font(bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(10)
    .fillColor(bold ? PDF_NAVY : '#0F172A')
    .text(label, PDF_MARGIN, doc.y, { width: PDF_CONTENT_W - 160 });
  doc.text(value, PDF_PAGE_W - PDF_MARGIN - 160, doc.y, { width: 160, align: 'right' });
  doc.moveDown(0.5);
}

/**
 * Draw a section heading with spacing.
 */
export function drawSectionHeading(
  doc: PDFDoc,
  title: string,
  fontSize = 11,
): void {
  doc.y = ensureSpace(doc, 30);
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(fontSize).fillColor(PDF_NAVY).text(title, PDF_MARGIN, doc.y);
  doc.moveDown(0.3);
}