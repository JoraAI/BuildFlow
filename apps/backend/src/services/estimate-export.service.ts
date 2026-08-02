/**
 * BuildFlow - Estimate export service (Excel + PDF).
 *
 * Excel: 4-sheet workbook (Summary, Detailed, Rate Analysis Used, Price Assumptions)
 *        with live Excel formulas and color-coded rows.
 * PDF:   Cover + detailed line items + summary page.
 */
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { prisma } from '../lib/prisma';
import { getEstimateWithSummary } from './estimate.service';
import { ApiError } from '../utils/errors';

export interface EstimateExportData {
  estimate: Awaited<ReturnType<typeof getEstimateWithSummary>>;
  project: {
    name: string;
    code: string;
    locationAddress: string | null;
  };
  company: {
    name: string;
    gstin: string | null;
    address: string | null;
  };
}

async function loadExportData(companyId: string, estimateId: string): Promise<EstimateExportData> {
  const estimate = await getEstimateWithSummary(companyId, estimateId);

  const project = await prisma.project.findFirst({
    where: { id: estimate.projectId, companyId },
    select: { name: true, code: true, locationAddress: true },
  });
  if (!project) throw ApiError.notFound('Project not found');

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, gstin: true, address: true },
  });
  if (!company) throw ApiError.notFound('Company not found');

  return { estimate, project, company };
}

const TYPE_COLORS: Record<string, string> = {
  MATERIAL: 'FFDBEAFE', // light blue
  LABOUR: 'FFDCFCE7', // light green
  EQUIPMENT: 'FFFEF9C3', // light yellow
  SUBCONTRACTOR: 'FFFCE7F3', // light pink
  MISC: 'FFF1F5F9', // light slate
};

