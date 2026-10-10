/**
 * BuildFlow - PDF Report Engine (12 report types).
 *
 * Uses PDFKit (no browser/Puppeteer dependency - lighter, faster).
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
import {
  amountInWordsINR,
  drawInventoryDocHeader,
  drawMetaGrid,
  drawBillShipTo,
  drawGridTable,
  drawTotalsAndWords,
  drawPayToAndSignature,
  drawDeclarationFooter,
  money as invMoney,
} from './inventory-pdf-layout';
import { Decimal } from '@prisma/client/runtime/library';
// RPT-C3a: Import shared layout helpers from pdf-layout.ts
export {
  formatINR,
  formatPDFDate,
  ensureSpace,
  drawTableHeader,
  drawTableRow,
  drawSummaryLine,
  drawSectionHeading,
  PDF_MARGIN,
  PDF_PAGE_W,
  PDF_CONTENT_W,
  PDF_NAVY,
  PDF_AMBER,
  PDF_MUTED,
  PDF_BORDER,
  PDF_ROW_ALT,
  PDF_RED,
  PDF_GREEN,
} from './pdf-layout';
import {
  getProfitLoss,
  getEstimateVsActual,
  getGstReport,
  getTdsReport,
} from './financial-report.service';
import { RATE_VARIANCE_ALERT_PCT } from '@buildflow/shared';
import { getEstimateWithSummary } from './estimate.service';
import { listMaterialRateVariance } from './material-rate-variance.service';
import { getProject } from './project.service';
import { resolveLogoDisplayUrl } from './settings.service';

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
  // bufferPages is required so footers/watermarks can switchToPage after content is written.
  return new PDFDocument({
    size: 'A4',
    bufferPages: true,
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
  });
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

/**
 * RPT-C1: Branded header with optional company logo.
 * Renders logo image top-right if available; falls back to company name text.
 * Accent bar color adapts to company reportSettings (default amber).
 */
// RPT-C1d: drawHeader now accepts accentColor + showLogo from reportSettings
function drawHeader(
  doc: PDFKit.PDFDocument,
  title: string,
  company?: { name: string; gstin?: string | null; logoUrl?: string | null; logoBuffer?: Buffer | null; address?: string | null },
  opts?: { accentColor?: string; showLogo?: boolean },
) {
  const accentColor = opts?.accentColor ?? AMBER;
  const showLogo = opts?.showLogo !== false; // default true

  // RPT-C1d: Use accentColor from reportSettings (default amber)
  doc.rect(0, 0, PAGE_W, 6).fill(accentColor);

  // RPT-C1: Try to render company logo top-right (skip if showLogo === false)
  let logoRendered = false;
  if (showLogo && company?.logoBuffer) {
    try {
      doc.image(company.logoBuffer, PAGE_W - MARGIN - 70, 16, { fit: [70, 42], align: 'right' });
      logoRendered = true;
    } catch {
      logoRendered = false;
    }
  }

  // Company Name on the left
  doc.fillColor(NAVY).fontSize(16).font('Helvetica-Bold').text(company?.name ?? 'BuildFlow', MARGIN, 20, { width: logoRendered ? CONTENT_W - 80 : CONTENT_W });

  // Company GSTIN + address under name
  let nextY = 38;
  if (company?.gstin) {
    doc.fillColor(MUTED).fontSize(8.5).font('Helvetica').text(`GSTIN: ${company.gstin}`, MARGIN, nextY);
    nextY += 12;
  }
  if (company?.address) {
    doc.fillColor(MUTED).fontSize(8).font('Helvetica').text(company.address, MARGIN, nextY, { width: logoRendered ? CONTENT_W - 80 : 350 });
    nextY += 12;
  }

  const titleY = Math.max(nextY + 2, 64);
  doc.fillColor(NAVY).fontSize(13).font('Helvetica-Bold').text(title, MARGIN, titleY);
  const lineY = titleY + 18;
  doc.moveTo(MARGIN, lineY).lineTo(PAGE_W - MARGIN, lineY).strokeColor(BORDER).lineWidth(1).stroke();
  doc.y = lineY + 10;
}

/**
 * RPT-C1: Branded footer with company legal info + page numbers.
 * Optional custom footerText from reportSettings prepended when set.
 */
function drawFooter(
  doc: PDFKit.PDFDocument,
  company?: { name: string; address?: string | null; gstin?: string | null },
  opts?: { footerText?: string },
) {
  const pages = doc.bufferedPageRange();
  const footerCompany = company?.name ?? 'BuildFlow';
  const footerGstin = company?.gstin ? ` · GSTIN: ${company.gstin}` : '';
  const customPrefix = opts?.footerText?.trim();
  const leftIdentity = customPrefix
    ? `${customPrefix} | ${footerCompany}${footerGstin}`
    : `${footerCompany}${footerGstin}`;

  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(pages.start + i);
    // Zero the bottom margin check so PDFKit never triggers an extra blank page
    const origBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    const footerY = doc.page.height - 24;

    // Divider rule above footer
    doc
      .moveTo(MARGIN, footerY - 5)
      .lineTo(PAGE_W - MARGIN, footerY - 5)
      .strokeColor(BORDER)
      .lineWidth(0.5)
      .stroke();

    // Left side: Company / Custom Footer
    doc
      .fillColor(MUTED)
      .fontSize(7.5)
      .font('Helvetica')
      .text(leftIdentity, MARGIN, footerY, {
        width: CONTENT_W - 150,
        align: 'left',
        lineBreak: false,
      });

    // Right side: Page X of Y · Generated Date
    const rightText = `Page ${i + 1} of ${pages.count} · ${new Date().toLocaleDateString('en-IN')}`;
    doc
      .fillColor(MUTED)
      .fontSize(7.5)
      .font('Helvetica')
      .text(rightText, PAGE_W - MARGIN - 150, footerY, {
        width: 150,
        align: 'right',
        lineBreak: false,
      });

    doc.page.margins.bottom = origBottomMargin;
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
  return d ? d.toISOString().slice(0, 10) : '-';
}

/**
 * RPT-C1b: Load company for PDF with resolved logo URL + report settings.
 * Centralizes the company query + logo resolution for all PDF generators.
 */
export interface PdfCompany {
  name: string;
  gstin?: string | null;
  pan?: string | null;
  address?: string | null;
  state?: string | null;
  logoUrl?: string | null;
  logoBuffer?: Buffer | null;
  reportSettings: Record<string, unknown>;
  accentColor: string;
  subscriptionPlan?: string | null;
}

/**
 * RPT-C1: Safely load image bytes as Buffer for PDFKit.
 * Supports:
 *   - Base64 data URLs (`data:image/png;base64,...`)
 *   - HTTP / HTTPS URLs (fetched with timeout)
 *   - Local filesystem paths
 */
export async function fetchLogoBuffer(urlOrPath: string | null | undefined): Promise<Buffer | null> {
  if (!urlOrPath) return null;

  // 1. Data URLs
  if (urlOrPath.startsWith('data:')) {
    const commaIndex = urlOrPath.indexOf(',');
    if (commaIndex !== -1) {
      try {
        return Buffer.from(urlOrPath.slice(commaIndex + 1), 'base64');
      } catch {
        return null;
      }
    }
  }

  // 2. HTTP / HTTPS URLs
  if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(urlOrPath, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        return Buffer.from(arrayBuf);
      }
    } catch {
      // Network fetch failed or timed out
    }
  }

  // 3. Local filesystem path fallback
  try {
    const fs = await import('fs');
    if (fs.existsSync(urlOrPath)) {
      return fs.readFileSync(urlOrPath);
    }
  } catch {
    // Filesystem read failed
  }

  return null;
}

export async function loadCompanyForPdf(companyId: string): Promise<PdfCompany> {
  const company = await prisma.company.findFirstOrThrow({
    where: { id: companyId },
    select: {
      name: true,
      gstin: true,
      pan: true,
      address: true,
      state: true,
      logoUrl: true,
      reportSettings: true,
      subscriptionPlan: true,
    },
  });
  const logoDisplayUrl = await resolveLogoDisplayUrl(companyId, company.logoUrl);
  const settings = (company.reportSettings as Record<string, unknown> | null) ?? {};
  const accentColor = (settings.accentColor as string) ?? AMBER;

  let logoBuffer: Buffer | null = null;
  if (logoDisplayUrl) {
    logoBuffer = await fetchLogoBuffer(logoDisplayUrl);
  } else if (company.logoUrl && (company.logoUrl.startsWith('data:') || company.logoUrl.startsWith('http'))) {
    logoBuffer = await fetchLogoBuffer(company.logoUrl);
  }

  return {
    name: company.name,
    gstin: company.gstin,
    pan: company.pan,
    address: company.address,
    state: company.state,
    logoUrl: logoDisplayUrl,
    logoBuffer,
    reportSettings: settings,
    accentColor,
    subscriptionPlan: company.subscriptionPlan,
  };
}

