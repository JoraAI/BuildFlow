/**
 * BuildFlow — PDF Report Engine (12 report types).
 *
 * Uses PDFKit (no browser/Puppeteer dependency — lighter, faster).
 * Each report type:
 *   1. Project Progress Report (KPIs + task list)
 *   2. Daily Report PDF (log + photo refs)
 *   3. Invoice PDF (GST format)
 *   4. Cost Estimate PDF (cover + detail + summary)
 *   5. Estimate Comparison Report
 *   6. Estimate vs Actual Report
 *   7. Project P&L Statement
 *   8. GST Summary (GSTR-1 ready)
 *   9. TDS Report (Form 16A data)
 *  10. Resource Utilization Report
 *  11. BOQ vs Actual Comparison
 *  12. Material Price History Report
 *
 * All generators return a Promise<Buffer> so callers can stream to client
 * or enqueue via Bull (pdf queue) and upload to S3.
 */
import PDFDocument from 'pdfkit';
import { prisma } from '../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import {
  getProfitLoss,
  getEstimateVsActual,
  getGstReport,
  getTdsReport,
} from './financial-report.service';
import { getEstimateWithSummary } from './estimate.service';

function num(d: Decimal | number | null | undefined): number {
  if (d === null || d === undefined) return 0;
  return typeof d === 'number' ? d : Number(d);
}

// ---- Page geometry ----
const PAGE_W = 595.28; // A4 portrait points
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;

const NAVY = '#1E3A5F';
const AMBER = '#F59E0B';
const MUTED = '#64748B';
const BORDER = '#E2E8F0';
const ROW_ALT = '#F8FAFC';
const RED = '#EF4444';
const GREEN = '#10B981';

export interface PdfResult {
  buffer: Buffer;
  filename: string;
}

function newDoc(): PDFKit.PDFDocument {
  return new PDFDocument({ size: 'A4', margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } });
}

function endBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

function inr(n: number): string {
  return 'Rs ' + Math.round(n).toLocaleString('en-IN');
}

function drawHeader(doc: PDFKit.PDFDocument, title: string, company?: { name: string; gstin?: string | null }) {
  // Amber accent bar
  doc.rect(0, 0, PAGE_W, 6).fill(AMBER);
  doc.fillColor(NAVY).fontSize(18).font('Helvetica-Bold').text(company?.name ?? 'BuildFlow', MARGIN, 24);
  if (company?.gstin) {
    doc.fillColor(MUTED).fontSize(9).font('Helvetica').text(`GSTIN: ${company.gstin}`, MARGIN, 46);
  }
  doc.fillColor(NAVY).fontSize(13).font('Helvetica-Bold').text(title, MARGIN, 62);
  doc.moveTo(MARGIN, 84).lineTo(PAGE_W - MARGIN, 84).strokeColor(BORDER).lineWidth(1).stroke();
  doc.y = 96;
}

function drawFooter(doc: PDFKit.PDFDocument) {
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.fillColor(MUTED)
      .fontSize(8)
      .font('Helvetica')
      .text(
        `BuildFlow | Generated ${new Date().toLocaleString('en-IN')} | Page ${i + 1} of ${pages.count}`,
        MARGIN,
        doc.page.height - 28,
        { align: 'center', width: CONTENT_W },
      );
  }
}

function tableHeaders(doc: PDFKit.PDFDocument, headers: string[], widths: number[], y: number) {
  let x = MARGIN;
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#FFFFFF');
  doc.rect(MARGIN, y - 2, CONTENT_W, 18).fill(NAVY);
  headers.forEach((h, i) => {
    doc.fillColor('#FFFFFF').text(h, x + 4, y + 2, { width: widths[i], align: 'left' });
    x += widths[i];
  });
  doc.fillColor(NAVY);
  return y + 18;
}

function tableRow(
  doc: PDFKit.PDFDocument,
  values: string[],
  widths: number[],
  y: number,
  alt: boolean,
  color?: string,
): number {
  // page break
  if (y > doc.page.height - 80) {
    doc.addPage();
    y = MARGIN;
  }
  let x = MARGIN;
  const rowH = 16;
  if (alt) {
    doc.rect(MARGIN, y - 1, CONTENT_W, rowH).fill(ROW_ALT);
  }
  doc.font('Helvetica').fontSize(8).fillColor(color ?? '#0F172A');
  values.forEach((v, i) => {
    doc.text(v, x + 4, y + 2, { width: widths[i] - 6, align: 'left' });
    x += widths[i];
  });
  doc.moveTo(MARGIN, y + rowH - 1).lineTo(PAGE_W - MARGIN, y + rowH - 1).strokeColor(BORDER).lineWidth(0.5).stroke();
  return y + rowH;
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number): number {
  if (doc.y + needed > doc.page.height - 60) {
    doc.addPage();
    return MARGIN;
  }
  return doc.y;
}

