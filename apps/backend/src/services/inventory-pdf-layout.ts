/**
 * Inventory Management System PDF layout (Tax Invoice style).
 * Matches the bordered GST tax-invoice template used for IMS documents.
 */
import {
  PDF_MARGIN as MARGIN,
  PDF_PAGE_W as PAGE_W,
  PDF_CONTENT_W as CONTENT_W,
  PDF_MUTED as MUTED,
} from './pdf-layout';

/* eslint-disable @typescript-eslint/no-explicit-any */
type PDFDoc = any;

const BLACK = '#0F172A';
const HEADER_GRAY = '#F1F5F9';

export type InventoryPdfCompany = {
  name: string;
  gstin?: string | null;
  pan?: string | null;
  address?: string | null;
  state?: string | null;
  logoBuffer?: Buffer | null;
  phone?: string | null;
  email?: string | null;
  fssaiLicenceNo?: string | null;
  bankAccountNo?: string | null;
  bankBeneficiaryName?: string | null;
  bankName?: string | null;
  bankBranch?: string | null;
  bankIfsc?: string | null;
};

export type PartyBlock = {
  name: string;
  address?: string | null;
  gstin?: string | null;
  pan?: string | null;
  phone?: string | null;
};

function strokeRect(
  doc: PDFDoc,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  doc.rect(x, y, w, h).strokeColor(BLACK).lineWidth(0.8).stroke();
}

function drawHLine(doc: PDFDoc, x1: number, x2: number, y: number) {
  doc.moveTo(x1, y).lineTo(x2, y).strokeColor(BLACK).lineWidth(0.6).stroke();
}

function drawVLine(doc: PDFDoc, x: number, y1: number, y2: number) {
  doc.moveTo(x, y1).lineTo(x, y2).strokeColor(BLACK).lineWidth(0.6).stroke();
}

function money(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Indian-number words for invoice totals (rupees only). */
export function amountInWordsINR(amount: number): string {
  const rupees = Math.round(Math.abs(amount));
  if (rupees === 0) return 'INR Zero Only';
  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (n: number) => {
    if (n < 20) return ones[n];
    return `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ''}`.trim();
  };
  const three = (n: number) => {
    if (n < 100) return two(n);
    return `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${two(n % 100)}` : ''}`.trim();
  };
  const crore = Math.floor(rupees / 1e7);
  const lakh = Math.floor((rupees % 1e7) / 1e5);
  const thousand = Math.floor((rupees % 1e5) / 1e3);
  const rest = rupees % 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${three(crore)} Crore`);
  if (lakh) parts.push(`${three(lakh)} Lakh`);
  if (thousand) parts.push(`${three(thousand)} Thousand`);
  if (rest) parts.push(three(rest));
  return `INR ${parts.join(' ')} Only`;
}

/**
 * Header: seller details left, logo + title right (as in printed Tax Invoice).
 * Returns Y below the header block.
 */
export function drawInventoryDocHeader(
  doc: PDFDoc,
  title: string,
  company: InventoryPdfCompany,
  opts?: { originalForRecipient?: boolean },
): number {
  const top = MARGIN;
  const boxH = 118;
  strokeRect(doc, MARGIN, top, CONTENT_W, boxH);

  const midX = MARGIN + CONTENT_W * 0.62;
  drawVLine(doc, midX, top, top + boxH);

  // Left: seller block
  let y = top + 8;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(BLACK).text(company.name.toUpperCase(), MARGIN + 8, y, {
    width: midX - MARGIN - 16,
  });
  y = doc.y + 2;
  doc.font('Helvetica').fontSize(8).fillColor(BLACK);
  if (company.address) {
    doc.text(company.address, MARGIN + 8, y, { width: midX - MARGIN - 16 });
    y = doc.y + 2;
  }
  const sellerLines: string[] = [];
  if (company.phone) sellerLines.push(`Cell No: ${company.phone}`);
  if (company.email) sellerLines.push(`Email: ${company.email}`);
  if (company.gstin) sellerLines.push(`GSTIN/UIN: ${company.gstin}`);
  if (company.pan) sellerLines.push(`PAN: ${company.pan}`);
  if (company.state) sellerLines.push(`State Name: ${company.state}`);
  for (const line of sellerLines) {
    doc.text(line, MARGIN + 8, y, { width: midX - MARGIN - 16 });
    y = doc.y + 1;
  }

  // Right: logo + title
  let rightY = top + 8;
  if (opts?.originalForRecipient !== false) {
    doc.font('Helvetica').fontSize(7).fillColor(MUTED).text('(ORIGINAL FOR RECIPIENT)', midX + 8, rightY, {
      width: PAGE_W - MARGIN - midX - 16,
      align: 'right',
    });
    rightY = doc.y + 4;
  }
  if (company.logoBuffer) {
    try {
      doc.image(company.logoBuffer, midX + 12, rightY, { fit: [56, 40] });
      rightY += 44;
    } catch {
      // skip broken logo
    }
  }
  doc.font('Helvetica-Bold').fontSize(9).fillColor(BLACK).text(company.name, midX + 8, rightY, {
    width: PAGE_W - MARGIN - midX - 16,
    align: 'center',
  });
  rightY = doc.y + 6;
  doc.font('Helvetica-Bold').fontSize(16).fillColor(BLACK).text(title, midX + 8, rightY, {
    width: PAGE_W - MARGIN - midX - 16,
    align: 'center',
  });

  return top + boxH;
}