function inventoryCompanyFromPdf(company: PdfCompany) {
  const s = company.reportSettings;
  const str = (k: string) => {
    const v = s[k];
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  };
  return {
    name: company.name,
    gstin: company.gstin,
    pan: company.pan,
    address: company.address,
    state: company.state,
    logoBuffer: company.logoBuffer,
    phone: str('companyPhone'),
    email: str('companyEmail'),
    fssaiLicenceNo: str('fssaiLicenceNo'),
    bankAccountNo: str('bankAccountNo'),
    bankBeneficiaryName: str('bankBeneficiaryName'),
    bankName: str('bankName'),
    bankBranch: str('bankBranch'),
    bankIfsc: str('bankIfsc'),
  };
}

function headerOptsFromCompany(company?: PdfCompany | null) {
  if (!company) return undefined;
  return {
    accentColor: company.accentColor,
    showLogo: company.reportSettings.showLogo as boolean | undefined,
  };
}

function footerOptsFromCompany(company?: PdfCompany | null) {
  const footerText = company?.reportSettings?.footerText;
  if (typeof footerText !== 'string' || !footerText.trim()) return undefined;
  return { footerText: footerText.trim() };
}

/** RPT-WM1: Centered logo watermark on every page when showWatermark is true. */
function drawBrandedWatermark(doc: PDFKit.PDFDocument, company?: PdfCompany | null) {
  if (company?.reportSettings?.showWatermark !== true) return;
  const logoBuffer = company?.logoBuffer;
  if (!logoBuffer) return;

  const pages = doc.bufferedPageRange();
  const wmSize = 300; // Increased size for bold watermark
  const pageH = doc.page.height;

  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(pages.start + i);
    const origBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    const x = (PAGE_W - wmSize) / 2;
    const y = (pageH - wmSize) / 2;
    try {
      doc.save();
      doc.opacity(0.14); // Increased opacity for distinct, professional appearance
      doc.image(logoBuffer, x, y, { fit: [wmSize, wmSize], align: 'center', valign: 'center' });
      doc.restore();
    } catch {
      doc.restore();
      // Logo watermark render failed - skip watermark for this page
    }

    doc.page.margins.bottom = origBottomMargin;
  }
}

function drawBrandedHeader(doc: PDFKit.PDFDocument, title: string, company?: PdfCompany | null) {
  drawHeader(doc, title, company ?? undefined, headerOptsFromCompany(company));
}

function drawBrandedFooter(doc: PDFKit.PDFDocument, company?: PdfCompany | null) {
  drawBrandedWatermark(doc, company);
  drawFooter(doc, company ?? undefined, footerOptsFromCompany(company));
}