function inr(n: number): string {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

/* ------------------------------------------------------------------ */
/* Excel Export (4 sheets)                                             */
/* ------------------------------------------------------------------ */

export async function generateEstimateExcel(companyId: string, estimateId: string): Promise<Buffer> {
  const { estimate, project, company } = await loadExportData(companyId, estimateId);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'BuildFlow';
  wb.created = new Date();

  const s = estimate.summary;

  /* ---- Sheet 1: Summary ---- */
  const ws1 = wb.addWorksheet('Summary', { views: [{ showGridLines: false }] });
  // Company header
  ws1.mergeCells('A1:D1');
  ws1.getCell('A1').value = company.name;
  ws1.getCell('A1').font = { bold: true, size: 16 };
  ws1.mergeCells('A2:D2');
  ws1.getCell('A2').value = `GSTIN: ${company.gstin ?? '-'}`;
  ws1.getCell('A2').font = { size: 10, color: { argb: 'FF64748B' } };

  ws1.mergeCells('A4:D4');
  ws1.getCell('A4').value = 'PROJECT COST ESTIMATE - SUMMARY';
  ws1.getCell('A4').font = { bold: true, size: 14, color: { argb: 'FF1E3A5F' } };

  // Meta rows
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
  let row = 6;
  for (const [label, value] of meta) {
    ws1.getCell(`A${row}`).value = label;
    ws1.getCell(`A${row}`).font = { bold: true };
    ws1.mergeCells(`B${row}:D${row}`);
    ws1.getCell(`B${row}`).value = value;
    row++;
  }

  // Cost breakdown table
  row += 2;
  ws1.getCell(`A${row}`).value = 'Cost Breakdown';
  ws1.getCell(`A${row}`).font = { bold: true, size: 12 };
  row++;
  const breakdownHeader = ['Type', 'Amount (Rs)', '% of Total'];
  ['A', 'B', 'C'].forEach((col, i) => {
    const c = ws1.getCell(`${col}${row}`);
    c.value = breakdownHeader[i];
    c.font = { bold: true };
    c.fill = { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FF1E3A5F' } };
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

  // Subtotal + add-ons + grand total
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
      ws1.getCell(`B${row}`).fill = { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFF59E0B' } };
    }
    row++;
  }

  ws1.columns = [{ width: 28 }, { width: 20 }, { width: 14 }, { width: 14 }];

  /* ---- Sheet 2: Detailed (with live formulas) ---- */
  const ws2 = wb.addWorksheet('Detailed', { views: [{ showGridLines: false }] });
  const detailHeader = ['Sr', 'Description', 'Unit', 'Qty', 'Rate (Rs)', 'Amount (Rs)', 'Type'];
  detailHeader.forEach((h, i) => {
    const c = ws2.getCell(1, i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
  });

  let detailRow = 2;
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
  ws2.getCell(detailRow, 6).value = { formula: `SUM(F2:F${detailRow - 1})` };
  ws2.getCell(detailRow, 6).font = { bold: true, size: 12 };
  ws2.getCell(detailRow, 6).numFmt = '#,##0.00';
  ws2.getCell(detailRow, 6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };

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
  // FIX (EST-M8): Collect rate analyses linked via item.rateAnalysisId (not resource lookup).
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
    const c = ws3.getCell(1, i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
  });

  let raRow = 2;
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
    ws3.getCell(2, 1).value = 'No rate analyses referenced in this estimate.';
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
  const paHeader = ['Resource', 'Type', 'Unit', 'Rate (Rs)', 'As of Date'];
  paHeader.forEach((h, i) => {
    const c = ws4.getCell(1, i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
  });

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
    const r2 = i + 2;
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
    ws4.getCell(2, 1).value = 'No resources referenced in this estimate.';
  }
  ws4.columns = [{ width: 32 }, { width: 14 }, { width: 10 }, { width: 14 }, { width: 14 }];

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/* ------------------------------------------------------------------ */
/* PDF Export                                                          */
/* ------------------------------------------------------------------ */

export async function generateEstimatePdf(companyId: string, estimateId: string): Promise<Buffer> {
  const { estimate, project, company } = await loadExportData(companyId, estimateId);
  const s = estimate.summary;

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    /* ---- Cover / Header ---- */
    doc
      .fontSize(20)
      .fillColor('#1E3A5F')
      .font('Helvetica-Bold')
      .text(company.name, { align: 'center' });
    doc
      .fontSize(10)
      .fillColor('#64748B')
      .font('Helvetica')
      .text(`GSTIN: ${company.gstin ?? '-'}`, { align: 'center' });
    if (company.address) {
      doc.text(company.address, { align: 'center' });
    }

    doc.moveDown(0.5);
    doc
      .fontSize(16)
      .fillColor('#1E3A5F')
      .font('Helvetica-Bold')
      .text('PROJECT COST ESTIMATE', { align: 'center' });
    doc.moveDown(1);

    // Meta table
    const metaLeft: Array<[string, string]> = [
      ['Project', project.name],
      ['Code', project.code],
      ['Location', project.locationAddress ?? '-'],
    ];
    const metaRight: Array<[string, string]> = [
      ['Estimate', `${estimate.name} (v${estimate.version}.0)`],
      ['Prepared By', estimate.createdByName],
      ['Date', new Date(estimate.createdAt).toLocaleDateString('en-IN')],
    ];
    const startY = doc.y;
    doc.fontSize(9).font('Helvetica');
    metaLeft.forEach(([label, value], i) => {
      const y = startY + i * 14;
      doc.font('Helvetica-Bold').text(`${label}:`, 50, y);
      doc.font('Helvetica').text(value, 130, y);
    });
    metaRight.forEach(([label, value], i) => {
      const y = startY + i * 14;
      doc.font('Helvetica-Bold').text(`${label}:`, 320, y);
      doc.font('Helvetica').text(value, 420, y);
    });
    doc.moveDown(3);

    /* ---- Detailed line items ---- */
    doc
      .fontSize(13)
      .fillColor('#1E3A5F')
      .font('Helvetica-Bold')
      .text('Detailed Line Items');
    doc.moveDown(0.3);

    for (const section of estimate.sections) {
      if (doc.y > 700) doc.addPage();
      doc
        .fontSize(11)
        .fillColor('#1E3A5F')
        .font('Helvetica-Bold')
        .text(section.name, { underline: false });
      doc.moveDown(0.1);

      // Table header
      const tableY = doc.y;
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
      doc.rect(50, tableY, 495, 16).fill('#1E3A5F');
      doc.fillColor('#FFFFFF');
      doc.text('Sr', 55, tableY + 4);
      doc.text('Description', 80, tableY + 4);
      doc.text('Unit', 280, tableY + 4);
      doc.text('Qty', 320, tableY + 4);
      doc.text('Rate', 370, tableY + 4, { width: 60, align: 'right' });
      doc.text('Amount', 490, tableY + 4, { width: 55, align: 'right' });
      doc.moveDown(0.3);

      let sr = 1;
      for (const item of section.items) {
        if (doc.y > 740) doc.addPage();
        const rowY = doc.y;
        doc
          .fontSize(8)
          .font('Helvetica')
          .fillColor('#0F172A');
        doc.text(String(sr++), 55, rowY);
        doc.text(item.description, 80, rowY, { width: 195 });
        doc.text(item.unit, 280, rowY);
        doc.text(item.quantity.toFixed(2), 320, rowY);
        doc.text(inr(item.rate), 370, rowY, { width: 60, align: 'right' });
        doc.text(inr(item.amount), 490, rowY, { width: 55, align: 'right' });
        doc.moveDown(0.3);
      }

      // Section subtotal
      if (doc.y > 740) doc.addPage();
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(`Subtotal:`, 400, doc.y, { width: 80, align: 'right' });
      doc.text(inr(section.subtotal), 490, doc.y - 10, { width: 55, align: 'right' });
      doc.moveDown(0.5);
    }

    /* ---- Summary page ---- */
    doc.addPage();
    doc
      .fontSize(13)
      .fillColor('#1E3A5F')
      .font('Helvetica-Bold')
      .text('Cost Summary');
    doc.moveDown(0.5);

    const summaryRows: Array<[string, string]> = [
      ['Materials', inr(s.materialCost)],
      ['Labour', inr(s.labourCost)],
      ['Equipment', inr(s.equipmentCost)],
      ['Subcontractor', inr(s.subcontractorCost)],
      ['Miscellaneous', inr(s.miscCost)],
      ['Subtotal', inr(s.subtotal)],
      [`Overhead (${s.overheadPct}%)`, inr(s.overheadAmount)],
      [`Contingency (${s.contingencyPct}%)`, inr(s.contingencyAmount)],
      [`Profit Margin (${s.profitMarginPct}%)`, inr(s.profitMarginAmount)],
      ['Total Before Tax', inr(s.grandTotalBeforeGST)],
      ['GST (weighted)', inr(s.gstAmount)],
    ];

    doc.fontSize(10);
    summaryRows.forEach(([label, value]) => {
      doc.font('Helvetica').text(label, 150, doc.y);
      doc.text(value, 400, doc.y - 12, { width: 145, align: 'right' });
      doc.moveDown(0.2);
    });

    doc.moveDown(0.3);
    doc.rect(140, doc.y, 405, 24).fill('#F59E0B');
    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor('#FFFFFF')
      .text('GRAND TOTAL', 150, doc.y + 6);
    doc.text(inr(s.grandTotal), 400, doc.y - 13, { width: 145, align: 'right' });
    doc.moveDown(2);

    // Notes
    if (estimate.notes) {
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#0F172A')
        .text('Notes & Assumptions');
      doc.font('Helvetica').fontSize(9).fillColor('#64748B').text(estimate.notes);
      doc.moveDown(1);
    }

    doc
      .font('Helvetica-Oblique')
      .fontSize(8)
      .fillColor('#94A3B8')
      .text('This estimate is valid for 30 days from date of preparation.');

    doc.moveDown(2);
    // Signature blocks
    const sigY = doc.y;
    doc.font('Helvetica').fontSize(9).fillColor('#0F172A');
    doc.text('Prepared By', 50, sigY, {});
    doc.text('Checked By', 220, sigY, {});
    doc.text('Approved By', 390, sigY, {});
    doc.moveDown(2);
    const sigLineY = doc.y;
    doc.moveTo(50, sigLineY).lineTo(160, sigLineY).stroke('#94A3B8');
    doc.moveTo(220, sigLineY).lineTo(330, sigLineY).stroke('#94A3B8');
    doc.moveTo(390, sigLineY).lineTo(500, sigLineY).stroke('#94A3B8');

    doc.end();
  });
}