/** Two-column label/value meta grid. Only draws rows that have values. */
export function drawMetaGrid(
  doc: PDFDoc,
  startY: number,
  left: Array<{ label: string; value?: string | null }>,
  right: Array<{ label: string; value?: string | null }>,
): number {
  const leftRows = left.filter((r) => r.value && String(r.value).trim());
  const rightRows = right.filter((r) => r.value && String(r.value).trim());
  const rowCount = Math.max(leftRows.length, rightRows.length, 1);
  const rowH = 16;
  const boxH = rowCount * rowH + 4;
  const midX = MARGIN + CONTENT_W / 2;

  strokeRect(doc, MARGIN, startY, CONTENT_W, boxH);
  drawVLine(doc, midX, startY, startY + boxH);

  for (let i = 0; i < rowCount; i++) {
    const y = startY + 3 + i * rowH;
    if (i > 0) drawHLine(doc, MARGIN, PAGE_W - MARGIN, y - 2);
    const L = leftRows[i];
    const R = rightRows[i];
    if (L) {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(BLACK).text(`${L.label}:`, MARGIN + 6, y, { width: 90 });
      doc.font('Helvetica').text(String(L.value), MARGIN + 96, y, { width: midX - MARGIN - 104 });
    }
    if (R) {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(BLACK).text(`${R.label}:`, midX + 6, y, { width: 110 });
      doc.font('Helvetica').text(String(R.value), midX + 116, y, { width: PAGE_W - MARGIN - midX - 124 });
    }
  }
  return startY + boxH;
}

/** Bill To | Ship To party boxes. */
export function drawBillShipTo(
  doc: PDFDoc,
  startY: number,
  billTo: PartyBlock,
  shipTo?: PartyBlock | null,
): number {
  const boxH = 88;
  const midX = MARGIN + CONTENT_W / 2;
  strokeRect(doc, MARGIN, startY, CONTENT_W, boxH);
  drawVLine(doc, midX, startY, startY + boxH);
  drawHLine(doc, MARGIN, PAGE_W - MARGIN, startY + 16);
  doc.rect(MARGIN, startY, CONTENT_W / 2, 16).fill(HEADER_GRAY);
  doc.rect(midX, startY, CONTENT_W / 2, 16).fill(HEADER_GRAY);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(BLACK)
    .text('Bill To', MARGIN + 6, startY + 3, { width: CONTENT_W / 2 - 12 })
    .text('Ship To', midX + 6, startY + 3, { width: CONTENT_W / 2 - 12 });

  const writeParty = (party: PartyBlock, x: number) => {
    let y = startY + 20;
    const w = CONTENT_W / 2 - 14;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(BLACK).text(party.name, x, y, { width: w });
    y = doc.y + 1;
    doc.font('Helvetica').fontSize(7.5);
    if (party.address) {
      doc.text(party.address, x, y, { width: w });
      y = doc.y + 1;
    }
    if (party.gstin) {
      doc.text(`GSTIN: ${party.gstin}`, x, y, { width: w });
      y = doc.y + 1;
    }
    if (party.pan) {
      doc.text(`PAN: ${party.pan}`, x, y, { width: w });
      y = doc.y + 1;
    }
    if (party.phone) doc.text(`PH: ${party.phone}`, x, y, { width: w });
  };

  writeParty(billTo, MARGIN + 6);
  writeParty(shipTo ?? billTo, midX + 6);
  return startY + boxH;
}

export type LineCol = { title: string; width: number; align?: 'left' | 'right' | 'center' };

export function drawGridTable(
  doc: PDFDoc,
  startY: number,
  cols: LineCol[],
  rows: string[][],
): number {
  const headerH = 28;
  const rowH = 16;
  let y = startY;
  const totalW = cols.reduce((s, c) => s + c.width, 0);

  // Header (two-line capable for CGST/SGST)
  doc.rect(MARGIN, y, totalW, headerH).fill(HEADER_GRAY);
  strokeRect(doc, MARGIN, y, totalW, headerH);
  let x = MARGIN;
  cols.forEach((c) => {
    drawVLine(doc, x, y, y + headerH);
    doc.font('Helvetica-Bold').fontSize(7).fillColor(BLACK).text(c.title, x + 2, y + 8, {
      width: c.width - 4,
      align: c.align ?? 'center',
    });
    x += c.width;
  });
  y += headerH;

  rows.forEach((cells) => {
    if (y > doc.page.height - 120) {
      doc.addPage();
      y = MARGIN;
    }
    strokeRect(doc, MARGIN, y, totalW, rowH);
    let cx = MARGIN;
    cells.forEach((cell, i) => {
      const col = cols[i];
      drawVLine(doc, cx, y, y + rowH);
      doc.font('Helvetica').fontSize(7).fillColor(BLACK).text(cell ?? '', cx + 2, y + 4, {
        width: col.width - 4,
        align: col.align ?? 'left',
      });
      cx += col.width;
    });
    y += rowH;
  });

  return y;
}