// ===========================================================================
// 1. PROJECT PROGRESS REPORT
// ===========================================================================
export async function reportProjectProgress(companyId: string, projectId: string): Promise<PdfResult> {
  const [project, company, tasks, counts] = await Promise.all([
    prisma.project.findFirstOrThrow({ where: { id: projectId, companyId } }),
    loadCompanyForPdf(companyId),
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
  drawBrandedHeader(doc, 'Project Progress Report', company);
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

  drawBrandedFooter(doc, company);
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
  const company = await loadCompanyForPdf(companyId);
  const reporter = await prisma.user.findFirstOrThrow({ where: { id: report.reportedBy }, select: { name: true } });

  // Load petty cash expenses logged on that day for this project
  const expenses = await prisma.pettyCashEntry.findMany({
    where: {
      companyId,
      projectId: report.projectId,
      expenseDate: report.reportDate,
    },
    select: { description: true, amount: true, category: true, paidTo: true, status: true },
    orderBy: { createdAt: 'asc' },
  });
  const totalExpense = expenses.reduce((sum, e) => sum + num(e.amount), 0);

  const doc = newDoc();
  drawBrandedHeader(doc, 'Daily Site Report', company);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(NAVY).text(report.project.name, MARGIN);
  doc.font('Helvetica').fillColor(MUTED).fontSize(9).text(`Date: ${report.reportDate.toISOString().slice(0, 10)} | Reported by: ${reporter.name}`);
  doc.moveDown(1);

  summaryLine(doc, 'Weather', report.weather ?? 'N/A');
  summaryLine(doc, 'Workers Count', `${report.workersCount ?? 0}`);
  summaryLine(doc, 'Site Status', report.issues ? 'Issues Reported' : 'On Schedule');
  if (expenses.length > 0) {
    summaryLine(doc, 'Site Expenses (Petty Cash)', inr(totalExpense));
  }
  doc.moveDown(1);

  doc.font('Helvetica-Bold').fontSize(11).fillColor(NAVY).text('Work Done', MARGIN, doc.y);
  doc.font('Helvetica').fontSize(9).fillColor('#0F172A').text(report.workDone || '-', MARGIN, doc.y + 4, { width: CONTENT_W });
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

  if (expenses.length > 0) {
    doc.moveDown(1);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(NAVY).text('Site Expenses & Petty Cash Logged', MARGIN, doc.y);
    doc.moveDown(0.5);
    const widths = [180, 90, 100, 90];
    let y = tableHeaders(doc, ['Expense Description', 'Category', 'Paid To', 'Amount'], widths, doc.y);
    expenses.forEach((e, i) => {
      y = tableRow(
        doc,
        [e.description, e.category, e.paidTo, inr(num(e.amount))],
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

  drawBrandedFooter(doc, company);
  return { buffer: await endBuffer(doc), filename: `daily-report-${report.reportDate.toISOString().slice(0, 10)}.pdf` };
}

// ===========================================================================
// 3. INVOICE PDF (GST format)
// ===========================================================================
export async function reportInvoice(companyId: string, invoiceId: string): Promise<PdfResult> {
  const invoice = await prisma.invoice.findFirstOrThrow({
    where: { id: invoiceId, companyId },
    include: {
      project: { select: { name: true, code: true } },
      lineItems: true,
      customer: {
        select: {
          name: true,
          businessName: true,
          gstin: true,
          pan: true,
          billingAddress: true,
          shippingAddress: true,
          phone: true,
          paymentTerms: true,
        },
      },
      salesOrder: { select: { soNumber: true, orderDate: true } },
    },
  });
  const company = await loadCompanyForPdf(companyId);

  // Inventory Management System: bordered Tax Invoice template.
  if (company.subscriptionPlan === 'INVENTORY' && invoice.invoiceType === 'STANDARD') {
    return reportInventoryTaxInvoice(company, invoice);
  }

  const doc = newDoc();
  const title =
    invoice.invoiceType === 'RUNNING_ACCOUNT'
      ? 'RUNNING ACCOUNT BILL'
      : invoice.invoiceType === 'MILESTONE'
        ? 'MILESTONE INVOICE'
        : 'TAX INVOICE';
  drawBrandedHeader(doc, title, company);
  doc.fontSize(11).font('Helvetica-Bold').fillColor(NAVY).text(`Invoice #: ${invoice.invoiceNumber}`, MARGIN);
  const projectLabel =
    invoice.project.code === 'STORE' ? company?.name ?? 'Store' : invoice.project.name;
  let meta = `Date: ${invoice.invoiceDate.toISOString().slice(0, 10)} | Due: ${invoice.dueDate.toISOString().slice(0, 10)} | ${projectLabel}`;
  if (invoice.invoiceType === 'RUNNING_ACCOUNT' && invoice.raSequence) {
    meta += ` | RA Bill #${invoice.raSequence}`;
  }
  if (invoice.milestoneLabel) meta += ` | Milestone: ${invoice.milestoneLabel}`;
  doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(meta);
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fillColor('#0F172A').text('Bill To:', MARGIN);
  doc.font('Helvetica').text(invoice.clientName, MARGIN);
  if (invoice.clientGstin) doc.text(`GSTIN: ${invoice.clientGstin}`);
  if (invoice.clientAddress) doc.text(invoice.clientAddress);
  if (invoice.clientPhone) doc.text(`Phone: ${invoice.clientPhone}`);
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
    const useIgst = num(invoice.igstAmount) > 0 && num(invoice.cgstAmount) <= 0;
    const moneyFmt = (n: number) =>
      n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const widths = useIgst
      ? [22, 120, 52, 36, 32, 48, 32, 52, 58]
      : [20, 100, 48, 32, 30, 42, 28, 42, 28, 42, 52];
    const headers = useIgst
      ? ['Sr', 'Item & Description', 'HSN/SAC', 'Qty', 'Units', 'Rate', 'IGST%', 'IGST Amt', 'Amount']
      : ['Sr', 'Item & Description', 'HSN/SAC', 'Qty', 'Units', 'Rate', 'CGST%', 'CGST Amt', 'SGST%', 'SGST Amt', 'Amount'];
    let y = tableHeaders(doc, headers, widths, doc.y);
    invoice.lineItems.forEach((li, i) => {
      const taxable = num(li.amount);
      const gstRate = num(li.gstRate);
      const half = gstRate / 2;
      const cgstAmt = useIgst ? 0 : (taxable * half) / 100;
      const sgstAmt = useIgst ? 0 : (taxable * half) / 100;
      const igstAmt = useIgst ? (taxable * gstRate) / 100 : 0;
      const values = useIgst
        ? [
            `${i + 1}`,
            li.description,
            li.hsnSacCode ?? '',
            moneyFmt(num(li.quantity)),
            li.unit ?? '',
            moneyFmt(num(li.rate)),
            gstRate ? String(gstRate) : '',
            moneyFmt(igstAmt),
            moneyFmt(taxable),
          ]
        : [
            `${i + 1}`,
            li.description,
            li.hsnSacCode ?? '',
            moneyFmt(num(li.quantity)),
            li.unit ?? '',
            moneyFmt(num(li.rate)),
            gstRate ? String(half) : '',
            moneyFmt(cgstAmt),
            gstRate ? String(half) : '',
            moneyFmt(sgstAmt),
            moneyFmt(taxable),
          ];
      y = tableRow(doc, values, widths, y, i % 2 === 1);
    });
    doc.moveDown(1);
  }
  summaryLine(doc, 'Subtotal', inr(num(invoice.subtotal)));
  if (num(invoice.discountAmount) > 0) {
    const pct = num(invoice.discountPct);
    summaryLine(
      doc,
      pct > 0 ? `Discount (${pct}%)` : 'Discount',
      `- ${inr(num(invoice.discountAmount))}`,
    );
  }
  if (num(invoice.cgstAmount) > 0) summaryLine(doc, 'CGST', inr(num(invoice.cgstAmount)));
  if (num(invoice.sgstAmount) > 0) summaryLine(doc, 'SGST', inr(num(invoice.sgstAmount)));
  if (num(invoice.igstAmount) > 0) summaryLine(doc, 'IGST', inr(num(invoice.igstAmount)));
  if (num(invoice.tdsAmount) > 0) summaryLine(doc, 'TDS (-)', `- ${inr(num(invoice.tdsAmount))}`);
  doc.moveTo(MARGIN, doc.y).lineTo(PAGE_W - MARGIN, doc.y).strokeColor(NAVY).lineWidth(1.5).stroke();
  summaryLine(doc, 'NET PAYABLE', inr(num(invoice.total)), true);
  doc.moveDown(1);
  doc.font('Helvetica').fontSize(8).fillColor(MUTED).text('This is a computer-generated invoice.', MARGIN, doc.y, { align: 'center', width: CONTENT_W });

  drawBrandedFooter(doc, company);
  return { buffer: await endBuffer(doc), filename: `invoice-${invoice.invoiceNumber}.pdf` };
}

async function reportInventoryTaxInvoice(
  company: PdfCompany,
  // Prisma Decimal fields + includes — keep loose for PDF formatting helpers.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  invoice: any,
): Promise<PdfResult> {
  const invCompany = inventoryCompanyFromPdf(company);
  const doc = newDoc();
  let y = drawInventoryDocHeader(doc, 'TAX INVOICE', invCompany);

  const leftMeta = [
    { label: 'Invoice No', value: invoice.invoiceNumber },
    { label: 'Invoice Date', value: invoice.invoiceDate.toISOString().slice(0, 10) },
    { label: 'Terms', value: invoice.customer?.paymentTerms },
  ];
  const rightMeta = [
    { label: 'Place Of Supply', value: invoice.clientState || company.state },
    {
      label: 'Purchase Order No',
      value: invoice.salesOrder?.soNumber,
    },
    {
      label: 'Purchase Order Date',
      value: invoice.salesOrder?.orderDate
        ? invoice.salesOrder.orderDate.toISOString().slice(0, 10)
        : null,
    },
    { label: 'FSSAI Licence No', value: invCompany.fssaiLicenceNo },
  ];
  y = drawMetaGrid(doc, y, leftMeta, rightMeta);

  const billName = invoice.customer?.businessName || invoice.customer?.name || invoice.clientName;
  const billTo = {
    name: billName,
    address: invoice.customer?.billingAddress || invoice.clientAddress,
    gstin: invoice.customer?.gstin || invoice.clientGstin,
    pan: invoice.customer?.pan ?? null,
    phone: invoice.customer?.phone || invoice.clientPhone,
  };
  const shipTo = {
    name: billName,
    address: invoice.customer?.shippingAddress || invoice.customer?.billingAddress || invoice.clientAddress,
    gstin: invoice.customer?.gstin || invoice.clientGstin,
    pan: invoice.customer?.pan ?? null,
    phone: invoice.customer?.phone || invoice.clientPhone,
  };
  y = drawBillShipTo(doc, y, billTo, shipTo);

  const useIgst = num(invoice.igstAmount) > 0 && num(invoice.cgstAmount) <= 0;
  const cols = useIgst
    ? [
        { title: 'SR No', width: 28, align: 'center' as const },
        { title: 'Item & Description', width: 150 },
        { title: 'HSN/SAC', width: 48, align: 'center' as const },
        { title: 'Qty', width: 36, align: 'right' as const },
        { title: 'Units', width: 34, align: 'center' as const },
        { title: 'Rate', width: 48, align: 'right' as const },
        { title: 'IGST %', width: 36, align: 'right' as const },
        { title: 'IGST Amt', width: 52, align: 'right' as const },
        { title: 'Amount', width: 60, align: 'right' as const },
      ]
    : [
        { title: 'SR No', width: 24, align: 'center' as const },
        { title: 'Item & Description', width: 120 },
        { title: 'HSN/SAC', width: 42, align: 'center' as const },
        { title: 'Qty', width: 32, align: 'right' as const },
        { title: 'Units', width: 30, align: 'center' as const },
        { title: 'Rate', width: 42, align: 'right' as const },
        { title: 'CGST %', width: 32, align: 'right' as const },
        { title: 'CGST Amt', width: 42, align: 'right' as const },
        { title: 'SGST %', width: 32, align: 'right' as const },
        { title: 'SGST Amt', width: 42, align: 'right' as const },
        { title: 'Amount', width: 50, align: 'right' as const },
      ];

  const rows = invoice.lineItems.map((li: any, i: number) => {
    const taxable = num(li.amount);
    const gstRate = num(li.gstRate);
    const half = gstRate / 2;
    const cgstAmt = useIgst ? 0 : (taxable * half) / 100;
    const sgstAmt = useIgst ? 0 : (taxable * half) / 100;
    const igstAmt = useIgst ? (taxable * gstRate) / 100 : 0;
    if (useIgst) {
      return [
        `${i + 1}`,
        li.description,
        li.hsnSacCode ?? '',
        invMoney(num(li.quantity)),
        li.unit ?? '',
        invMoney(num(li.rate)),
        gstRate ? String(gstRate) : '',
        invMoney(igstAmt),
        invMoney(taxable),
      ];
    }
    return [
      `${i + 1}`,
      li.description,
      li.hsnSacCode ?? '',
      invMoney(num(li.quantity)),
      li.unit ?? '',
      invMoney(num(li.rate)),
      gstRate ? String(half) : '',
      invMoney(cgstAmt),
      gstRate ? String(half) : '',
      invMoney(sgstAmt),
      invMoney(taxable),
    ];
  });
  y = drawGridTable(doc, y, cols, rows);

  const totalLines: Array<{ label: string; value: string; bold?: boolean }> = [
    { label: 'Sub Total', value: `₹ ${invMoney(num(invoice.subtotal))}` },
  ];
  if (num(invoice.discountAmount) > 0) {
    const pct = num(invoice.discountPct);
    totalLines.push({
      label: pct > 0 ? `Discount (${pct}%)` : 'Discount',
      value: `- ₹ ${invMoney(num(invoice.discountAmount))}`,
    });
  }
  if (num(invoice.cgstAmount) > 0) totalLines.push({ label: 'CGST', value: `₹ ${invMoney(num(invoice.cgstAmount))}` });
  if (num(invoice.sgstAmount) > 0) totalLines.push({ label: 'SGST', value: `₹ ${invMoney(num(invoice.sgstAmount))}` });
  if (num(invoice.igstAmount) > 0) totalLines.push({ label: 'IGST', value: `₹ ${invMoney(num(invoice.igstAmount))}` });
  if (num(invoice.tdsAmount) > 0) totalLines.push({ label: 'TDS (-)', value: `- ₹ ${invMoney(num(invoice.tdsAmount))}` });
  totalLines.push({ label: 'Total', value: `₹ ${invMoney(num(invoice.total))}`, bold: true });

  y = drawTotalsAndWords(doc, y, {
    amountWords: amountInWordsINR(num(invoice.total)),
    lines: totalLines,
  });
  y = drawPayToAndSignature(doc, y, invCompany);
  drawDeclarationFooter(doc, y, invCompany);

  return { buffer: await endBuffer(doc), filename: `invoice-${invoice.invoiceNumber}.pdf` };
}

// ===========================================================================
// 3b. INVENTORY DOCUMENT PDFs (INVENTORY_HORIZONTAL_PLATFORM Phase 9.3)
//     Sales Order / Delivery Challan / Goods Receipt - same PDF pipeline.
// ===========================================================================

export async function reportSalesOrder(companyId: string, salesOrderId: string): Promise<PdfResult> {
  const so = await prisma.salesOrder.findFirstOrThrow({
    where: { id: salesOrderId, companyId },
    include: {
      lines: true,
      customer: {
        select: {
          name: true,
          businessName: true,
          gstin: true,
          pan: true,
          billingAddress: true,
          shippingAddress: true,
          phone: true,
          paymentTerms: true,
        },
      },
    },
  });
  const company = await loadCompanyForPdf(companyId);

  if (company.subscriptionPlan === 'INVENTORY') {
    const invCompany = inventoryCompanyFromPdf(company);
    const doc = newDoc();
    let y = drawInventoryDocHeader(doc, 'SALES ORDER', invCompany);
    y = drawMetaGrid(
      doc,
      y,
      [
        { label: 'SO No', value: so.soNumber },
        { label: 'Order Date', value: so.orderDate.toISOString().slice(0, 10) },
        { label: 'Terms', value: so.customer?.paymentTerms },
      ],
      [{ label: 'Status', value: so.status }],
    );
    const partyName = so.customer?.businessName || so.customer?.name || so.customerName;
    y = drawBillShipTo(
      doc,
      y,
      {
        name: partyName,
        address: so.customer?.billingAddress,
        gstin: so.customer?.gstin,
        pan: so.customer?.pan,
        phone: so.customer?.phone,
      },
      {
        name: partyName,
        address: so.customer?.shippingAddress || so.customer?.billingAddress,
        gstin: so.customer?.gstin,
        pan: so.customer?.pan,
        phone: so.customer?.phone,
      },
    );
    const cols = [
      { title: 'SR No', width: 36, align: 'center' as const },
      { title: 'Item & Description', width: 220 },
      { title: 'Qty', width: 50, align: 'right' as const },
      { title: 'Units', width: 44, align: 'center' as const },
      { title: 'Rate', width: 70, align: 'right' as const },
      { title: 'Amount', width: 72, align: 'right' as const },
    ];
    const rows = so.lines.map((li, i) => [
      `${i + 1}`,
      li.itemName,
      invMoney(num(li.quantity)),
      li.unit,
      invMoney(num(li.rate)),
      invMoney(num(li.amount)),
    ]);
    y = drawGridTable(doc, y, cols, rows);
    const totalLines: Array<{ label: string; value: string; bold?: boolean }> = [
      { label: 'Sub Total', value: `₹ ${invMoney(num(so.subtotal))}` },
    ];
    if (num(so.gstAmount) > 0) totalLines.push({ label: 'GST', value: `₹ ${invMoney(num(so.gstAmount))}` });
    totalLines.push({ label: 'Total', value: `₹ ${invMoney(num(so.total))}`, bold: true });
    y = drawTotalsAndWords(doc, y, { amountWords: amountInWordsINR(num(so.total)), lines: totalLines });
    y = drawPayToAndSignature(doc, y, invCompany);
    drawDeclarationFooter(doc, y, invCompany);
    return { buffer: await endBuffer(doc), filename: `sales-order-${so.soNumber}.pdf` };
  }

  const doc = newDoc();
  drawBrandedHeader(doc, 'SALES ORDER', company);
  doc.fontSize(11).font('Helvetica-Bold').fillColor(NAVY).text(`Sales Order #: ${so.soNumber}`, MARGIN);
  const meta = `Date: ${so.orderDate.toISOString().slice(0, 10)} | Customer: ${so.customer?.name ?? so.customerName}`;
  doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(meta);
  doc.moveDown(0.5);
  if (so.customer?.gstin) {
    doc.font('Helvetica-Bold').fillColor('#0F172A').text('Bill To:', MARGIN);
    doc.font('Helvetica').text(so.customer.name, MARGIN);
    doc.text(`GSTIN: ${so.customer.gstin}`);
    doc.moveDown(1);
  }

  const widths = [40, 200, 70, 70, 90, 90];
  let y = tableHeaders(doc, ['Sr', 'Description', 'HSN', 'Qty', 'Rate (Rs)', 'Amount (Rs)'], widths, doc.y);
  so.lines.forEach((li, i) => {
    y = tableRow(
      doc,
      [
        `${i + 1}`,
        li.itemName,
        '',
        `${num(li.quantity)} ${li.unit}`,
        num(li.rate).toLocaleString('en-IN'),
        num(li.amount).toLocaleString('en-IN'),
      ],
      widths,
      y,
      i % 2 === 1,
    );
  });
  doc.moveDown(1);
  summaryLine(doc, 'Subtotal', inr(num(so.subtotal)));
  summaryLine(doc, 'GST', inr(num(so.gstAmount)));
  doc.moveTo(MARGIN, doc.y).lineTo(PAGE_W - MARGIN, doc.y).strokeColor(NAVY).lineWidth(1.5).stroke();
  summaryLine(doc, 'TOTAL', inr(num(so.total)), true);
  drawBrandedFooter(doc, company);
  return { buffer: await endBuffer(doc), filename: `sales-order-${so.soNumber}.pdf` };
}

export async function reportQuote(companyId: string, quoteId: string): Promise<PdfResult> {
  const quote = await prisma.quote.findFirstOrThrow({
    where: { id: quoteId, companyId },
    include: {
      lines: true,
      customer: {
        select: {
          name: true,
          businessName: true,
          gstin: true,
          pan: true,
          billingAddress: true,
          shippingAddress: true,
          phone: true,
          paymentTerms: true,
        },
      },
    },
  });
  const company = await loadCompanyForPdf(companyId);

  if (company.subscriptionPlan === 'INVENTORY') {
    const invCompany = inventoryCompanyFromPdf(company);
    const doc = newDoc();
    let y = drawInventoryDocHeader(doc, 'QUOTATION', invCompany);
    y = drawMetaGrid(
      doc,
      y,
      [
        { label: 'Quote No', value: quote.quoteNumber },
        { label: 'Quote Date', value: quote.quoteDate.toISOString().slice(0, 10) },
        {
          label: 'Valid Until',
          value: quote.validUntil ? quote.validUntil.toISOString().slice(0, 10) : null,
        },
        { label: 'Terms', value: quote.customer?.paymentTerms },
      ],
      [{ label: 'Reference', value: quote.notes }],
    );
    const partyName = quote.customer?.businessName || quote.customer?.name || quote.customerName;
    y = drawBillShipTo(
      doc,
      y,
      {
        name: partyName,
        address: quote.customer?.billingAddress,
        gstin: quote.customer?.gstin,
        pan: quote.customer?.pan,
        phone: quote.customer?.phone,
      },
      {
        name: partyName,
        address: quote.customer?.shippingAddress || quote.customer?.billingAddress,
        gstin: quote.customer?.gstin,
        pan: quote.customer?.pan,
        phone: quote.customer?.phone,
      },
    );
    const cols = [
      { title: 'SR No', width: 36, align: 'center' as const },
      { title: 'Item & Description', width: 220 },
      { title: 'Qty', width: 50, align: 'right' as const },
      { title: 'Units', width: 44, align: 'center' as const },
      { title: 'Rate', width: 70, align: 'right' as const },
      { title: 'Amount', width: 72, align: 'right' as const },
    ];
    const rows = quote.lines.map((li, i) => [
      `${i + 1}`,
      li.itemName,
      invMoney(num(li.quantity)),
      li.unit,
      invMoney(num(li.rate)),
      invMoney(num(li.amount)),
    ]);
    y = drawGridTable(doc, y, cols, rows);
    const totalLines: Array<{ label: string; value: string; bold?: boolean }> = [
      { label: 'Sub Total', value: `₹ ${invMoney(num(quote.subtotal))}` },
    ];
    if (num(quote.gstAmount) > 0) totalLines.push({ label: 'GST', value: `₹ ${invMoney(num(quote.gstAmount))}` });
    totalLines.push({ label: 'Total', value: `₹ ${invMoney(num(quote.total))}`, bold: true });
    y = drawTotalsAndWords(doc, y, { amountWords: amountInWordsINR(num(quote.total)), lines: totalLines });
    y = drawPayToAndSignature(doc, y, invCompany);
    drawDeclarationFooter(doc, y, invCompany);
    return { buffer: await endBuffer(doc), filename: `quote-${quote.quoteNumber}.pdf` };
  }

  const doc = newDoc();
  drawBrandedHeader(doc, 'EVENT & CLIENT ESTIMATE / QUOTATION', company);
  doc.fontSize(11).font('Helvetica-Bold').fillColor(NAVY).text(`Quote #: ${quote.quoteNumber}`, MARGIN);
  const meta = `Date: ${quote.quoteDate.toISOString().slice(0, 10)}${quote.validUntil ? ` | Valid Until: ${quote.validUntil.toISOString().slice(0, 10)}` : ''} | Customer: ${quote.customer?.name ?? quote.customerName}`;
  doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(meta);
  if (quote.notes) {
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica-Oblique').fillColor('#334155').text(`Event / Reference: ${quote.notes}`);
  }
  doc.moveDown(0.5);
  if (quote.customer?.gstin) {
    doc.font('Helvetica-Bold').fillColor('#0F172A').text('Quoted To:', MARGIN);
    doc.font('Helvetica').text(quote.customer.name, MARGIN);
    doc.text(`GSTIN: ${quote.customer.gstin}`);
    doc.moveDown(1);
  }

  const widths = [40, 200, 70, 70, 90, 90];
  let y = tableHeaders(doc, ['Sr', 'Item Description', 'Unit', 'Qty', 'Rate (Rs)', 'Amount (Rs)'], widths, doc.y);
  quote.lines.forEach((li, i) => {
    y = tableRow(
      doc,
      [
        `${i + 1}`,
        li.itemName,
        li.unit,
        `${num(li.quantity)}`,
        num(li.rate).toLocaleString('en-IN'),
        num(li.amount).toLocaleString('en-IN'),
      ],
      widths,
      y,
      i % 2 === 1,
    );
  });
  doc.moveDown(1);
  summaryLine(doc, 'Subtotal', inr(num(quote.subtotal)));
  summaryLine(doc, 'GST', inr(num(quote.gstAmount)));
  doc.moveTo(MARGIN, doc.y).lineTo(PAGE_W - MARGIN, doc.y).strokeColor(NAVY).lineWidth(1.5).stroke();
  summaryLine(doc, 'ESTIMATED TOTAL', inr(num(quote.total)), true);
  drawBrandedFooter(doc, company);
  return { buffer: await endBuffer(doc), filename: `quote-${quote.quoteNumber}.pdf` };
}

export async function reportDeliveryChallan(companyId: string, dcId: string): Promise<PdfResult> {
  const dc = await prisma.deliveryChallan.findFirstOrThrow({
    where: { id: dcId, companyId },
    include: {
      lines: true,
      customer: {
        select: {
          name: true,
          businessName: true,
          gstin: true,
          pan: true,
          billingAddress: true,
          shippingAddress: true,
          phone: true,
        },
      },
    },
  });
  const company = await loadCompanyForPdf(companyId);

  if (company.subscriptionPlan === 'INVENTORY') {
    const invCompany = inventoryCompanyFromPdf(company);
    const doc = newDoc();
    let y = drawInventoryDocHeader(doc, 'DELIVERY CHALLAN', invCompany);
    y = drawMetaGrid(
      doc,
      y,
      [
        { label: 'Challan No', value: dc.dcNumber },
        { label: 'Date', value: dc.createdAt.toISOString().slice(0, 10) },
      ],
      [{ label: 'Status', value: dc.status }],
    );
    const partyName = dc.customer?.businessName || dc.customer?.name || dc.customerName;
    y = drawBillShipTo(
      doc,
      y,
      {
        name: partyName,
        address: dc.customer?.billingAddress,
        gstin: dc.customer?.gstin,
        pan: dc.customer?.pan,
        phone: dc.customer?.phone,
      },
      {
        name: partyName,
        address: dc.customer?.shippingAddress || dc.customer?.billingAddress,
        gstin: dc.customer?.gstin,
        pan: dc.customer?.pan,
        phone: dc.customer?.phone,
      },
    );
    const cols = [
      { title: 'SR No', width: 40, align: 'center' as const },
      { title: 'Item & Description', width: 250 },
      { title: 'Qty', width: 60, align: 'right' as const },
      { title: 'Units', width: 50, align: 'center' as const },
      { title: 'Rate', width: 92, align: 'right' as const },
    ];
    const rows = dc.lines.map((li, i) => [
      `${i + 1}`,
      li.batchCode ? `${li.itemName} (${li.batchCode})` : li.itemName,
      invMoney(num(li.quantity)),
      li.unit,
      invMoney(num(li.rate)),
    ]);
    y = drawGridTable(doc, y, cols, rows);
    y = drawPayToAndSignature(doc, y + 4, invCompany);
    drawDeclarationFooter(doc, y, invCompany);
    return { buffer: await endBuffer(doc), filename: `delivery-challan-${dc.dcNumber}.pdf` };
  }

  const doc = newDoc();
  drawBrandedHeader(doc, 'DELIVERY CHALLAN', company);
  doc.fontSize(11).font('Helvetica-Bold').fillColor(NAVY).text(`Challan #: ${dc.dcNumber}`, MARGIN);
  const meta = `Status: ${dc.status} | Date: ${dc.createdAt.toISOString().slice(0, 10)} | Customer: ${dc.customer?.name ?? dc.customerName}`;
  doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(meta);
  doc.moveDown(1);

  const widths = [40, 200, 70, 70, 90];
  let y = tableHeaders(doc, ['Sr', 'Description', 'Qty', 'Unit', 'Rate (Rs)'], widths, doc.y);
  dc.lines.forEach((li, i) => {
    y = tableRow(
      doc,
      [`${i + 1}`, li.itemName, `${num(li.quantity)}`, li.unit, num(li.rate).toLocaleString('en-IN')],
      widths,
      y,
      i % 2 === 1,
    );
  });
  doc.moveDown(1);
  doc.font('Helvetica').fontSize(8).fillColor(MUTED).text('This is a computer-generated delivery challan.', MARGIN, doc.y, { align: 'center', width: CONTENT_W });
  drawBrandedFooter(doc, company);
  return { buffer: await endBuffer(doc), filename: `delivery-challan-${dc.dcNumber}.pdf` };
}

export async function reportGoodsReceipt(companyId: string, grnId: string): Promise<PdfResult> {
  const grn = await prisma.goodsReceiptNote.findFirstOrThrow({
    where: { id: grnId, companyId },
    include: { lines: { include: { resource: { select: { name: true, hsnSacCode: true } } } }, purchaseOrder: { select: { poNumber: true, vendorName: true } } },
  });
  const company = await loadCompanyForPdf(companyId);

  if (company.subscriptionPlan === 'INVENTORY') {
    const invCompany = inventoryCompanyFromPdf(company);
    const doc = newDoc();
    let y = drawInventoryDocHeader(doc, 'GOODS RECEIPT NOTE', invCompany);
    y = drawMetaGrid(
      doc,
      y,
      [
        { label: 'GRN No', value: grn.grnNumber },
        { label: 'Received', value: grn.receivedDate.toISOString().slice(0, 10) },
      ],
      [
        { label: 'PO No', value: grn.purchaseOrder.poNumber },
        { label: 'Vendor', value: grn.purchaseOrder.vendorName },
      ],
    );
    y = drawBillShipTo(doc, y, { name: grn.purchaseOrder.vendorName }, null);
    const cols = [
      { title: 'SR No', width: 36, align: 'center' as const },
      { title: 'Item & Description', width: 200 },
      { title: 'HSN/SAC', width: 70, align: 'center' as const },
      { title: 'Qty', width: 70, align: 'right' as const },
      { title: 'Unit Cost', width: 116, align: 'right' as const },
    ];
    const rows = grn.lines.map((li, i) => [
      `${i + 1}`,
      li.batchCode ? `${li.resource.name} (${li.batchCode})` : li.resource.name,
      li.resource.hsnSacCode ?? '',
      `${invMoney(num(li.quantity))} ${li.unit}`,
      invMoney(num(li.unitCost)),
    ]);
    y = drawGridTable(doc, y, cols, rows);
    y = drawPayToAndSignature(doc, y + 4, invCompany);
    drawDeclarationFooter(doc, y, invCompany);
    return { buffer: await endBuffer(doc), filename: `grn-${grn.grnNumber}.pdf` };
  }

  const doc = newDoc();
  drawBrandedHeader(doc, 'GOODS RECEIPT NOTE', company);
  doc.fontSize(11).font('Helvetica-Bold').fillColor(NAVY).text(`GRN #: ${grn.grnNumber}`, MARGIN);
  const meta = `Received: ${grn.receivedDate.toISOString().slice(0, 10)} | PO: ${grn.purchaseOrder.poNumber} | Vendor: ${grn.purchaseOrder.vendorName}`;
  doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(meta);
  doc.moveDown(1);

  const widths = [40, 200, 90, 70, 90];
  let y = tableHeaders(doc, ['Sr', 'Item', 'HSN', 'Qty', 'Unit Cost (Rs)'], widths, doc.y);
  grn.lines.forEach((li, i) => {
    y = tableRow(
      doc,
      [
        `${i + 1}`,
        li.resource.name,
        li.resource.hsnSacCode ?? '',
        `${num(li.quantity)} ${li.unit}${li.batchCode ? ` (${li.batchCode})` : ''}`,
        num(li.unitCost).toLocaleString('en-IN'),
      ],
      widths,
      y,
      i % 2 === 1,
    );
  });
  doc.moveDown(1);
  doc.font('Helvetica').fontSize(8).fillColor(MUTED).text('This is a computer-generated goods receipt note.', MARGIN, doc.y, { align: 'center', width: CONTENT_W });
  drawBrandedFooter(doc, company);
  return { buffer: await endBuffer(doc), filename: `grn-${grn.grnNumber}.pdf` };
}

// ===========================================================================
// 3c. VENDOR BILL PDF (AP)
// ===========================================================================
export async function reportBill(companyId: string, billId: string): Promise<PdfResult> {
  const bill = await prisma.bill.findFirstOrThrow({
    where: { id: billId, companyId },
    include: {
      project: { select: { name: true, code: true } },
      vendor: { select: { name: true, gstin: true, billingAddress: true, phone: true } },
      purchaseOrder: { select: { poNumber: true } },
      goodsReceipt: { select: { grnNumber: true } },
    },
  });
  const company = await loadCompanyForPdf(companyId);

  if (company.subscriptionPlan === 'INVENTORY') {
    const invCompany = inventoryCompanyFromPdf(company);
    const doc = newDoc();
    let y = drawInventoryDocHeader(doc, 'VENDOR BILL', invCompany);
    y = drawMetaGrid(
      doc,
      y,
      [
        { label: 'Bill No', value: bill.billNumber },
        { label: 'Bill Date', value: bill.billDate.toISOString().slice(0, 10) },
        {
          label: 'Due Date',
          value: bill.dueDate ? bill.dueDate.toISOString().slice(0, 10) : null,
        },
      ],
      [
        { label: 'Status', value: bill.status },
        { label: 'PO No', value: bill.purchaseOrder?.poNumber },
        { label: 'GRN No', value: bill.goodsReceipt?.grnNumber },
        { label: 'Category', value: bill.category },
      ],
    );
    y = drawBillShipTo(
      doc,
      y,
      {
        name: bill.vendorName,
        address: bill.vendor?.billingAddress,
        gstin: bill.vendorGstin ?? bill.vendor?.gstin,
        phone: bill.vendor?.phone,
      },
      null,
    );
    const totalLines: Array<{ label: string; value: string; bold?: boolean }> = [
      { label: 'Sub Total', value: `₹ ${invMoney(num(bill.subtotal))}` },
    ];
    if (num(bill.gstAmount) > 0) totalLines.push({ label: 'GST', value: `₹ ${invMoney(num(bill.gstAmount))}` });
    if (num(bill.retentionAmount) > 0) {
      totalLines.push({ label: 'Retention (-)', value: `- ₹ ${invMoney(num(bill.retentionAmount))}` });
    }
    if (num(bill.advanceRecoveryAmount) > 0) {
      totalLines.push({
        label: 'Advance (-)',
        value: `- ₹ ${invMoney(num(bill.advanceRecoveryAmount))}`,
      });
    }
    if (num(bill.tdsAmount) > 0) totalLines.push({ label: 'TDS (-)', value: `- ₹ ${invMoney(num(bill.tdsAmount))}` });
    totalLines.push({ label: 'Net Payable', value: `₹ ${invMoney(num(bill.total))}`, bold: true });
    if (num(bill.paidAmount) > 0) {
      totalLines.push({ label: 'Paid', value: `₹ ${invMoney(num(bill.paidAmount))}` });
      totalLines.push({
        label: 'Balance Due',
        value: `₹ ${invMoney(Math.max(0, num(bill.total) - num(bill.paidAmount)))}`,
        bold: true,
      });
    }
    y = drawTotalsAndWords(doc, y, { amountWords: amountInWordsINR(num(bill.total)), lines: totalLines });
    y = drawPayToAndSignature(doc, y, invCompany);
    drawDeclarationFooter(doc, y, invCompany);
    return { buffer: await endBuffer(doc), filename: `bill-${bill.billNumber}.pdf` };
  }

  const doc = newDoc();
  drawBrandedHeader(doc, 'VENDOR BILL', company);
  doc.fontSize(11).font('Helvetica-Bold').fillColor(NAVY).text(`Bill #: ${bill.billNumber}`, MARGIN);
  const projectLabel = bill.project.code === 'STORE' ? company?.name ?? 'Store' : bill.project.name;
  const due = bill.dueDate ? bill.dueDate.toISOString().slice(0, 10) : '—';
  let meta = `Date: ${bill.billDate.toISOString().slice(0, 10)} | Due: ${due} | ${projectLabel} | Status: ${bill.status}`;
  if (bill.purchaseOrder?.poNumber) meta += ` | PO: ${bill.purchaseOrder.poNumber}`;
  if (bill.goodsReceipt?.grnNumber) meta += ` | GRN: ${bill.goodsReceipt.grnNumber}`;
  doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(meta);
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fillColor('#0F172A').text('Vendor:', MARGIN);
  doc.font('Helvetica').text(bill.vendorName, MARGIN);
  const vendorGstin = bill.vendorGstin ?? bill.vendor?.gstin;
  if (vendorGstin) doc.text(`GSTIN: ${vendorGstin}`);
  if (bill.vendor?.billingAddress) doc.text(bill.vendor.billingAddress);
  if (bill.vendor?.phone) doc.text(`Phone: ${bill.vendor.phone}`);
  doc.moveDown(1);

  summaryLine(doc, 'Category', bill.category);
  summaryLine(doc, 'Subtotal', inr(num(bill.subtotal)));
  if (num(bill.gstAmount) > 0) summaryLine(doc, 'GST', inr(num(bill.gstAmount)));
  if (num(bill.retentionAmount) > 0) summaryLine(doc, 'Retention (-)', `- ${inr(num(bill.retentionAmount))}`);
  if (num(bill.advanceRecoveryAmount) > 0) {
    summaryLine(doc, 'Advance recovery (-)', `- ${inr(num(bill.advanceRecoveryAmount))}`);
  }
  if (num(bill.tdsAmount) > 0) summaryLine(doc, 'TDS (-)', `- ${inr(num(bill.tdsAmount))}`);
  doc.moveTo(MARGIN, doc.y).lineTo(PAGE_W - MARGIN, doc.y).strokeColor(NAVY).lineWidth(1.5).stroke();
  summaryLine(doc, 'NET PAYABLE', inr(num(bill.total)), true);
  if (num(bill.paidAmount) > 0) {
    summaryLine(doc, 'Paid', inr(num(bill.paidAmount)));
    summaryLine(doc, 'Balance due', inr(Math.max(0, num(bill.total) - num(bill.paidAmount))), true);
  }
  doc.moveDown(1);
  doc.font('Helvetica').fontSize(8).fillColor(MUTED).text('This is a computer-generated vendor bill.', MARGIN, doc.y, {
    align: 'center',
    width: CONTENT_W,
  });

  drawBrandedFooter(doc, company);
  return { buffer: await endBuffer(doc), filename: `bill-${bill.billNumber}.pdf` };
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
  const company = await loadCompanyForPdf(companyId);
  const summary = estimate.summary;

  const doc = newDoc();
  drawBrandedHeader(doc, 'Project Cost Estimate', company);
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
      // FIX (EST-M8): Show rate analysis name in the description when linked.
      const desc = it.rateAnalysisName
        ? `${it.description} [RA: ${it.rateAnalysisName}]`
        : it.description;
      y = tableRow(
        doc,
        [desc, it.unit, `${it.quantity}`, it.rate.toLocaleString('en-IN'), it.amount.toLocaleString('en-IN')],
        widths,
        y,
        i % 2 === 1,
      );
    });
    doc.moveDown(0.5);
  }

  // FIX (EST-M8): Append linked rate analyses with their component breakdowns
  // so the exported estimate includes the full composition of composite items.
  const linkedRAIds = estimate.sections
    .flatMap((s) => s.items)
    .filter((it) => it.rateAnalysisId)
    .map((it) => it.rateAnalysisId as string);
  if (linkedRAIds.length > 0) {
    const rateAnalyses = await prisma.rateAnalysis.findMany({
      where: { id: { in: linkedRAIds }, companyId },
      include: {
        components: {
          include: { resource: { select: { name: true, unit: true } } },
        },
      },
    });
    doc.addPage();
    doc.font('Helvetica-Bold').fontSize(12).fillColor(NAVY).text('Rate Analysis Annexure', MARGIN, MARGIN + 60);
    doc.moveDown(1);
    for (const ra of rateAnalyses) {
      doc.y = ensureSpace(doc, 60);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(NAVY).text(`${ra.name} (Total: ${inr(Number(ra.totalRate))})`, MARGIN, doc.y);
      doc.moveDown(0.2);
      const raWidths = [220, 70, 70, 70, 90];
      let raY = tableHeaders(doc, ['Component', 'Unit', 'Qty/Unit', 'Rate', 'Amount'], raWidths, doc.y);
      ra.components.forEach((c, i) => {
        const name = c.resource?.name ?? c.miscName ?? 'Misc';
        raY = tableRow(
          doc,
          [name, c.unit, String(Number(c.quantityPerUnit)), Number(c.rate).toLocaleString('en-IN'), Number(c.amount).toLocaleString('en-IN')],
          raWidths,
          raY,
          i % 2 === 1,
        );
      });
      doc.moveDown(0.5);
    }
  }

  doc.moveDown(1);
  summaryLine(doc, 'Subtotal', inr(summary.subtotal));
  summaryLine(doc, `Overhead (${summary.overheadPct}%)`, inr(summary.overheadAmount));
  summaryLine(doc, `Contingency (${summary.contingencyPct}%)`, inr(summary.contingencyAmount));
  summaryLine(doc, `Profit (${summary.profitMarginPct}%)`, inr(summary.profitMarginAmount));
  summaryLine(doc, 'GST', inr(summary.gstAmount));
  doc.moveTo(MARGIN, doc.y).lineTo(PAGE_W - MARGIN, doc.y).strokeColor(NAVY).lineWidth(1.5).stroke();
  summaryLine(doc, 'GRAND TOTAL', inr(summary.grandTotal), true);

  drawBrandedFooter(doc, company);
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
    loadCompanyForPdf(companyId),
  ]);

  const doc = newDoc();
  drawBrandedHeader(doc, 'Estimate Comparison Report', company);
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

  drawBrandedFooter(doc, company);
  return { buffer: await endBuffer(doc), filename: `estimate-comparison-v${a.version}-v${b.version}.pdf` };
}

