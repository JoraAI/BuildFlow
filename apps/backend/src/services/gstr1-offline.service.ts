/**
 * GSTR-1 builders matching GST Returns Offline Tool section-wise CSV + portal JSON.
 * Templates taken from gst_offline_tool.zip (Section_wise_CSV_files/GSTR1).
 */
import { PassThrough } from 'stream';
import archiver from 'archiver';
import { INDIAN_STATES, STATE_BY_CODE } from '@buildflow/shared';

export type OfflinePackInvoice = {
  number: string;
  date: string;
  clientName?: string;
  clientGstin?: string | null;
  clientState?: string | null;
  gstRate: number;
  total: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  bucket?: 'B2B' | 'B2C';
  lines?: Array<{
    description: string;
    qty: number;
    taxable: number;
    gstRate: number;
    hsn: string | null;
  }>;
};

export type OfflinePackNote = {
  number: string;
  date: string;
  partyName: string;
  partyGstin: string | null;
  taxable: number;
  total: number;
  gst: number;
  cgst: number;
  sgst: number;
  igst: number;
  lines?: Array<{ gstRate: number; taxable: number; hsn: string | null; qty: number }>;
};

export type OfflinePackGst = {
  invoices: OfflinePackInvoice[];
  creditNotes: OfflinePackNote[];
  debitNotes: OfflinePackNote[];
};

const STATE_CODE_BY_NAME = new Map(INDIAN_STATES.map((s) => [s.name.toUpperCase(), s.code]));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers.join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\n');
}

/** Offline tool CSV dates look like 14-Jul-17. */
export function formatOfflineCsvDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  return `${String(d).padStart(2, '0')}-${MONTHS[m - 1]}-${String(y).slice(-2)}`;
}

/** Portal / offline JSON dates: DD-MM-YYYY. */
export function formatJsonDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  if (!y || !m || !d) return isoDate;
  return `${d}-${m}-${y}`;
}

export function fpFromPeriodEnd(periodEnd: string): string {
  const [y, m] = periodEnd.split('-');
  return `${m}${y}`;
}

export function resolveStateCode(
  stateOrCode: string | null | undefined,
  gstin?: string | null,
): string {
  const fromGstin = gstin?.trim().slice(0, 2);
  if (fromGstin && /^\d{2}$/.test(fromGstin)) return fromGstin;
  const s = (stateOrCode ?? '').trim();
  if (/^\d{2}$/.test(s)) return s;
  if (/^\d{2}-/.test(s)) return s.slice(0, 2);
  return STATE_CODE_BY_NAME.get(s.toUpperCase()) ?? '';
}

/** Offline CSV Place Of Supply: "27-Maharashtra". */
export function placeOfSupplyLabel(
  stateOrCode: string | null | undefined,
  gstin?: string | null,
): string {
  const code = resolveStateCode(stateOrCode, gstin);
  if (!code) return '';
  const name = STATE_BY_CODE[code] ?? code;
  return `${code}-${name}`;
}

function b2clThreshold(periodEnd: string): number {
  // Offline tool: ₹2.5L before Aug-2024, ₹1L from Aug-2024 onwards.
  const [y, m] = periodEnd.split('-').map(Number);
  if (!y || !m) return 100000;
  if (y > 2024 || (y === 2024 && m >= 8)) return 100000;
  return 250000;
}

function invoiceRateRows(inv: OfflinePackInvoice): Array<{ rate: number; taxable: number }> {
  if (inv.lines && inv.lines.length > 0) {
    const byRate = new Map<number, number>();
    for (const li of inv.lines) {
      byRate.set(li.gstRate, (byRate.get(li.gstRate) ?? 0) + li.taxable);
    }
    return [...byRate.entries()].map(([rate, taxable]) => ({ rate, taxable }));
  }
  return [{ rate: inv.gstRate, taxable: inv.taxable }];
}