export function drawTotalsAndWords(
  doc: PDFDoc,
  startY: number,
  opts: {
    amountWords: string;
    lines: Array<{ label: string; value: string; bold?: boolean }>;
  },
): number {
  const boxH = Math.max(72, opts.lines.length * 14 + 20);
  const midX = MARGIN + CONTENT_W * 0.55;
  strokeRect(doc, MARGIN, startY, CONTENT_W, boxH);
  drawVLine(doc, midX, startY, startY + boxH);

  doc.font('Helvetica-Bold').fontSize(8).fillColor(BLACK).text('Total In Words:', MARGIN + 6, startY + 8, {
    width: midX - MARGIN - 12,
  });
  doc.font('Helvetica').fontSize(8).text(opts.amountWords, MARGIN + 6, startY + 22, {
    width: midX - MARGIN - 12,
  });
  doc.font('Helvetica-Oblique').fontSize(8).fillColor(MUTED).text('Thanks for business.', MARGIN + 6, startY + boxH - 18);

  let y = startY + 8;
  for (const line of opts.lines) {
    doc.font(line.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor(BLACK)
      .text(line.label, midX + 6, y, { width: 90 })
      .text(line.value, midX + 96, y, { width: PAGE_W - MARGIN - midX - 104, align: 'right' });
    y += 14;
  }
  return startY + boxH;
}

export function drawPayToAndSignature(
  doc: PDFDoc,
  startY: number,
  company: InventoryPdfCompany,
): number {
  const bankLines: string[] = [];
  if (company.bankAccountNo) bankLines.push(`Account No: ${company.bankAccountNo}`);
  if (company.bankBeneficiaryName) bankLines.push(`Beneficiary Name: ${company.bankBeneficiaryName}`);
  if (company.bankName) bankLines.push(`Bank Name: ${company.bankName}`);
  if (company.bankBranch) bankLines.push(`Branch Name: ${company.bankBranch}`);
  if (company.bankIfsc) bankLines.push(`IFSC Code: ${company.bankIfsc}`);

  const boxH = Math.max(70, bankLines.length * 12 + 28);
  const midX = MARGIN + CONTENT_W * 0.55;
  strokeRect(doc, MARGIN, startY, CONTENT_W, boxH);
  drawVLine(doc, midX, startY, startY + boxH);

  if (bankLines.length > 0) {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(BLACK).text('Please Pay To:', MARGIN + 6, startY + 8);
    let y = startY + 22;
    doc.font('Helvetica').fontSize(7.5);
    for (const line of bankLines) {
      doc.text(line, MARGIN + 6, y, { width: midX - MARGIN - 12 });
      y += 12;
    }
  }

  doc.font('Helvetica-Bold').fontSize(8).fillColor(BLACK).text(`For ${company.name}`, midX + 6, startY + 8, {
    width: PAGE_W - MARGIN - midX - 12,
    align: 'center',
  });
  doc.font('Helvetica').fontSize(8).text('Authorized Signature', midX + 6, startY + boxH - 18, {
    width: PAGE_W - MARGIN - midX - 12,
    align: 'center',
  });

  return startY + boxH;
}

export function drawDeclarationFooter(
  doc: PDFDoc,
  startY: number,
  company: InventoryPdfCompany,
): number {
  let y = startY + 8;
  if (company.pan) {
    doc.font('Helvetica').fontSize(8).fillColor(BLACK).text(`Company's PAN: ${company.pan}`, MARGIN, y);
    y = doc.y + 6;
  }
  doc.font('Helvetica-Bold').fontSize(8).text('Declaration', MARGIN, y);
  y = doc.y + 2;
  doc.font('Helvetica').fontSize(7).fillColor(BLACK).text(
    'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
    MARGIN,
    y,
    { width: CONTENT_W },
  );
  y = doc.y + 8;
  doc.font('Helvetica').fontSize(6.5).fillColor(MUTED).text(
    'Terms & Conditions: 1) Subject to local jurisdiction. 2) Goods once sold will not be taken back. 3) Seller is not responsible after delivery. 4) Interest @ 18% p.a. may apply on delayed payments.',
    MARGIN,
    y,
    { width: CONTENT_W },
  );
  y = doc.y + 10;
  strokeRect(doc, MARGIN + 80, y, CONTENT_W - 160, 18);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(BLACK).text('This is Computer Generated Invoice', MARGIN + 80, y + 4, {
    width: CONTENT_W - 160,
    align: 'center',
  });
  return y + 24;
}

export { money, MARGIN, PAGE_W, CONTENT_W, BLACK, HEADER_GRAY };