// ===========================================================================
// 6. ESTIMATE VS ACTUAL REPORT
// ===========================================================================
export async function reportEstimateVsActual(companyId: string, projectId: string): Promise<PdfResult> {
  const [data, company] = await Promise.all([
    getEstimateVsActual(companyId, projectId),
    loadCompanyForPdf(companyId),
  ]);

  const doc = newDoc();
  drawBrandedHeader(doc, 'Estimate vs Actual Report', company);
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

  drawBrandedFooter(doc, company);
  return { buffer: await endBuffer(doc), filename: `estimate-vs-actual-${projectId}.pdf` };
}

// ===========================================================================
// 7. PROJECT P&L STATEMENT
// ===========================================================================
export async function reportProfitLoss(companyId: string, projectId: string): Promise<PdfResult> {
  const [data, company] = await Promise.all([
    getProfitLoss(companyId, projectId),
    loadCompanyForPdf(companyId),
  ]);

  const doc = newDoc();
  drawBrandedHeader(doc, 'Profit & Loss Statement', company);
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

  drawBrandedFooter(doc, company);
  return { buffer: await endBuffer(doc), filename: `pnl-${projectId}.pdf` };
}

// ===========================================================================
// 8. GST SUMMARY (GSTR-1 ready)
// ===========================================================================
export async function reportGstSummary(companyId: string, from?: string, to?: string): Promise<PdfResult> {
  const [data, company] = await Promise.all([
    getGstReport(companyId, from, to),
    loadCompanyForPdf(companyId),
  ]);

  const doc = newDoc();
  drawBrandedHeader(doc, 'GST Summary (GSTR-1)', company);
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

  drawBrandedFooter(doc, company);
  return { buffer: await endBuffer(doc), filename: `gst-summary-${data.fromDate}-${data.toDate}.pdf` };
}