function noteRateRows(note: OfflinePackNote): Array<{ rate: number; taxable: number }> {
  if (note.lines && note.lines.length > 0) {
    const byRate = new Map<number, number>();
    for (const li of note.lines) {
      byRate.set(li.gstRate, (byRate.get(li.gstRate) ?? 0) + li.taxable);
    }
    return [...byRate.entries()].map(([rate, taxable]) => ({ rate, taxable }));
  }
  const rate =
    note.taxable > 0 ? Number((((note.cgst + note.sgst + note.igst) / note.taxable) * 100).toFixed(2)) : 0;
  return [{ rate, taxable: note.taxable }];
}

type HsnBucket = {
  hsn: string;
  qty: number;
  taxable: number;
  iamt: number;
  camt: number;
  samt: number;
  rate: number;
};

function accumulateHsn(
  map: Map<string, HsnBucket>,
  hsn: string | null | undefined,
  qty: number,
  taxable: number,
  rate: number,
  taxes: { igst: number; cgst: number; sgst: number },
) {
  const code = (hsn ?? '').trim();
  if (!code) return;
  const key = `${code}|${rate}`;
  const cur = map.get(key) ?? {
    hsn: code,
    qty: 0,
    taxable: 0,
    iamt: 0,
    camt: 0,
    samt: 0,
    rate,
  };
  cur.qty += qty;
  cur.taxable += taxable;
  cur.iamt += taxes.igst;
  cur.camt += taxes.cgst;
  cur.samt += taxes.sgst;
  map.set(key, cur);
}

function lineTaxSplit(
  taxable: number,
  rate: number,
  inv: { igst: number; cgst: number; sgst: number },
): { igst: number; cgst: number; sgst: number } {
  const tax = (taxable * rate) / 100;
  if (inv.igst > 0 && inv.cgst + inv.sgst <= 0) {
    return { igst: tax, cgst: 0, sgst: 0 };
  }
  return { igst: 0, cgst: tax / 2, sgst: tax / 2 };
}

function buildHsnMaps(gst: OfflinePackGst) {
  const b2b = new Map<string, HsnBucket>();
  const b2c = new Map<string, HsnBucket>();
  for (const inv of gst.invoices) {
    const target = inv.bucket === 'B2B' ? b2b : b2c;
    const lines =
      inv.lines && inv.lines.length > 0
        ? inv.lines
        : [
            {
              hsn: null as string | null,
              qty: 0,
              taxable: inv.taxable,
              gstRate: inv.gstRate,
            },
          ];
    for (const li of lines) {
      accumulateHsn(
        target,
        li.hsn,
        li.qty,
        li.taxable,
        li.gstRate,
        lineTaxSplit(li.taxable, li.gstRate, inv),
      );
    }
  }
  return { b2b, b2c };
}

function hsnCsvRows(map: Map<string, HsnBucket>): unknown[][] {
  return [...map.values()].map((h) => [
    h.hsn,
    '',
    h.hsn.startsWith('99') ? 'NA-OTHERS' : 'OTH-OTHERS',
    Number(h.qty.toFixed(3)),
    Number((h.taxable + h.iamt + h.camt + h.samt).toFixed(2)),
    Number(h.taxable.toFixed(2)),
    Number(h.iamt.toFixed(2)),
    Number(h.camt.toFixed(2)),
    Number(h.samt.toFixed(2)),
    0,
    h.rate,
  ]);
}

const HSN_HEADERS = [
  'HSN',
  'Description',
  'UQC',
  'Total Quantity',
  'Total Value',
  'Taxable Value',
  'Integrated Tax Amount',
  'Central Tax Amount',
  'State/UT Tax Amount',
  'Cess Amount',
  'Rate',
] as const;

