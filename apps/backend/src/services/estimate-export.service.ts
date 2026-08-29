/**
 * BuildFlow - Estimate export service (Excel + PDF).
 *
 * Excel: 4-sheet workbook (Summary, Detailed, Rate Analysis Used, Price Assumptions)
 *        with company branding (logo, accent color, footer) + live Excel formulas.
 * PDF:   Cover + detailed line items + summary page.
 */
import ExcelJS from 'exceljs';
import { prisma } from '../lib/prisma';
import { getEstimateWithSummary } from './estimate.service';
import { loadCompanyForPdf, type PdfCompany, reportEstimate } from './pdf-report.service';
import { ApiError } from '../utils/errors';

export interface EstimateExportData {
  estimate: Awaited<ReturnType<typeof getEstimateWithSummary>>;
  project: {
    name: string;
    code: string;
    locationAddress: string | null;
  };
  company: PdfCompany;
}

async function loadExportData(companyId: string, estimateId: string): Promise<EstimateExportData> {
  const estimate = await getEstimateWithSummary(companyId, estimateId);

  const project = await prisma.project.findFirst({
    where: { id: estimate.projectId, companyId },
    select: { name: true, code: true, locationAddress: true },
  });
  if (!project) throw ApiError.notFound('Project not found');

  const company = await loadCompanyForPdf(companyId);

  return { estimate, project, company };
}

const TYPE_COLORS: Record<string, string> = {
  MATERIAL: 'FFDBEAFE',
  LABOUR: 'FFDCFCE7',
  EQUIPMENT: 'FFFEF9C3',
  SUBCONTRACTOR: 'FFFCE7F3',
  MISC: 'FFF1F5F9',
};

const NAVY_ARGB = 'FF1E3A5F';
const MUTED_ARGB = 'FF64748B';
const DEFAULT_ACCENT_ARGB = 'FFF59E0B';

function hexToArgb(hex: string, fallback = DEFAULT_ACCENT_ARGB): string {
  const h = hex.replace('#', '').toUpperCase();
  if (!/^[0-9A-F]{6}$/.test(h)) return fallback;
  return `FF${h}`;
}

interface ExcelBranding {
  accentArgb: string;
  showLogo: boolean;
  footerText?: string;
  logoImage?: { buffer: Uint8Array; extension: 'png' | 'jpeg' };
}

async function fetchLogoImage(url: string): Promise<{ buffer: Uint8Array; extension: 'png' | 'jpeg' } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = new Uint8Array(await res.arrayBuffer());
    const ct = (res.headers.get('content-type') ?? '').toLowerCase();
    const extension: 'png' | 'jpeg' =
      ct.includes('png') || url.toLowerCase().includes('.png') ? 'png' : 'jpeg';
    return { buffer, extension };
  } catch {
    return null;
  }
}

async function buildExcelBranding(company: PdfCompany): Promise<ExcelBranding> {
  const accentArgb = hexToArgb(company.accentColor);
  const showLogo = company.reportSettings.showLogo !== false;
  const rawFooter = company.reportSettings.footerText;
  const footerText = typeof rawFooter === 'string' && rawFooter.trim() ? rawFooter.trim() : undefined;
  let logoImage: ExcelBranding['logoImage'];
  if (showLogo && company.logoBuffer) {
    logoImage = {
      buffer: new Uint8Array(company.logoBuffer),
      extension: company.logoUrl?.toLowerCase().includes('.png') ? 'png' : 'jpeg',
    };
  } else if (showLogo && company.logoUrl?.startsWith('http')) {
    logoImage = (await fetchLogoImage(company.logoUrl)) ?? undefined;
  }
  return { accentArgb, showLogo, footerText, logoImage };
}

function styleTableHeaderCell(cell: ExcelJS.Cell) {
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_ARGB } };
}