// ===========================================================================
// 9. TDS REPORT (Form 16A)
// ===========================================================================
export async function reportTds(companyId: string, from?: string, to?: string): Promise<PdfResult> {
  const [data, company] = await Promise.all([
    getTdsReport(companyId, from, to),
    loadCompanyForPdf(companyId),
  ]);

  const doc = newDoc();
  drawBrandedHeader(doc, 'TDS Report (Form 16A Data)', company);
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

  drawBrandedFooter(doc, company);
  return { buffer: await endBuffer(doc), filename: `tds-report-${data.fromDate}-${data.toDate}.pdf` };
}

// ===========================================================================
// 10. RESOURCE UTILIZATION REPORT
// ===========================================================================
export async function reportResourceUtilization(companyId: string, projectId: string): Promise<PdfResult> {
  const [company, taskResources, materialUsages] = await Promise.all([
    loadCompanyForPdf(companyId),
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
  drawBrandedHeader(doc, 'Resource Utilization Report', company);
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

  drawBrandedFooter(doc, company);
  return { buffer: await endBuffer(doc), filename: `resource-utilization-${projectId}.pdf` };
}

// ===========================================================================
// 11. BOQ vs ACTUAL COMPARISON
// ===========================================================================
export async function reportBoqVsActual(companyId: string, projectId: string): Promise<PdfResult> {
  const [company, boqItems, bills] = await Promise.all([
    loadCompanyForPdf(companyId),
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
  drawBrandedHeader(doc, 'BOQ vs Actual Comparison', company);
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

  drawBrandedFooter(doc, company);
  return { buffer: await endBuffer(doc), filename: `boq-vs-actual-${projectId}.pdf` };
}

// ===========================================================================
// 12. MATERIAL PRICE HISTORY REPORT
// ===========================================================================
export async function reportMaterialPriceHistory(companyId: string): Promise<PdfResult> {
  const [company, resources] = await Promise.all([
    loadCompanyForPdf(companyId),
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
  drawBrandedHeader(doc, 'Material Price History Report', company);
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

  drawBrandedFooter(doc, company);
  return { buffer: await endBuffer(doc), filename: 'material-price-history.pdf' };
}

// ===========================================================================
// 15. PROJECT MATERIAL RATE SHEET
// ===========================================================================
const PLANNED_SOURCE_LABEL: Record<string, string> = {
  PROJECT: 'Project',
  BOQ: 'BOQ',
  ESTIMATE: 'Estimate',
  REGION: 'Regional',
  CATALOG: 'Catalog',
};

export async function reportProjectMaterialRates(
  companyId: string,
  projectId: string,
): Promise<PdfResult> {
  const [company, project, rows] = await Promise.all([
    loadCompanyForPdf(companyId),
    getProject(companyId, projectId),
    listMaterialRateVariance(companyId, projectId),
  ]);

  const doc = newDoc();
  drawBrandedHeader(doc, 'Project Material Rate Sheet', company);
  doc.fontSize(9).fillColor(MUTED).font('Helvetica');
  doc.text(`Project: ${project.name} (${project.code})`);
  if (project.locationAddress) doc.text(`Site: ${project.locationAddress}`);
  doc.moveDown(1);

  if (rows.length === 0) {
    doc.fontSize(10).fillColor(NAVY).text('No material rate data for this project yet.');
  } else {
    const alertCount = rows.filter((r) => r.overThreshold).length;
    summaryLine(
      doc,
      'Materials tracked',
      String(rows.length),
    );
    summaryLine(
      doc,
      `Over plan (>${RATE_VARIANCE_ALERT_PCT}% vs planned)`,
      String(alertCount),
      alertCount > 0,
    );
    doc.moveDown(0.5);

    const widths = [110, 55, 55, 55, 55, 45, 40];
    let y = tableHeaders(
      doc,
      ['Material', 'Planned', 'Source', 'Catalog', 'Last PO', 'Var %', 'Alert'],
      widths,
      doc.y,
    );
    rows.forEach((r, i) => {
      y = tableRow(
        doc,
        [
          `${r.name} (${r.unit})`,
          inr(r.plannedRate),
          PLANNED_SOURCE_LABEL[r.plannedSource] ?? r.plannedSource,
          inr(r.catalogRate),
          r.lastPoRate != null ? inr(r.lastPoRate) : '-',
          r.variancePct != null ? `${r.variancePct > 0 ? '+' : ''}${r.variancePct}%` : '-',
          r.overThreshold ? 'YES' : '-',
        ],
        widths,
        y,
        i % 2 === 1,
        r.overThreshold ? RED : r.variancePct != null && r.variancePct <= 0 ? GREEN : undefined,
      );
    });
  }

  drawBrandedFooter(doc, company);
  return { buffer: await endBuffer(doc), filename: `material-rates-${project.code}.pdf` };
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
    loadCompanyForPdf(companyId),
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
  drawBrandedHeader(doc, 'Measurement Book', company);
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

  drawBrandedFooter(doc, company);
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
    loadCompanyForPdf(companyId),
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
  drawBrandedHeader(doc, 'Abstract Sheet', company);
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
  drawBrandedFooter(doc, company);
  return { buffer: await endBuffer(doc), filename: `abstract-sheet-${project.code}.pdf` };
}

// ===========================================================================
// 16. SUBCONTRACT WO MEASUREMENT BOOK
// ===========================================================================
export async function reportSubcontractMeasurementBook(
  companyId: string,
  projectId: string,
  workOrderId: string,
): Promise<PdfResult> {
  const wo = await prisma.subcontractWorkOrder.findFirst({
    where: { id: workOrderId, projectId, project: { companyId } },
    include: {
      subcontractor: true,
      project: { select: { name: true, code: true } },
      measurements: {
        where: { status: { in: ['SUBMITTED', 'APPROVED'] } },
        include: { lines: true },
        orderBy: { createdAt: 'asc' },
      },
      materialIssues: { include: { resource: { select: { name: true, unit: true } } } },
    },
  });
  if (!wo) throw new Error('Work order not found');

  const company = await loadCompanyForPdf(companyId);

  const doc = newDoc();
  drawBrandedHeader(doc, 'Subcontract Measurement Book', company);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(NAVY).text(wo.project.name, MARGIN);
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(MUTED)
    .text(`WO ${wo.woNumber} - ${wo.subcontractor.name}`);
  // SUB-C3: Supply mode label
  const woMode = (wo as { materialSupplyMode?: string }).materialSupplyMode ?? 'NONE';
  const supplyLabel = woMode === 'GC_SUPPLIED'
    ? 'Material supply: General contractor (GC stock)'
    : woMode === 'MIXED'
      ? 'Material supply: Mixed (GC + contractor)'
      : 'Material supply: Subcontractor (self-supplied)';
  doc.fillColor(MUTED).fontSize(8).text(supplyLabel);
  doc.moveDown(1);

  for (const m of wo.measurements) {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(NAVY).text(`${m.periodLabel} (${m.status})`);
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(`Total: ${inr(num(m.totalAmount))}`);
    const widths = [180, 50, 45, 55, 70];
    let y = tableHeaders(doc, ['Description', 'Qty', 'Unit', 'Rate', 'Amount'], widths, doc.y);
    m.lines.forEach((line, i) => {
      y = tableRow(
        doc,
        [
          line.description,
          `${num(line.quantity)}`,
          line.unit,
          num(line.rate).toLocaleString('en-IN'),
          inr(num(line.amount)),
        ],
        widths,
        y,
        i % 2 === 1,
      );
    });
    doc.moveDown(0.75);
  }

  // SUB-C3b: Material issues table when GC_SUPPLIED or MIXED
  if ((woMode === 'GC_SUPPLIED' || woMode === 'MIXED') && wo.materialIssues.length > 0) {
    doc.y = ensureSpace(doc, 80);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(NAVY).text('Materials Issued from Site Stock', MARGIN, doc.y);
    doc.moveDown(0.3);
    const matWidths = [110, 50, 40, 50, 60, 50, 50];
    let matY = tableHeaders(doc, ['Resource', 'Qty', 'Unit', 'Rate', 'Amount', 'Recovered', 'Net'], matWidths, doc.y);
    wo.materialIssues.forEach((mi, i) => {
      matY = tableRow(
        doc,
        [
          mi.resource?.name ?? 'Unknown',
          `${num(mi.quantity)}`,
          mi.unit,
          num(mi.rate).toLocaleString('en-IN'),
          inr(num(mi.amount)),
          `${num(mi.recoveredQty)}`,
          `${num(mi.quantity) - num(mi.recoveredQty)}`,
        ],
        matWidths,
        matY,
        i % 2 === 1,
      );
    });
    const issuedTotal = wo.materialIssues.reduce((s, mi) => s + num(mi.amount), 0);
    const recoveredTotal = wo.materialIssues.reduce((s, mi) => s + num(mi.recoveredAmount), 0);
    summaryLine(doc, 'Total Issued', inr(issuedTotal));
    summaryLine(doc, 'Total Recovered', inr(recoveredTotal));
    summaryLine(doc, 'Net Material on WO', inr(issuedTotal - recoveredTotal), true);
  }

  drawBrandedFooter(doc, company);
  return {
    buffer: await endBuffer(doc),
    filename: `sub-measurement-book-${wo.woNumber}.pdf`,
  };
}

// ===========================================================================
// 17. SUBCONTRACT WO ABSTRACT SHEET
// ===========================================================================
export async function reportSubcontractAbstractSheet(
  companyId: string,
  projectId: string,
  workOrderId: string,
): Promise<PdfResult> {
  const wo = await prisma.subcontractWorkOrder.findFirst({
    where: { id: workOrderId, projectId, project: { companyId } },
    include: {
      subcontractor: true,
      project: { select: { name: true, code: true } },
      contractLines: true,
      measurements: {
        where: { status: 'APPROVED' },
        include: { lines: true },
      },
      // SUB-C3b: Include material issues for the material table
      materialIssues: { include: { resource: { select: { name: true, unit: true } } } },
    },
  });
  if (!wo) throw new Error('Work order not found');

  // SUB-C3b: Use loadCompanyForPdf for logo + settings
  const company = await loadCompanyForPdf(companyId);

  const certifiedByLine = new Map<string, number>();
  for (const m of wo.measurements) {
    for (const line of m.lines) {
      if (line.workOrderLineId) {
        certifiedByLine.set(
          line.workOrderLineId,
          (certifiedByLine.get(line.workOrderLineId) ?? 0) + num(line.quantity),
        );
      }
    }
  }

  const doc = newDoc();
  drawBrandedHeader(doc, 'Subcontract Abstract Sheet', company);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(NAVY).text(wo.project.name, MARGIN);
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(MUTED)
    .text(`WO ${wo.woNumber} - Contract ${inr(num(wo.contractValue))}`);
  // SUB-C3a: Supply mode label on abstract too
  const absWoMode = (wo as { materialSupplyMode?: string }).materialSupplyMode ?? 'NONE';
  const absSupplyLabel = absWoMode === 'GC_SUPPLIED'
    ? 'Material supply: General contractor (GC stock)'
    : absWoMode === 'MIXED'
      ? 'Material supply: Mixed (GC + contractor)'
      : 'Material supply: Subcontractor (self-supplied)';
  doc.fillColor(MUTED).fontSize(8).text(absSupplyLabel);
  doc.moveDown(1);

  const widths = [160, 40, 55, 55, 55, 55, 70];
  let y = tableHeaders(
    doc,
    ['Description', 'Unit', 'Contract', 'Certified', 'Balance', 'Rate', 'Amount'],
    widths,
    doc.y,
  );
  wo.contractLines.forEach((cl, i) => {
    const certified = certifiedByLine.get(cl.id) ?? 0;
    const balance = Math.max(0, num(cl.contractQty) - certified);
    y = tableRow(
      doc,
      [
        cl.description,
        cl.unit,
        `${num(cl.contractQty)}`,
        `${certified}`,
        `${balance}`,
        num(cl.rate).toLocaleString('en-IN'),
        inr(num(cl.amount)),
      ],
      widths,
      y,
      i % 2 === 1,
    );
  });

  // SUB-C3b: Material issues table on abstract when GC_SUPPLIED or MIXED
  if ((absWoMode === 'GC_SUPPLIED' || absWoMode === 'MIXED') && wo.materialIssues.length > 0) {
    doc.y = ensureSpace(doc, 80);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(NAVY).text('Materials Issued from Site Stock', MARGIN, doc.y);
    doc.moveDown(0.3);
    const matWidths = [110, 50, 40, 50, 60, 50, 50];
    let matY = tableHeaders(doc, ['Resource', 'Qty', 'Unit', 'Rate', 'Amount', 'Recovered', 'Net'], matWidths, doc.y);
    wo.materialIssues.forEach((mi, i) => {
      matY = tableRow(
        doc,
        [
          mi.resource?.name ?? 'Unknown',
          `${num(mi.quantity)}`,
          mi.unit,
          num(mi.rate).toLocaleString('en-IN'),
          inr(num(mi.amount)),
          `${num(mi.recoveredQty)}`,
          `${num(mi.quantity) - num(mi.recoveredQty)}`,
        ],
        matWidths,
        matY,
        i % 2 === 1,
      );
    });
    const issuedTotal = wo.materialIssues.reduce((s, mi) => s + num(mi.amount), 0);
    const recoveredTotal = wo.materialIssues.reduce((s, mi) => s + num(mi.recoveredAmount), 0);
    summaryLine(doc, 'Total Issued', inr(issuedTotal));
    summaryLine(doc, 'Total Recovered', inr(recoveredTotal));
    summaryLine(doc, 'Net Material on WO', inr(issuedTotal - recoveredTotal), true);
  }

  drawBrandedFooter(doc, company);
  return {
    buffer: await endBuffer(doc),
    filename: `sub-abstract-${wo.woNumber}.pdf`,
  };
}