export function buildGstr1OfflineSectionFiles(opts: {
  gst: OfflinePackGst;
  periodEnd: string;
  supplierStateCode: string;
}): Array<{ name: string; content: string }> {
  const { gst, periodEnd, supplierStateCode } = opts;
  const threshold = b2clThreshold(periodEnd);

  const b2bRows: unknown[][] = [];
  const b2clRows: unknown[][] = [];
  const b2csAgg = new Map<string, { typ: string; pos: string; rate: number; taxable: number }>();

  for (const inv of gst.invoices) {
    const pos = placeOfSupplyLabel(inv.clientState, inv.clientGstin);
    const posCode = resolveStateCode(inv.clientState, inv.clientGstin);
    const date = formatOfflineCsvDate(inv.date);
    const rates = invoiceRateRows(inv);

    if (inv.bucket === 'B2B' && inv.clientGstin?.trim()) {
      for (const r of rates) {
        b2bRows.push([
          inv.clientGstin.trim().toUpperCase(),
          inv.clientName ?? '',
          inv.number,
          date,
          inv.total,
          pos,
          'N',
          '',
          'Regular B2B',
          '',
          r.rate,
          Number(r.taxable.toFixed(2)),
          '',
        ]);
      }
      continue;
    }

    const isInter = Boolean(posCode && supplierStateCode && posCode !== supplierStateCode);
    if (isInter && inv.total > threshold) {
      for (const r of rates) {
        b2clRows.push([
          inv.number,
          date,
          inv.total,
          pos,
          '',
          r.rate,
          Number(r.taxable.toFixed(2)),
          '',
          '',
        ]);
      }
    } else {
      for (const r of rates) {
        const typ = 'OE';
        const key = `${typ}|${pos}|${r.rate}`;
        const cur = b2csAgg.get(key) ?? { typ, pos, rate: r.rate, taxable: 0 };
        cur.taxable += r.taxable;
        b2csAgg.set(key, cur);
      }
    }
  }

  const b2csRows = [...b2csAgg.values()].map((r) => [
    r.typ,
    r.pos,
    r.rate,
    '',
    Number(r.taxable.toFixed(2)),
    '',
    '',
  ]);

  const cdnrRows: unknown[][] = [];
  const cdnurRows: unknown[][] = [];

  const pushNotes = (notes: OfflinePackNote[], noteType: 'C' | 'D') => {
    for (const n of notes) {
      const date = formatOfflineCsvDate(n.date);
      const rates = noteRateRows(n);
      const gstin = n.partyGstin?.trim();
      if (gstin) {
        const pos = placeOfSupplyLabel(null, gstin);
        for (const r of rates) {
          cdnrRows.push([
            gstin.toUpperCase(),
            n.partyName,
            n.number,
            date,
            noteType,
            pos,
            'N',
            'Regular B2B',
            n.total,
            '',
            r.rate,
            Number(r.taxable.toFixed(2)),
            '',
          ]);
        }
      } else {
        for (const r of rates) {
          cdnurRows.push([
            Math.abs(n.total) > threshold ? 'B2CL' : 'B2CS',
            n.number,
            date,
            noteType,
            '',
            n.total,
            '',
            r.rate,
            Number(r.taxable.toFixed(2)),
            '',
          ]);
        }
      }
    }
  };
  pushNotes(gst.creditNotes, 'C');
  pushNotes(gst.debitNotes, 'D');

  const { b2b: hsnB2b, b2c: hsnB2c } = buildHsnMaps(gst);

  const invNumbers = gst.invoices.map((i) => i.number).filter(Boolean).sort();
  const docsRows: unknown[][] = [
    [
      'Invoices for outward supply',
      invNumbers[0] ?? '',
      invNumbers[invNumbers.length - 1] ?? '',
      invNumbers.length,
      0,
    ],
  ];

  return [
    {
      name: 'b2b,sez,de.csv',
      content: toCsv(
        [
          'GSTIN/UIN of Recipient',
          'Receiver Name',
          'Invoice Number',
          'Invoice date',
          'Invoice Value',
          'Place Of Supply',
          'Reverse Charge',
          'Applicable % of Tax Rate',
          'Invoice Type',
          'E-Commerce GSTIN',
          'Rate',
          'Taxable Value',
          'Cess Amount',
        ],
        b2bRows,
      ),
    },
    {
      name: 'b2cl.csv',
      content: toCsv(
        [
          'Invoice Number',
          'Invoice date',
          'Invoice Value',
          'Place Of Supply',
          'Applicable % of Tax Rate',
          'Rate',
          'Taxable Value',
          'Cess Amount',
          'E-Commerce GSTIN',
        ],
        b2clRows,
      ),
    },
    {
      name: 'b2cs.csv',
      content: toCsv(
        [
          'Type',
          'Place Of Supply',
          'Rate',
          'Applicable % of Tax Rate',
          'Taxable Value',
          'Cess Amount',
          'E-Commerce GSTIN',
        ],
        b2csRows,
      ),
    },
    {
      name: 'cdnr.csv',
      content: toCsv(
        [
          'GSTIN/UIN of Recipient',
          'Receiver Name',
          'Note Number',
          'Note Date',
          'Note Type',
          'Place Of Supply',
          'Reverse Charge',
          'Note Supply Type',
          'Note Value',
          'Applicable % of Tax Rate',
          'Rate',
          'Taxable Value',
          'Cess Amount',
        ],
        cdnrRows,
      ),
    },
    {
      name: 'cdnur.csv',
      content: toCsv(
        [
          'UR Type',
          'Note Number',
          'Note Date',
          'Note Type',
          'Place Of Supply',
          'Note Value',
          'Applicable % of Tax Rate',
          'Rate',
          'Taxable Value',
          'Cess Amount',
        ],
        cdnurRows,
      ),
    },
    {
      name: 'hsn(b2b).csv',
      content: toCsv([...HSN_HEADERS], hsnCsvRows(hsnB2b)),
    },
    {
      name: 'hsn(b2c).csv',
      content: toCsv([...HSN_HEADERS], hsnCsvRows(hsnB2c)),
    },
    {
      name: 'docs.csv',
      content: toCsv(
        ['Nature of Document', 'Sr. No. From', 'Sr. No. To', 'Total Number', 'Cancelled'],
        docsRows,
      ),
    },
  ];
}