/** RPT-O4: Branded header block on Summary sheet - returns first content row index. */
function applySummaryBranding(
  ws: ExcelJS.Worksheet,
  wb: ExcelJS.Workbook,
  company: PdfCompany,
  branding: ExcelBranding,
  projectLabel: string,
): number {
  ws.mergeCells('A1:D1');
  ws.getRow(1).height = 8;
  ws.getCell('A1').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: branding.accentArgb },
  };

  ws.mergeCells('A2:C2');
  ws.getCell('A2').value = company.name;
  ws.getCell('A2').font = { bold: true, size: 16, color: { argb: NAVY_ARGB } };

  if (branding.logoImage) {
    const imageId = wb.addImage({
      base64: Buffer.from(branding.logoImage.buffer).toString('base64'),
      extension: branding.logoImage.extension,
    });
    ws.addImage(imageId, {
      tl: { col: 3, row: 1 },
      ext: { width: 72, height: 48 },
    });
  }

  ws.mergeCells('A3:D3');
  ws.getCell('A3').value = `GSTIN: ${company.gstin ?? '-'}`;
  ws.getCell('A3').font = { size: 10, color: { argb: MUTED_ARGB } };

  if (company.address) {
    ws.mergeCells('A4:D4');
    ws.getCell('A4').value = company.address;
    ws.getCell('A4').font = { size: 9, color: { argb: MUTED_ARGB } };
  }

  const titleRow = company.address ? 6 : 5;
  ws.mergeCells(`A${titleRow}:D${titleRow}`);
  ws.getCell(`A${titleRow}`).value = 'PROJECT COST ESTIMATE - SUMMARY';
  ws.getCell(`A${titleRow}`).font = { bold: true, size: 14, color: { argb: NAVY_ARGB } };

  const subRow = titleRow + 1;
  ws.mergeCells(`A${subRow}:D${subRow}`);
  ws.getCell(`A${subRow}`).value = projectLabel;
  ws.getCell(`A${subRow}`).font = { size: 10, color: { argb: MUTED_ARGB } };

  return titleRow + 3;
}

/** Compact branded row on secondary sheets - returns row index for table headers. */
function applySheetBranding(
  ws: ExcelJS.Worksheet,
  wb: ExcelJS.Workbook,
  company: PdfCompany,
  branding: ExcelBranding,
  sheetTitle: string,
): number {
  ws.mergeCells('A1:G1');
  ws.getRow(1).height = 6;
  ws.getCell('A1').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: branding.accentArgb },
  };

  ws.mergeCells('A2:E2');
  ws.getCell('A2').value = `${company.name} - ${sheetTitle}`;
  ws.getCell('A2').font = { bold: true, size: 11, color: { argb: NAVY_ARGB } };

  if (branding.logoImage) {
    const imageId = wb.addImage({
      base64: Buffer.from(branding.logoImage.buffer).toString('base64'),
      extension: branding.logoImage.extension,
    });
    ws.addImage(imageId, {
      tl: { col: 5, row: 1 },
      ext: { width: 56, height: 36 },
    });
  }

  return 4;
}

function appendSummaryFooter(ws: ExcelJS.Worksheet, row: number, company: PdfCompany, branding: ExcelBranding) {
  row += 2;
  const footerParts = [
    branding.footerText,
    company.name,
    company.gstin ? `GSTIN: ${company.gstin}` : null,
    `Generated ${new Date().toLocaleString('en-IN')}`,
  ].filter(Boolean);
  ws.mergeCells(`A${row}:D${row}`);
  ws.getCell(`A${row}`).value = footerParts.join(' | ');
  ws.getCell(`A${row}`).font = { size: 9, italic: true, color: { argb: MUTED_ARGB } };
}

/* ------------------------------------------------------------------ */
/* Excel Export (4 sheets)                                             */
/* ------------------------------------------------------------------ */