function summaryLine(doc: PDFKit.PDFDocument, label: string, value: string, bold = false) {
  doc.y = ensureSpace(doc, 20);
  doc.font(bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(10)
    .fillColor(bold ? NAVY : '#0F172A')
    .text(label, MARGIN, doc.y, { width: CONTENT_W - 160 });
  doc.text(value, PAGE_W - MARGIN - 160, doc.y, { width: 160, align: 'right' });
  doc.moveDown(0.5);
}

function fmtDate(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : '—';
}

// ===========================================================================
// 1. PROJECT PROGRESS REPORT
// ===========================================================================
export async function reportProjectProgress(companyId: string, projectId: string): Promise<PdfResult> {
  const [project, company, tasks, counts] = await Promise.all([
    prisma.project.findFirstOrThrow({ where: { id: projectId, companyId } }),
    prisma.company.findFirstOrThrow({ where: { id: companyId }, select: { name: true, gstin: true } }),
    prisma.task.findMany({
      where: { projectId },
      orderBy: { startDate: 'asc' },
      select: { id: true, name: true, status: true, progressPct: true, startDate: true, endDate: true },
    }),
    prisma.task.groupBy({ by: ['status'], where: { projectId }, _count: true }),
  ]);

  const avgProgress = tasks.length
    ? Math.round(tasks.reduce((s, t) => s + num(t.progressPct), 0) / tasks.length)
    : 0;
  const overdue = tasks.filter(
    (t) => t.status === 'DELAYED' || (t.status !== 'COMPLETED' && t.endDate && t.endDate < new Date()),
  ).length;

  const doc = newDoc();
  drawHeader(doc, 'Project Progress Report', company ?? undefined);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(NAVY).text(project.name, MARGIN);
  doc.font('Helvetica').fillColor(MUTED).fontSize(9).text(`Code: ${project.code} | Status: ${project.status}`);
  doc.moveDown(1);

  summaryLine(doc, 'Average Progress', `${avgProgress}%`);
  summaryLine(doc, 'Total Tasks', `${tasks.length}`);
  summaryLine(doc, 'Overdue Tasks', `${overdue}`, overdue > 0);
  summaryLine(doc, 'Budget', inr(num(project.budget)));
  summaryLine(doc, 'Start Date', fmtDate(project.startDate));
  summaryLine(doc, 'End Date', fmtDate(project.endDate));
  doc.moveDown(1);

  // KPI box
  doc.y = ensureSpace(doc, 60);
  doc.rect(MARGIN, doc.y, CONTENT_W, 50).fill(ROW_ALT);
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(11).text('Status Distribution', MARGIN + 10, doc.y + 8);
  doc.font('Helvetica').fontSize(9).fillColor('#0F172A');
  let kx = MARGIN + 10;
  counts.forEach((c) => {
    doc.text(`${c.status}: ${c._count}`, kx, doc.y + 22, { width: 110 });
    kx += 110;
  });
  doc.y += 60;

  // Task table
  doc.font('Helvetica-Bold').fontSize(11).fillColor(NAVY).text('Task Schedule', MARGIN, doc.y + 4);
  doc.moveDown(0.5);
  const widths = [150, 90, 70, 70, 110];
  let y = tableHeaders(doc, ['Task', 'Start', 'End', 'Progress', 'Status'], widths, doc.y);
  tasks.forEach((t, i) => {
    const col = t.status === 'DELAYED' ? RED : t.status === 'COMPLETED' ? GREEN : undefined;
    y = tableRow(
      doc,
      [t.name, fmtDate(t.startDate), fmtDate(t.endDate), `${num(t.progressPct)}%`, t.status],
      widths,
      y,
      i % 2 === 1,
      col,
    );
  });

  drawFooter(doc);
  return { buffer: await endBuffer(doc), filename: `project-progress-${project.code}.pdf` };
}

// ===========================================================================
// 2. DAILY REPORT PDF
// ===========================================================================
export async function reportDailyReport(companyId: string, reportId: string): Promise<PdfResult> {
  const report = await prisma.dailyReport.findFirstOrThrow({
    where: { id: reportId, project: { companyId } },
    include: { project: { select: { name: true, code: true } }, materialUsages: { include: { resource: true } } },
  });
  const company = await prisma.company.findFirstOrThrow({ where: { id: companyId }, select: { name: true, gstin: true } });
  const reporter = await prisma.user.findFirstOrThrow({ where: { id: report.reportedBy }, select: { name: true } });

  const doc = newDoc();
  drawHeader(doc, 'Daily Site Report', company ?? undefined);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(NAVY).text(report.project.name, MARGIN);
  doc.font('Helvetica').fillColor(MUTED).fontSize(9).text(`Date: ${report.reportDate.toISOString().slice(0, 10)} | Reported by: ${reporter.name}`);
  doc.moveDown(1);

  summaryLine(doc, 'Weather', report.weather ?? 'N/A');
  summaryLine(doc, 'Workers Count', `${report.workersCount ?? 0}`);
  summaryLine(doc, 'Site Status', report.issues ? 'Issues Reported' : 'On Schedule');
  doc.moveDown(1);

  doc.font('Helvetica-Bold').fontSize(11).fillColor(NAVY).text('Work Done', MARGIN, doc.y);
  doc.font('Helvetica').fontSize(9).fillColor('#0F172A').text(report.workDone || '—', MARGIN, doc.y + 4, { width: CONTENT_W });
  doc.moveDown(1);

  if (report.issues) {
    doc.font('Helvetica-Bold').fillColor(RED).text('Issues', MARGIN, doc.y);
    doc.font('Helvetica').fillColor('#0F172A').text(report.issues, MARGIN, doc.y + 4, { width: CONTENT_W });
    doc.moveDown(1);
  }

  if (report.materialUsages.length > 0) {
    doc.font('Helvetica-Bold').fontSize(11).fillColor(NAVY).text('Materials Used', MARGIN, doc.y);
    doc.moveDown(0.5);
    const widths = [220, 120, 120];
    let y = tableHeaders(doc, ['Material', 'Quantity', 'Notes'], widths, doc.y);
    report.materialUsages.forEach((m, i) => {
      y = tableRow(
        doc,
        [m.resource.name, `${num(m.quantityUsed)} ${m.resource.unit ?? ''}`, m.notes ?? ''],
        widths,
        y,
        i % 2 === 1,
      );
    });
  }

  if (report.photos.length > 0) {
    doc.moveDown(1);
    doc.font('Helvetica').fillColor(MUTED).fontSize(9).text(`Photos attached: ${report.photos.length} (see app for images)`);
  }

  drawFooter(doc);
  return { buffer: await endBuffer(doc), filename: `daily-report-${report.reportDate.toISOString().slice(0, 10)}.pdf` };
}

// ===========================================================================
// 3. INVOICE PDF (GST format)
// ===========================================================================
export async function reportInvoice(companyId: string, invoiceId: string): Promise<PdfResult> {
  const invoice = await prisma.invoice.findFirstOrThrow({
    where: { id: invoiceId, companyId },
    include: { project: { select: { name: true } }, lineItems: true },
  });
  const company = await prisma.company.findFirstOrThrow({ where: { id: companyId }, select: { name: true, gstin: true, address: true } });

  const doc = newDoc();
  const title =
    invoice.invoiceType === 'RUNNING_ACCOUNT'
      ? 'RUNNING ACCOUNT BILL'
      : invoice.invoiceType === 'MILESTONE'
        ? 'MILESTONE INVOICE'
        : 'TAX INVOICE';
  drawHeader(doc, title, company ?? undefined);
  doc.fontSize(11).font('Helvetica-Bold').fillColor(NAVY).text(`Invoice #: ${invoice.invoiceNumber}`, MARGIN);
  let meta = `Date: ${invoice.invoiceDate.toISOString().slice(0, 10)} | Due: ${invoice.dueDate.toISOString().slice(0, 10)} | Project: ${invoice.project.name}`;
  if (invoice.invoiceType === 'RUNNING_ACCOUNT' && invoice.raSequence) {
    meta += ` | RA Bill #${invoice.raSequence}`;
  }
  if (invoice.milestoneLabel) meta += ` | Milestone: ${invoice.milestoneLabel}`;
  doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(meta);
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fillColor('#0F172A').text('Bill To:', MARGIN);
  doc.font('Helvetica').text(invoice.clientName, MARGIN);
  if (invoice.clientGstin) doc.text(`GSTIN: ${invoice.clientGstin}`);
  doc.moveDown(1);

  if (invoice.invoiceType === 'RUNNING_ACCOUNT') {
    const widths = [30, 150, 55, 55, 55, 55, 70];
    let y = tableHeaders(
      doc,
      ['Sr', 'Description', 'Prev Qty', 'Curr Qty', 'Cum Qty', 'Rate', 'Amount'],
      widths,
      doc.y,
    );
    invoice.lineItems.forEach((li, i) => {
      y = tableRow(
        doc,
        [
          `${i + 1}`,
          li.description,
          `${num(li.previousQty)}`,
          `${num(li.currentQty)}`,
          `${num(li.cumulativeQty)}`,
          num(li.rate).toLocaleString('en-IN'),
          num(li.certifiedAmount || li.amount).toLocaleString('en-IN'),
        ],
        widths,
        y,
        i % 2 === 1,
      );
    });
    doc.moveDown(1);
    summaryLine(doc, 'Previous Certified', inr(num(invoice.previousCertifiedTotal)));
    summaryLine(doc, 'Current Certified', inr(num(invoice.currentCertifiedTotal)));
    summaryLine(doc, 'Cumulative Certified', inr(num(invoice.cumulativeCertifiedTotal)));
    if (num(invoice.retentionPct) > 0) {
      summaryLine(doc, `Retention (${num(invoice.retentionPct)}%)`, `- ${inr(num(invoice.retentionAmount))}`);
    }
  } else {
  const widths = [40, 200, 70, 70, 90, 90];
  let y = tableHeaders(doc, ['Sr', 'Description', 'HSN', 'Qty', 'Rate (Rs)', 'Amount (Rs)'], widths, doc.y);
  invoice.lineItems.forEach((li, i) => {
    y = tableRow(
      doc,
      [
        `${i + 1}`,
        li.description,
        li.hsnSacCode ?? '',
        `${num(li.quantity)} ${li.unit ?? ''}`,
        num(li.rate).toLocaleString('en-IN'),
        num(li.amount).toLocaleString('en-IN'),
      ],
      widths,
      y,
      i % 2 === 1,
    );
  });

  doc.moveDown(1);
  }
  summaryLine(doc, 'Subtotal', inr(num(invoice.subtotal)));
  if (num(invoice.cgstAmount) > 0) summaryLine(doc, 'CGST', inr(num(invoice.cgstAmount)));
  if (num(invoice.sgstAmount) > 0) summaryLine(doc, 'SGST', inr(num(invoice.sgstAmount)));
  if (num(invoice.igstAmount) > 0) summaryLine(doc, 'IGST', inr(num(invoice.igstAmount)));
  if (num(invoice.tdsAmount) > 0) summaryLine(doc, 'TDS (-)', `- ${inr(num(invoice.tdsAmount))}`);
  doc.moveTo(MARGIN, doc.y).lineTo(PAGE_W - MARGIN, doc.y).strokeColor(NAVY).lineWidth(1.5).stroke();
  summaryLine(doc, 'NET PAYABLE', inr(num(invoice.total)), true);
  doc.moveDown(1);
  doc.font('Helvetica').fontSize(8).fillColor(MUTED).text('This is a computer-generated invoice.', MARGIN, doc.y, { align: 'center', width: CONTENT_W });

  drawFooter(doc);
  return { buffer: await endBuffer(doc), filename: `invoice-${invoice.invoiceNumber}.pdf` };
}

// ===========================================================================
// 4. COST ESTIMATE PDF (summary)
// ===========================================================================
export async function reportEstimate(companyId: string, estimateId: string): Promise<PdfResult> {
  const estimate = await getEstimateWithSummary(companyId, estimateId);
  const project = await prisma.project.findFirstOrThrow({
    where: { id: estimate.projectId, companyId },
    select: { name: true, code: true },
  });
  const company = await prisma.company.findFirstOrThrow({ where: { id: companyId }, select: { name: true, gstin: true } });
  const summary = estimate.summary;

  const doc = newDoc();
  drawHeader(doc, 'Project Cost Estimate', company ?? undefined);
  doc.fontSize(11).font('Helvetica-Bold').fillColor(NAVY).text(project.name, MARGIN);
  doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(`Ref: ${estimate.name} v${estimate.version} | Status: ${estimate.status}`);
  doc.moveDown(1);

  // Sections
  for (const sec of estimate.sections) {
    doc.y = ensureSpace(doc, 40);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(NAVY).text(sec.name, MARGIN, doc.y);
    doc.moveDown(0.3);
    const widths = [220, 70, 70, 70, 90];
    let y = tableHeaders(doc, ['Description', 'Unit', 'Qty', 'Rate', 'Amount'], widths, doc.y);
    sec.items.forEach((it, i) => {
      y = tableRow(
        doc,
        [it.description, it.unit, `${it.quantity}`, it.rate.toLocaleString('en-IN'), it.amount.toLocaleString('en-IN')],
        widths,
        y,
        i % 2 === 1,
      );
    });
    doc.moveDown(0.5);
  }

  doc.moveDown(1);
  summaryLine(doc, 'Subtotal', inr(summary.subtotal));
  summaryLine(doc, `Overhead (${summary.overheadPct}%)`, inr(summary.overheadAmount));
  summaryLine(doc, `Contingency (${summary.contingencyPct}%)`, inr(summary.contingencyAmount));
  summaryLine(doc, `Profit (${summary.profitMarginPct}%)`, inr(summary.profitMarginAmount));
  summaryLine(doc, 'GST', inr(summary.gstAmount));
  doc.moveTo(MARGIN, doc.y).lineTo(PAGE_W - MARGIN, doc.y).strokeColor(NAVY).lineWidth(1.5).stroke();
  summaryLine(doc, 'GRAND TOTAL', inr(summary.grandTotal), true);

  drawFooter(doc);
  return { buffer: await endBuffer(doc), filename: `estimate-${project.code}-v${estimate.version}.pdf` };
}

// ===========================================================================
// 5. ESTIMATE COMPARISON REPORT
// ===========================================================================
export async function reportEstimateComparison(
  companyId: string,
  estimateIdA: string,
  estimateIdB: string,
): Promise<PdfResult> {
  const [a, b, company] = await Promise.all([
    prisma.estimate.findFirstOrThrow({
      where: { id: estimateIdA, companyId },
      include: { sections: { include: { items: true } } },
    }),
    prisma.estimate.findFirstOrThrow({
      where: { id: estimateIdB, companyId },
      include: { sections: { include: { items: true } } },
    }),
    prisma.company.findFirstOrThrow({ where: { id: companyId }, select: { name: true, gstin: true } }),
  ]);

  const doc = newDoc();
  drawHeader(doc, 'Estimate Comparison Report', company ?? undefined);
  doc.fontSize(9).fillColor(MUTED).font('Helvetica').text(`Version A: ${a.name} v${a.version} (Rs ${num(a.grandTotal).toLocaleString('en-IN')})`);
  doc.text(`Version B: ${b.name} v${b.version} (Rs ${num(b.grandTotal).toLocaleString('en-IN')})`);
  doc.moveDown(1);

  const sectionTotals = (e: typeof a) =>
    Object.fromEntries(e.sections.map((s) => [s.name, s.items.reduce((sum, i) => sum + num(i.amount), 0)]));
  const ta = sectionTotals(a);
  const tb = sectionTotals(b);
  const allSections = Array.from(new Set([...Object.keys(ta), ...Object.keys(tb)]));

  const widths = [160, 110, 110, 110, 75];
  let y = tableHeaders(doc, ['Section', 'Version A', 'Version B', 'Difference', '% Change'], widths, doc.y);
  allSections.forEach((secName, i) => {
    const va = ta[secName] ?? 0;
    const vb = tb[secName] ?? 0;
    const diff = vb - va;
    const pct = va ? (diff / va) * 100 : 0;
    y = tableRow(
      doc,
      [secName, inr(va), inr(vb), `${diff >= 0 ? '+' : ''}${inr(diff)}`, `${pct.toFixed(1)}%`],
      widths,
      y,
      i % 2 === 1,
      diff > 0 ? RED : diff < 0 ? GREEN : undefined,
    );
  });
  doc.moveDown(1);
  const totalDiff = num(b.grandTotal) - num(a.grandTotal);
  const totalPct = num(a.grandTotal) ? (totalDiff / num(a.grandTotal)) * 100 : 0;
  summaryLine(doc, 'Version A Grand Total', inr(num(a.grandTotal)));
  summaryLine(doc, 'Version B Grand Total', inr(num(b.grandTotal)));
  summaryLine(doc, 'Total Difference', `${totalDiff >= 0 ? '+' : ''}${inr(totalDiff)} (${totalPct.toFixed(1)}%)`, true);

  drawFooter(doc);
  return { buffer: await endBuffer(doc), filename: `estimate-comparison-v${a.version}-v${b.version}.pdf` };
}

// ===========================================================================
// 6. ESTIMATE VS ACTUAL REPORT
// ===========================================================================
export async function reportEstimateVsActual(companyId: string, projectId: string): Promise<PdfResult> {
  const [data, company] = await Promise.all([
    getEstimateVsActual(companyId, projectId),
    prisma.company.findFirstOrThrow({ where: { id: companyId }, select: { name: true, gstin: true } }),
  ]);

  const doc = newDoc();
  drawHeader(doc, 'Estimate vs Actual Report', company ?? undefined);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(NAVY).text(data.projectName, MARGIN);
  doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(`Project Completion: ${data.completionPct}%`);
  doc.moveDown(1);

  const widths = [150, 90, 90, 90, 90];
  let y = tableHeaders(doc, ['Section', 'Estimated', 'Actual', 'Variance', 'Variance %'], widths, doc.y);
  data.sections.forEach((s, i) => {
    y = tableRow(
      doc,
      [s.section, inr(s.estimated), inr(s.actual), `${s.variance >= 0 ? '+' : ''}${inr(s.variance)}`, `${s.variancePct.toFixed(1)}%`],
      widths,
      y,
      i % 2 === 1,
      s.variance > 0 ? RED : s.variance < 0 ? GREEN : undefined,
    );
  });
  doc.moveDown(1);
  summaryLine(doc, 'Total Estimated', inr(data.totalEstimated));
  summaryLine(doc, 'Total Actual', inr(data.totalActual));
  summaryLine(doc, 'Total Variance', `${data.totalVariance >= 0 ? '+' : ''}${inr(data.totalVariance)}`, true);

  if (data.flagged.length > 0) {
    doc.moveDown(1);
    doc.font('Helvetica-Bold').fillColor(RED).text('Flagged Sections (>15% variance):', MARGIN, doc.y);
    data.flagged.forEach((f) => {
      doc.font('Helvetica').fillColor('#0F172A').text(`• ${f}`, MARGIN + 10, doc.y, { width: CONTENT_W - 10 });
    });
  }

  drawFooter(doc);
  return { buffer: await endBuffer(doc), filename: `estimate-vs-actual-${projectId}.pdf` };
}

// ===========================================================================
// 7. PROJECT P&L STATEMENT
// ===========================================================================
export async function reportProfitLoss(companyId: string, projectId: string): Promise<PdfResult> {
  const [data, company] = await Promise.all([
    getProfitLoss(companyId, projectId),
    prisma.company.findFirstOrThrow({ where: { id: companyId }, select: { name: true, gstin: true } }),
  ]);

  const doc = newDoc();
  drawHeader(doc, 'Profit & Loss Statement', company ?? undefined);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(NAVY).text(data.projectName, MARGIN);
  doc.moveDown(1);

  doc.font('Helvetica-Bold').fillColor(GREEN).text('INCOME', MARGIN, doc.y);
  data.income.forEach((r) => summaryLine(doc, r.category, inr(r.amount)));
  summaryLine(doc, 'Total Income', inr(data.totalIncome), true);
  doc.moveDown(1);

  doc.font('Helvetica-Bold').fillColor(RED).text('COSTS', MARGIN, doc.y);
  data.costs.forEach((r) => summaryLine(doc, r.category, inr(r.amount)));
  summaryLine(doc, 'Total Cost', inr(data.totalCost), true);
  doc.moveDown(1);

  doc.moveTo(MARGIN, doc.y).lineTo(PAGE_W - MARGIN, doc.y).strokeColor(NAVY).lineWidth(1.5).stroke();
  summaryLine(doc, 'NET PROFIT', inr(data.netProfit), true);
  if (data.estimateTotal > 0) {
    summaryLine(doc, 'Approved Estimate', inr(data.estimateTotal));
    summaryLine(doc, 'Estimate Variance', `${data.estimateVariance >= 0 ? '+' : ''}${inr(data.estimateVariance)}`, data.estimateVariance > 0);
  }

  drawFooter(doc);
  return { buffer: await endBuffer(doc), filename: `pnl-${projectId}.pdf` };
}

// ===========================================================================
// 8. GST SUMMARY (GSTR-1 ready)
// ===========================================================================
export async function reportGstSummary(companyId: string, from?: string, to?: string): Promise<PdfResult> {
  const [data, company] = await Promise.all([
    getGstReport(companyId, from, to),
    prisma.company.findFirstOrThrow({ where: { id: companyId }, select: { name: true, gstin: true } }),
  ]);

  const doc = newDoc();
  drawHeader(doc, 'GST Summary (GSTR-1)', company ?? undefined);
  doc.fontSize(9).fillColor(MUTED).font('Helvetica').text(`Period: ${data.fromDate} to ${data.toDate}`);
  doc.moveDown(1);

  const widths = [90, 70, 110, 90, 60, 60, 60, 65];
  let y = tableHeaders(doc, ['Inv #', 'Date', 'Client GSTIN', 'Taxable', 'CGST', 'SGST', 'IGST', 'Inv Value'], widths, doc.y);
  data.rows.forEach((r, i) => {
    y = tableRow(
      doc,
      [
        r.invoiceNumber,
        r.invoiceDate,
        r.clientGstin,
        Math.round(r.taxableValue).toLocaleString('en-IN'),
        Math.round(r.cgst).toLocaleString('en-IN'),
        Math.round(r.sgst).toLocaleString('en-IN'),
        Math.round(r.igst).toLocaleString('en-IN'),
        Math.round(r.invoiceValue).toLocaleString('en-IN'),
      ],
      widths,
      y,
      i % 2 === 1,
    );
  });
  doc.moveDown(1);
  summaryLine(doc, 'Total Taxable Value', inr(data.totalTaxableValue));
  summaryLine(doc, 'Total CGST', inr(data.totalCgst));
  summaryLine(doc, 'Total SGST', inr(data.totalSgst));
  summaryLine(doc, 'Total IGST', inr(data.totalIgst));
  summaryLine(doc, 'Total Tax', inr(data.totalTax), true);
  summaryLine(doc, 'Total Invoice Value', inr(data.totalInvoiceValue), true);

  drawFooter(doc);
  return { buffer: await endBuffer(doc), filename: `gst-summary-${data.fromDate}-${data.toDate}.pdf` };
}

// ===========================================================================
// 9. TDS REPORT (Form 16A)
// ===========================================================================
export async function reportTds(companyId: string, from?: string, to?: string): Promise<PdfResult> {
  const [data, company] = await Promise.all([
    getTdsReport(companyId, from, to),
    prisma.company.findFirstOrThrow({ where: { id: companyId }, select: { name: true, gstin: true } }),
  ]);

  const doc = newDoc();
  drawHeader(doc, 'TDS Report (Form 16A Data)', company ?? undefined);
  doc.fontSize(9).fillColor(MUTED).font('Helvetica').text(`Period: ${data.fromDate} to ${data.toDate}`);
  doc.moveDown(1);

  const widths = [80, 70, 130, 80, 60, 80, 60];
  let y = tableHeaders(doc, ['Bill #', 'Date', 'Vendor', 'Amount Paid', 'TDS %', 'TDS Amt', 'Category'], widths, doc.y);
  data.rows.forEach((r, i) => {
    y = tableRow(
      doc,
      [
        r.billNumber,
        r.billDate,
        r.vendorName,
        Math.round(r.amountPaid).toLocaleString('en-IN'),
        `${r.tdsRate.toFixed(2)}%`,
        Math.round(r.tdsAmount).toLocaleString('en-IN'),
        r.category,
      ],
      widths,
      y,
      i % 2 === 1,
    );
  });
  doc.moveDown(1);
  summaryLine(doc, 'Total Amount Paid', inr(data.totalAmountPaid));
  summaryLine(doc, 'Total TDS Deducted', inr(data.totalTdsDeducted), true);

  drawFooter(doc);
  return { buffer: await endBuffer(doc), filename: `tds-report-${data.fromDate}-${data.toDate}.pdf` };
}

// ===========================================================================
// 10. RESOURCE UTILIZATION REPORT
// ===========================================================================
export async function reportResourceUtilization(companyId: string, projectId: string): Promise<PdfResult> {
  const [company, taskResources, materialUsages] = await Promise.all([
    prisma.company.findFirstOrThrow({ where: { id: companyId }, select: { name: true, gstin: true } }),
    prisma.taskResource.findMany({
      where: { task: { projectId } },
      include: { resource: { select: { name: true, unit: true, type: true } } },
    }),
    prisma.materialUsage.findMany({
      where: { dailyReport: { projectId } },
      include: { resource: { select: { name: true, unit: true, type: true } } },
    }),
  ]);

  // Aggregate planned vs used by resource
  const map = new Map<string, { name: string; unit: string; type: string; planned: number; used: number }>();
  for (const tr of taskResources) {
    const key = tr.resourceId;
    const e = map.get(key) ?? { name: tr.resource.name, unit: tr.resource.unit ?? '', type: tr.resource.type, planned: 0, used: 0 };
    e.planned += num(tr.quantity);
    map.set(key, e);
  }
  for (const mu of materialUsages) {
    const key = mu.resourceId;
    const e = map.get(key) ?? { name: mu.resource.name, unit: mu.resource.unit ?? '', type: mu.resource.type, planned: 0, used: 0 };
    e.used += num(mu.quantityUsed);
    map.set(key, e);
  }

  const doc = newDoc();
  drawHeader(doc, 'Resource Utilization Report', company ?? undefined);
  doc.fontSize(9).fillColor(MUTED).font('Helvetica').text(`Project ID: ${projectId}`);
  doc.moveDown(1);

  const widths = [160, 70, 80, 80, 90, 60];
  let y = tableHeaders(doc, ['Resource', 'Type', 'Planned', 'Used', 'Variance', '% Used'], widths, doc.y);
  Array.from(map.values()).forEach((r, i) => {
    const variance = r.used - r.planned;
    const pct = r.planned ? (r.used / r.planned) * 100 : 0;
    y = tableRow(
      doc,
      [
        r.name,
        r.type,
        `${r.planned.toFixed(2)} ${r.unit}`,
        `${r.used.toFixed(2)} ${r.unit}`,
        `${variance >= 0 ? '+' : ''}${variance.toFixed(2)}`,
        `${pct.toFixed(0)}%`,
      ],
      widths,
      y,
      i % 2 === 1,
      variance > 0 ? RED : undefined,
    );
  });

  drawFooter(doc);
  return { buffer: await endBuffer(doc), filename: `resource-utilization-${projectId}.pdf` };
}

// ===========================================================================
// 11. BOQ vs ACTUAL COMPARISON
// ===========================================================================
export async function reportBoqVsActual(companyId: string, projectId: string): Promise<PdfResult> {
  const [company, boqItems, bills] = await Promise.all([
    prisma.company.findFirstOrThrow({ where: { id: companyId }, select: { name: true, gstin: true } }),
    prisma.bOQItem.findMany({ where: { projectId, isSuperseded: false }, orderBy: { category: 'asc' } }),
    prisma.bill.findMany({
      where: { projectId, status: { in: ['APPROVED', 'PAID'] } },
      select: { subtotal: true, category: true },
    }),
  ]);

  const actualByCat = new Map<string, number>();
  for (const b of bills) {
    const cat = b.category ?? 'OTHER';
    actualByCat.set(cat, (actualByCat.get(cat) ?? 0) + num(b.subtotal));
  }

  const doc = newDoc();
  drawHeader(doc, 'BOQ vs Actual Comparison', company ?? undefined);
  doc.fontSize(9).fillColor(MUTED).font('Helvetica').text(`Project ID: ${projectId}`);
  doc.moveDown(1);

  const widths = [140, 90, 80, 80, 80, 60];
  let y = tableHeaders(doc, ['Category', 'BOQ Amount', 'Actual Spend', 'Variance', 'Var %', 'Status'], widths, doc.y);
  const boqByCat = new Map<string, number>();
  for (const item of boqItems) {
    const cat = item.category ?? 'OTHER';
    boqByCat.set(cat, (boqByCat.get(cat) ?? 0) + num(item.amount));
  }
  Array.from(boqByCat.entries()).forEach(([cat, boqAmt], i) => {
    const actual = actualByCat.get(cat) ?? 0;
    const variance = actual - boqAmt;
    const pct = boqAmt ? (variance / boqAmt) * 100 : 0;
    y = tableRow(
      doc,
      [cat, inr(boqAmt), inr(actual), `${variance >= 0 ? '+' : ''}${inr(variance)}`, `${pct.toFixed(1)}%`, variance > 0 ? 'OVER' : 'OK'],
      widths,
      y,
      i % 2 === 1,
      variance > 0 ? RED : GREEN,
    );
  });

  drawFooter(doc);
  return { buffer: await endBuffer(doc), filename: `boq-vs-actual-${projectId}.pdf` };
}

// ===========================================================================
// 12. MATERIAL PRICE HISTORY REPORT
// ===========================================================================
export async function reportMaterialPriceHistory(companyId: string): Promise<PdfResult> {
  const [company, resources] = await Promise.all([
    prisma.company.findFirstOrThrow({ where: { id: companyId }, select: { name: true, gstin: true } }),
    prisma.resource.findMany({
      where: { companyId, type: 'MATERIAL', isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, unit: true, rate: true, lastRateUpdatedAt: true },
    }),
  ]);

  const histories = await Promise.all(
    resources.map((r) =>
      prisma.materialPriceHistory.findMany({
        where: { resourceId: r.id, companyId },
        orderBy: { effectiveDate: 'desc' },
        take: 5,
        select: { rate: true, effectiveDate: true, notes: true },
      }),
    ),
  );

  const doc = newDoc();
  drawHeader(doc, 'Material Price History Report', company ?? undefined);
  doc.moveDown(1);

  resources.forEach((r, idx) => {
    doc.y = ensureSpace(doc, 80);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(NAVY).text(`${r.name} (${r.unit ?? ''})`, MARGIN, doc.y);
    doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(`Current: Rs ${num(r.rate)}/${r.unit ?? ''} | Last updated: ${r.lastRateUpdatedAt?.toISOString().slice(0, 10) ?? 'N/A'}`);
    const history = histories[idx] ?? [];
    if (history.length > 0) {
      const widths = [120, 100, 200];
      let y = tableHeaders(doc, ['Date', 'Rate (Rs)', 'Notes'], widths, doc.y + 2);
      history.forEach((h, i) => {
        y = tableRow(doc, [h.effectiveDate.toISOString().slice(0, 10), num(h.rate).toLocaleString('en-IN'), h.notes ?? ''], widths, y, i % 2 === 1);
      });
    }
    doc.moveDown(1);
  });

  drawFooter(doc);
  return { buffer: await endBuffer(doc), filename: 'material-price-history.pdf' };
}

// ===========================================================================
// 13. MEASUREMENT BOOK (RA certified quantities per BOQ line)
// ===========================================================================
export async function reportMeasurementBook(companyId: string, projectId: string): Promise<PdfResult> {
  const [project, company, boqItems, raInvoices] = await Promise.all([
    prisma.project.findFirstOrThrow({
      where: { id: projectId, companyId },
      select: { name: true, code: true },
    }),
    prisma.company.findFirstOrThrow({ where: { id: companyId }, select: { name: true, gstin: true } }),
    prisma.bOQItem.findMany({ where: { projectId }, orderBy: { itemCode: 'asc' } }),
    prisma.invoice.findMany({
      where: { projectId, companyId, invoiceType: 'RUNNING_ACCOUNT', status: { not: 'DRAFT' } },
      include: { lineItems: true },
      orderBy: { raSequence: 'asc' },
    }),
  ]);

  const certified = new Map<string, { previous: number; current: number; cumulative: number }>();
  for (const inv of raInvoices) {
    for (const li of inv.lineItems) {
      if (!li.boqItemId) continue;
      const prev = certified.get(li.boqItemId);
      certified.set(li.boqItemId, {
        previous: prev?.cumulative ?? 0,
        current: num(li.currentQty),
        cumulative: num(li.cumulativeQty),
      });
    }
  }

  const doc = newDoc();
  drawHeader(doc, 'Measurement Book', company ?? undefined);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(NAVY).text(project.name, MARGIN);
  doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(`Project Code: ${project.code}`);
  doc.moveDown(1);

  const widths = [50, 140, 50, 55, 55, 55, 55, 70];
  let y = tableHeaders(
    doc,
    ['Code', 'Description', 'Unit', 'Sanctioned', 'Previous', 'Current', 'Cumulative', 'Rate'],
    widths,
    doc.y,
  );
  boqItems.forEach((item, i) => {
    const cert = certified.get(item.id);
    y = tableRow(
      doc,
      [
        item.itemCode,
        item.description,
        item.unit,
        `${num(item.quantity)}`,
        `${cert?.previous ?? 0}`,
        `${cert?.current ?? 0}`,
        `${cert?.cumulative ?? 0}`,
        num(item.rate).toLocaleString('en-IN'),
      ],
      widths,
      y,
      i % 2 === 1,
    );
  });

  drawFooter(doc);
  return { buffer: await endBuffer(doc), filename: `measurement-book-${project.code}.pdf` };
}

// ===========================================================================
// 14. ABSTRACT SHEET (section-wise BOQ abstract)
// ===========================================================================
export async function reportAbstractSheet(companyId: string, projectId: string): Promise<PdfResult> {
  const [project, company, boqItems] = await Promise.all([
    prisma.project.findFirstOrThrow({
      where: { id: projectId, companyId },
      select: { name: true, code: true },
    }),
    prisma.company.findFirstOrThrow({ where: { id: companyId }, select: { name: true, gstin: true } }),
    prisma.bOQItem.findMany({ where: { projectId }, orderBy: [{ category: 'asc' }, { itemCode: 'asc' }] }),
  ]);

  const sections = new Map<string, typeof boqItems>();
  for (const item of boqItems) {
    const cat = item.category ?? 'GENERAL';
    const list = sections.get(cat) ?? [];
    list.push(item);
    sections.set(cat, list);
  }

  const doc = newDoc();
  drawHeader(doc, 'Abstract Sheet', company ?? undefined);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(NAVY).text(project.name, MARGIN);
  doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(`Project Code: ${project.code}`);
  doc.moveDown(1);

  let grandTotal = 0;
  for (const [section, items] of sections) {
    doc.y = ensureSpace(doc, 60);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(NAVY).text(section, MARGIN, doc.y);
    doc.moveDown(0.3);
    const widths = [50, 180, 45, 55, 65, 80];
    let y = tableHeaders(doc, ['Code', 'Description', 'Unit', 'Qty', 'Rate', 'Amount'], widths, doc.y);
    let sectionTotal = 0;
    items.forEach((item, i) => {
      const amt = num(item.amount);
      sectionTotal += amt;
      y = tableRow(
        doc,
        [
          item.itemCode,
          item.description,
          item.unit,
          `${num(item.quantity)}`,
          num(item.rate).toLocaleString('en-IN'),
          amt.toLocaleString('en-IN'),
        ],
        widths,
        y,
        i % 2 === 1,
      );
    });
    grandTotal += sectionTotal;
    summaryLine(doc, `${section} Subtotal`, inr(sectionTotal));
    doc.moveDown(0.5);
  }

  doc.moveTo(MARGIN, doc.y).lineTo(PAGE_W - MARGIN, doc.y).strokeColor(NAVY).lineWidth(1.5).stroke();
  summaryLine(doc, 'GRAND TOTAL', inr(grandTotal), true);
  drawFooter(doc);
  return { buffer: await endBuffer(doc), filename: `abstract-sheet-${project.code}.pdf` };
}