export async function zipSectionFiles(
  files: Array<{ name: string; content: string }>,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 6 } });
    const stream = new PassThrough();
    const chunks: Buffer[] = [];
    stream.on('data', (c: Buffer) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);
    archive.pipe(stream);
    for (const f of files) {
      archive.append(f.content, { name: f.name });
    }
    void archive.finalize();
  });
}

/** Portal / Offline Tool JSON (importable after Generate File flow). */
export function buildGstr1OfflineJson(opts: {
  gstin: string;
  periodEnd: string;
  gst: OfflinePackGst;
  supplierStateCode: string;
}): Record<string, unknown> {
  const { gstin, periodEnd, gst, supplierStateCode } = opts;
  const threshold = b2clThreshold(periodEnd);
  const b2bMap = new Map<string, Array<Record<string, unknown>>>();
  const b2cs: Array<Record<string, unknown>> = [];
  const b2cl: Array<Record<string, unknown>> = [];

  for (const inv of gst.invoices) {
    const pos = resolveStateCode(inv.clientState, inv.clientGstin) || '00';
    const rates = invoiceRateRows(inv);
    const itms = rates.map((r, idx) => {
      const tax = (r.taxable * r.rate) / 100;
      const inter = inv.igst > 0 && inv.cgst + inv.sgst <= 0;
      return {
        num: idx + 1,
        itm_det: {
          txval: Number(r.taxable.toFixed(2)),
          rt: r.rate,
          camt: inter ? 0 : Number((tax / 2).toFixed(2)),
          samt: inter ? 0 : Number((tax / 2).toFixed(2)),
          iamt: inter ? Number(tax.toFixed(2)) : 0,
          csamt: 0,
        },
      };
    });

    if (inv.bucket === 'B2B' && inv.clientGstin?.trim()) {
      const ctin = inv.clientGstin.trim().toUpperCase();
      const rows = b2bMap.get(ctin) ?? [];
      rows.push({
        inum: inv.number,
        idt: formatJsonDate(inv.date),
        val: inv.total,
        pos,
        rchrg: 'N',
        inv_typ: 'R',
        itms,
      });
      b2bMap.set(ctin, rows);
      continue;
    }

    const isInter = Boolean(pos && supplierStateCode && pos !== supplierStateCode);
    if (isInter && inv.total > threshold) {
      b2cl.push({
        inum: inv.number,
        idt: formatJsonDate(inv.date),
        val: inv.total,
        pos,
        itms,
      });
    } else {
      for (const r of rates) {
        const tax = (r.taxable * r.rate) / 100;
        const inter = isInter;
        b2cs.push({
          sply_ty: inter ? 'INTER' : 'INTRA',
          pos,
          typ: 'OE',
          txval: Number(r.taxable.toFixed(2)),
          rt: r.rate,
          camt: inter ? 0 : Number((tax / 2).toFixed(2)),
          samt: inter ? 0 : Number((tax / 2).toFixed(2)),
          iamt: inter ? Number(tax.toFixed(2)) : 0,
          csamt: 0,
        });
      }
    }
  }

  const cdnrMap = new Map<string, Array<Record<string, unknown>>>();
  const cdnur: Array<Record<string, unknown>> = [];

  const pushJsonNotes = (notes: OfflinePackNote[], ntty: 'C' | 'D') => {
    for (const n of notes) {
      const rates = noteRateRows(n);
      const itms = rates.map((r, idx) => {
        const tax = (r.taxable * r.rate) / 100;
        const inter = n.igst > 0 && n.cgst + n.sgst <= 0;
        return {
          num: idx + 1,
          itm_det: {
            txval: Number(r.taxable.toFixed(2)),
            rt: r.rate,
            camt: inter ? 0 : Number((tax / 2).toFixed(2)),
            samt: inter ? 0 : Number((tax / 2).toFixed(2)),
            iamt: inter ? Number(tax.toFixed(2)) : 0,
            csamt: 0,
          },
        };
      });
      const ctin = n.partyGstin?.trim();
      if (ctin) {
        const rows = cdnrMap.get(ctin.toUpperCase()) ?? [];
        rows.push({
          ntty,
          nt_num: n.number,
          nt_dt: formatJsonDate(n.date),
          val: n.total,
          pos: resolveStateCode(null, ctin) || '00',
          rsn: '01',
          p_gst: 'N',
          itms,
        });
        cdnrMap.set(ctin.toUpperCase(), rows);
      } else {
        cdnur.push({
          typ: Math.abs(n.total) > threshold ? 'B2CL' : 'B2CS',
          ntty,
          nt_num: n.number,
          nt_dt: formatJsonDate(n.date),
          val: n.total,
          rsn: '01',
          p_gst: 'N',
          itms,
        });
      }
    }
  };
  pushJsonNotes(gst.creditNotes, 'C');
  pushJsonNotes(gst.debitNotes, 'D');

  const { b2b: hsnB2b, b2c: hsnB2c } = buildHsnMaps(gst);
  const toHsnJson = (map: Map<string, HsnBucket>) =>
    [...map.values()].map((h, i) => ({
      num: i + 1,
      hsn_sc: h.hsn,
      desc: '',
      uqc: h.hsn.startsWith('99') ? 'NA' : 'OTH',
      qty: h.hsn.startsWith('99') ? 0 : Number(h.qty.toFixed(3)),
      rt: h.rate,
      txval: Number(h.taxable.toFixed(2)),
      iamt: Number(h.iamt.toFixed(2)),
      camt: Number(h.camt.toFixed(2)),
      samt: Number(h.samt.toFixed(2)),
      csamt: 0,
    }));

  const invNumbers = gst.invoices.map((i) => i.number).filter(Boolean).sort();

  return {
    gstin: gstin.toUpperCase(),
    fp: fpFromPeriodEnd(periodEnd),
    version: 'GST3.2.4',
    hash: 'hash',
    b2b: [...b2bMap.entries()].map(([ctin, inv]) => ({ ctin, inv })),
    b2cl,
    b2cs,
    cdnr: [...cdnrMap.entries()].map(([ctin, nt]) => ({ ctin, nt })),
    cdnur,
    hsn: {
      hsn_b2b: toHsnJson(hsnB2b),
      hsn_b2c: toHsnJson(hsnB2c),
    },
    doc_issue: {
      doc_det: [
        {
          doc_num: 1,
          docs: [
            {
              num: 1,
              from: invNumbers[0] ?? '',
              to: invNumbers[invNumbers.length - 1] ?? '',
              totnum: invNumbers.length,
              cancel: 0,
              net_issue: invNumbers.length,
            },
          ],
        },
      ],
    },
  };
}