export async function generateEstimateExcel(companyId: string, estimateId: string): Promise<Buffer> {
  const { estimate, project, company } = await loadExportData(companyId, estimateId);
  const branding = await buildExcelBranding(company);
  const wb = new ExcelJS.Workbook();
  wb.creator = company.name;
  wb.company = company.name;
  wb.created = new Date();

  const s = estimate.summary;
  const projectLabel = `${project.name} (${project.code})`;

  /* ---- Sheet 1: Summary ---- */
  const ws1 = wb.addWorksheet('Summary', { views: [{ showGridLines: false }] });
  let row = applySummaryBranding(ws1, wb, company, branding, projectLabel);

  const meta: Array<[string, string]> = [
    ['Project', project.name],
    ['Project Code', project.code],
    ['Location', project.locationAddress ?? '-'],
    ['Estimate', `${estimate.name} (v${estimate.version}.0)`],
    ['Prepared By', estimate.createdByName],
    ['Approved By', estimate.approvedByName ?? '-'],
    ['Date', new Date(estimate.createdAt).toLocaleDateString('en-IN')],
    ['Status', estimate.status],
  ];
  for (const [label, value] of meta) {
    ws1.getCell(`A${row}`).value = label;
    ws1.getCell(`A${row}`).font = { bold: true };
    ws1.mergeCells(`B${row}:D${row}`);
    ws1.getCell(`B${row}`).value = value;
    row++;
  }

  row += 2;
  ws1.getCell(`A${row}`).value = 'Cost Breakdown';
  ws1.getCell(`A${row}`).font = { bold: true, size: 12 };
  row++;
  const breakdownHeader = ['Type', 'Amount (Rs)', '% of Total'];
  ['A', 'B', 'C'].forEach((col, i) => {
    const c = ws1.getCell(`${col}${row}`);
    c.value = breakdownHeader[i];
    styleTableHeaderCell(c);
  });
  row++;
  const breakdownRows: Array<[string, number, number]> = [
    ['Materials', s.materialCost, s.materialPct],
    ['Labour', s.labourCost, s.labourPct],
    ['Equipment', s.equipmentCost, s.equipmentPct],
    ['Subcontractor', s.subcontractorCost, s.subPct],
    ['Miscellaneous', s.miscCost, s.miscPct],
  ];
  for (const [label, amount, pct] of breakdownRows) {
    ws1.getCell(`A${row}`).value = label;
    ws1.getCell(`B${row}`).value = amount;
    ws1.getCell(`B${row}`).numFmt = '#,##0.00';
    ws1.getCell(`C${row}`).value = pct / 100;
    ws1.getCell(`C${row}`).numFmt = '0.0%';
    row++;
  }

  row++;
  const totals: Array<[string, number]> = [
    ['Subtotal', s.subtotal],
    [`Overhead (${s.overheadPct}%)`, s.overheadAmount],
    [`Contingency (${s.contingencyPct}%)`, s.contingencyAmount],
    [`Profit Margin (${s.profitMarginPct}%)`, s.profitMarginAmount],
    ['Total Before Tax', s.grandTotalBeforeGST],
    ['GST (weighted)', s.gstAmount],
    ['GRAND TOTAL', s.grandTotal],
  ];
  for (const [label, amount] of totals) {
    ws1.getCell(`A${row}`).value = label;
    ws1.getCell(`A${row}`).font = label === 'GRAND TOTAL' ? { bold: true, size: 12 } : { bold: true };
    ws1.mergeCells(`B${row}:C${row}`);
    ws1.getCell(`B${row}`).value = amount;
    ws1.getCell(`B${row}`).numFmt = '#,##0.00';
    ws1.getCell(`B${row}`).font = label === 'GRAND TOTAL' ? { bold: true, size: 12 } : { bold: true };
    if (label === 'GRAND TOTAL') {
      ws1.getCell(`B${row}`).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: branding.accentArgb },
      };
    }
    row++;
  }

  appendSummaryFooter(ws1, row, company, branding);
  ws1.columns = [{ width: 28 }, { width: 20 }, { width: 14 }, { width: 14 }];

  /* ---- Sheet 2: Detailed (with live formulas) ---- */
  const ws2 = wb.addWorksheet('Detailed', { views: [{ showGridLines: false }] });
  let detailRow = applySheetBranding(ws2, wb, company, branding, 'Detailed Line Items');
  const detailHeader = ['Sr', 'Description', 'Unit', 'Qty', 'Rate (Rs)', 'Amount (Rs)', 'Type'];
  detailHeader.forEach((h, i) => {
    const c = ws2.getCell(detailRow, i + 1);
    c.value = h;
    styleTableHeaderCell(c);
  });
  detailRow++;

  const detailDataStartRow = detailRow;
  let sr = 1;
  for (const section of estimate.sections) {
    // Section header row
    ws2.mergeCells(detailRow, 1, detailRow, 7);
    const secCell = ws2.getCell(detailRow, 1);
    secCell.value = section.name;
    secCell.font = { bold: true, size: 12, color: { argb: 'FF1E3A5F' } };
    secCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    detailRow++;

    const sectionStartRow = detailRow;
    for (const item of section.items) {
      ws2.getCell(detailRow, 1).value = sr++;
      ws2.getCell(detailRow, 2).value = item.description;
      ws2.getCell(detailRow, 3).value = item.unit;
      ws2.getCell(detailRow, 4).value = item.quantity;
      ws2.getCell(detailRow, 5).value = item.rate;
      // LIVE FORMULA: Amount = Qty * Rate
      ws2.getCell(detailRow, 6).value = { formula: `D${detailRow}*E${detailRow}` };
      ws2.getCell(detailRow, 7).value = item.type;

      // Color-code by type
      const color = TYPE_COLORS[item.type] ?? 'FFFFFFFF';
      for (let col = 1; col <= 7; col++) {
        ws2.getCell(detailRow, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
      }

      ws2.getCell(detailRow, 4).numFmt = '#,##0.00';
      ws2.getCell(detailRow, 5).numFmt = '#,##0.00';
      ws2.getCell(detailRow, 6).numFmt = '#,##0.00';
      detailRow++;
    }

    // Section subtotal with live SUM formula
    const sectionEndRow = detailRow - 1;
    if (sectionEndRow >= sectionStartRow) {
      ws2.getCell(detailRow, 2).value = `${section.name} Subtotal`;
      ws2.getCell(detailRow, 2).font = { bold: true };
      ws2.getCell(detailRow, 6).value = { formula: `SUM(F${sectionStartRow}:F${sectionEndRow})` };
      ws2.getCell(detailRow, 6).font = { bold: true };
      ws2.getCell(detailRow, 6).numFmt = '#,##0.00';
      detailRow++;
    }
    detailRow++; // gap between sections
  }

  // Grand total with SUM of all amount column
  ws2.getCell(detailRow, 2).value = 'GRAND TOTAL (Direct Costs)';
  ws2.getCell(detailRow, 2).font = { bold: true, size: 12 };
  ws2.getCell(detailRow, 6).value = { formula: `SUM(F${detailDataStartRow}:F${detailRow - 1})` };
  ws2.getCell(detailRow, 6).font = { bold: true, size: 12 };
  ws2.getCell(detailRow, 6).numFmt = '#,##0.00';
  ws2.getCell(detailRow, 6).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: branding.accentArgb },
  };

  ws2.columns = [
    { width: 6 },
    { width: 40 },
    { width: 10 },
    { width: 12 },
    { width: 14 },
    { width: 16 },
    { width: 14 },
  ];

  /* ---- Sheet 3: Rate Analysis Used ---- */
  const ws3 = wb.addWorksheet('Rate Analysis Used', { views: [{ showGridLines: false }] });
  let raRow = applySheetBranding(ws3, wb, company, branding, 'Rate Analysis Used');
  const raIds = estimate.sections
    .flatMap((sec) => sec.items)
    .filter((it) => it.rateAnalysisId)
    .map((it) => it.rateAnalysisId as string);
  const uniqueRaIds = [...new Set(raIds)];

  const rateAnalyses = uniqueRaIds.length
    ? await prisma.rateAnalysis.findMany({
        where: { companyId, id: { in: uniqueRaIds } },
        include: {
          components: {
            include: { resource: { select: { name: true, unit: true, rate: true } } },
          },
        },
      })
    : [];

  const raHeader = ['Rate Analysis', 'Unit', 'Component', 'Type', 'Qty/Unit', 'Rate (Rs)', 'Amount (Rs)'];
  raHeader.forEach((h, i) => {
    const c = ws3.getCell(raRow, i + 1);
    c.value = h;
    styleTableHeaderCell(c);
  });
  raRow++;
  for (const ra of rateAnalyses) {
    ws3.getCell(raRow, 1).value = ra.name;
    ws3.getCell(raRow, 1).font = { bold: true };
    ws3.getCell(raRow, 2).value = ra.unit;
    for (const comp of ra.components) {
      ws3.getCell(raRow, 3).value = comp.resource?.name ?? comp.miscName ?? '-';
      ws3.getCell(raRow, 4).value = comp.type;
      ws3.getCell(raRow, 5).value = Number(comp.quantityPerUnit);
      ws3.getCell(raRow, 6).value = Number(comp.rate);
      ws3.getCell(raRow, 7).value = { formula: `E${raRow}*F${raRow}` };
      ws3.getCell(raRow, 5).numFmt = '#,##0.000';
      ws3.getCell(raRow, 6).numFmt = '#,##0.00';
      ws3.getCell(raRow, 7).numFmt = '#,##0.00';
      raRow++;
    }
    // Subtotal
    ws3.getCell(raRow, 3).value = 'Total';
    ws3.getCell(raRow, 3).font = { bold: true };
    ws3.getCell(raRow, 7).value = Number(ra.totalRate);
    ws3.getCell(raRow, 7).font = { bold: true };
    ws3.getCell(raRow, 7).numFmt = '#,##0.00';
    raRow += 2;
  }
  if (rateAnalyses.length === 0) {
    ws3.getCell(raRow, 1).value = 'No rate analyses referenced in this estimate.';
  }
  ws3.columns = [
    { width: 30 },
    { width: 10 },
    { width: 30 },
    { width: 14 },
    { width: 12 },
    { width: 14 },
    { width: 16 },
  ];

  /* ---- Sheet 4: Price Assumptions ---- */
  const ws4 = wb.addWorksheet('Price Assumptions', { views: [{ showGridLines: false }] });
  let paRow = applySheetBranding(ws4, wb, company, branding, 'Price Assumptions');
  const paHeader = ['Resource', 'Type', 'Unit', 'Rate (Rs)', 'As of Date'];
  paHeader.forEach((h, i) => {
    const c = ws4.getCell(paRow, i + 1);
    c.value = h;
    styleTableHeaderCell(c);
  });
  paRow++;

  const resourceIds = estimate.sections
    .flatMap((sec) => sec.items)
    .filter((it) => it.resourceId)
    .map((it) => it.resourceId as string);
  const uniqueResourceIds = [...new Set(resourceIds)];

  const resources = uniqueResourceIds.length
    ? await prisma.resource.findMany({
        where: { id: { in: uniqueResourceIds } },
        orderBy: { name: 'asc' },
      })
    : [];

  resources.forEach((r, i) => {
    const r2 = paRow + i;
    ws4.getCell(r2, 1).value = r.name;
    ws4.getCell(r2, 2).value = r.type;
    ws4.getCell(r2, 3).value = r.unit;
    ws4.getCell(r2, 4).value = Number(r.rate);
    ws4.getCell(r2, 4).numFmt = '#,##0.00';
    ws4.getCell(r2, 5).value = r.lastRateUpdatedAt
      ? new Date(r.lastRateUpdatedAt).toLocaleDateString('en-IN')
      : '-';
  });
  if (resources.length === 0) {
    ws4.getCell(paRow, 1).value = 'No resources referenced in this estimate.';
  }
  ws4.columns = [{ width: 32 }, { width: 14 }, { width: 10 }, { width: 14 }, { width: 14 }];

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/* ------------------------------------------------------------------ */
/* PDF Export                                                          */
/* ------------------------------------------------------------------ */

export async function generateEstimatePdf(companyId: string, estimateId: string): Promise<Buffer> {
  const { buffer } = await reportEstimate(companyId, estimateId);
  return buffer;
}