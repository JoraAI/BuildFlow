/**
 * Inventory auditor multi-shop membership + GST handoff packs.
 */
import { GstHandoffStatus, Prisma, Role } from '@prisma/client';
import {
  MAX_INVENTORY_AUDITORS,
  getGstTaxCodeLabels,
  type AuditorManualEntryInput,
  type CreateGstHandoffPackInput,
  type UpdateGstHandoffPackDraftInput,
  type UpdateGstHandoffPackStatusInput,
} from '@buildflow/shared';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { recordAudit } from '../utils/audit';
import {
  buildGstr1OfflineJson,
  buildGstr1OfflineSectionFiles,
  resolveStateCode,
  zipSectionFiles,
} from './gstr1-offline.service';

export async function countAuditorsForCompany(companyId: string): Promise<number> {
  const [users, pending] = await Promise.all([
    prisma.auditorMembership.count({ where: { companyId, isActive: true } }),
    prisma.userInvite.count({
      where: {
        companyId,
        role: Role.AUDITOR,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    }),
  ]);
  return users + pending;
}

export async function assertAuditorSlotAvailable(companyId: string): Promise<void> {
  const n = await countAuditorsForCompany(companyId);
  if (n >= MAX_INVENTORY_AUDITORS) {
    throw ApiError.conflict(`This shop already has ${MAX_INVENTORY_AUDITORS} auditors`);
  }
}

export async function ensureAuditorMembership(opts: {
  userId: string;
  companyId: string;
  invitedById?: string | null;
}): Promise<void> {
  await prisma.auditorMembership.upsert({
    where: { userId_companyId: { userId: opts.userId, companyId: opts.companyId } },
    create: {
      userId: opts.userId,
      companyId: opts.companyId,
      invitedById: opts.invitedById ?? null,
      isActive: true,
    },
    update: { isActive: true, invitedById: opts.invitedById ?? undefined },
  });
}

export async function listAuditorMemberships(userId: string) {
  const rows = await prisma.auditorMembership.findMany({
    where: { userId, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: {
      companyId: true,
      company: {
        select: {
          id: true,
          name: true,
          inventoryVertical: true,
          inventoryProfile: true,
          subscriptionPlan: true,
        },
      },
    },
  });

  const companyIds = rows.map((r) => r.company.id);
  const openPacks =
    companyIds.length === 0
      ? []
      : await prisma.gstHandoffPack.groupBy({
          by: ['companyId'],
          where: {
            companyId: { in: companyIds },
            status: { in: [GstHandoffStatus.SENT, GstHandoffStatus.IN_PROGRESS] },
          },
          _count: { _all: true },
        });
  const openByCompany = new Map(openPacks.map((r) => [r.companyId, r._count._all]));

  return rows.map((r) => ({
    companyId: r.company.id,
    companyName: r.company.name,
    inventoryVertical: r.company.inventoryVertical,
    inventoryProfile: r.company.inventoryProfile,
    subscriptionPlan: r.company.subscriptionPlan,
    openPackCount: openByCompany.get(r.company.id) ?? 0,
  }));
}

export async function revokeAuditorMembership(
  companyId: string,
  userId: string,
  actorId: string,
): Promise<void> {
  const membership = await prisma.auditorMembership.findUnique({
    where: { userId_companyId: { userId, companyId } },
  });
  if (!membership?.isActive) throw ApiError.notFound('Auditor not found on this shop');

  await prisma.auditorMembership.update({
    where: { id: membership.id },
    data: { isActive: false },
  });

  const remaining = await prisma.auditorMembership.count({
    where: { userId, isActive: true },
  });
  if (remaining === 0) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        email: `deleted.${userId.replace(/-/g, '')}@deleted.buildflow.local`,
        phone: null,
      },
    });
  } else if (
    (
      await prisma.user.findUnique({
        where: { id: userId },
        select: { companyId: true },
      })
    )?.companyId === companyId
  ) {
    const next = await prisma.auditorMembership.findFirst({
      where: { userId, isActive: true },
      select: { companyId: true },
    });
    if (next) {
      await prisma.user.update({ where: { id: userId }, data: { companyId: next.companyId } });
    }
  }

  await recordAudit({
    companyId,
    userId: actorId,
    action: 'DELETE',
    entityType: 'auditor_membership',
    entityId: membership.id,
    oldValue: { userId },
  });
}

function monthLabel(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  const a = fmt(start);
  const b = fmt(end);
  return a === b ? a : `${a} – ${b}`;
}

export async function createGstHandoffPack(
  companyId: string,
  actorId: string,
  input: CreateGstHandoffPackInput,
) {
  const periodStart = new Date(`${input.periodStart}T00:00:00.000Z`);
  const periodEnd = new Date(`${input.periodEnd}T00:00:00.000Z`);
  if (periodEnd < periodStart) throw ApiError.badRequest('periodEnd must be on or after periodStart');

  const pack = await prisma.gstHandoffPack.create({
    data: {
      companyId,
      periodStart,
      periodEnd,
      label: input.label?.trim() || monthLabel(periodStart, periodEnd),
      notes: input.notes ?? null,
      status: GstHandoffStatus.DRAFT,
    },
  });
  await recordAudit({
    companyId,
    userId: actorId,
    action: 'CREATE',
    entityType: 'gst_handoff_pack',
    entityId: pack.id,
    newValue: { label: pack.label, periodStart: input.periodStart, periodEnd: input.periodEnd },
  });
  return serializePack(pack);
}

export async function deleteDraftPack(companyId: string, packId: string, actorId: string) {
  const pack = await prisma.gstHandoffPack.findFirst({ where: { id: packId, companyId } });
  if (!pack) throw ApiError.notFound('Pack not found');
  if (pack.status !== GstHandoffStatus.DRAFT) {
    throw ApiError.badRequest('Only draft packs can be deleted');
  }
  await prisma.gstHandoffPack.delete({ where: { id: packId } });
  await recordAudit({
    companyId,
    userId: actorId,
    action: 'DELETE',
    entityType: 'gst_handoff_pack',
    entityId: packId,
  });
  return { deleted: true as const };
}

export async function updateGstHandoffPackDraft(
  companyId: string,
  packId: string,
  actorId: string,
  input: UpdateGstHandoffPackDraftInput,
) {
  const pack = await prisma.gstHandoffPack.findFirst({ where: { id: packId, companyId } });
  if (!pack) throw ApiError.notFound('Pack not found');
  if (pack.status !== GstHandoffStatus.DRAFT) {
    throw ApiError.badRequest('Only draft packs can be edited');
  }
  const updated = await prisma.gstHandoffPack.update({
    where: { id: packId },
    data: {
      ...(input.label !== undefined ? { label: input.label.trim() } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.openingCashBalance !== undefined
        ? { openingCashBalance: input.openingCashBalance }
        : {}),
    },
  });
  await recordAudit({
    companyId,
    userId: actorId,
    action: 'UPDATE',
    entityType: 'gst_handoff_pack',
    entityId: packId,
    newValue: {
      label: updated.label,
      notes: updated.notes,
      openingCashBalance:
        updated.openingCashBalance == null ? null : Number(updated.openingCashBalance),
    },
  });
  return serializePack(updated);
}

export async function sendGstHandoffPack(companyId: string, packId: string, actorId: string) {
  const pack = await prisma.gstHandoffPack.findFirst({ where: { id: packId, companyId } });
  if (!pack) throw ApiError.notFound('Pack not found');
  if (pack.status !== GstHandoffStatus.DRAFT) {
    throw ApiError.badRequest('Only draft packs can be sent');
  }
  if (pack.openingCashBalance == null) {
    throw ApiError.badRequest('Enter opening cash/bank for the period start before sending');
  }

  const detail = await buildPackSlices(companyId, packId, pack.periodStart, pack.periodEnd);
  const opening = Number(pack.openingCashBalance);
  const bankClosing = opening + detail.bankIn - detail.bankOut;
  const companyMeta = await prisma.company.findUnique({
    where: { id: companyId },
    select: { inventoryVertical: true, inventoryProfile: true },
  });
  const taxCode = getGstTaxCodeLabels(companyMeta?.inventoryVertical, companyMeta?.inventoryProfile);
  const snapshot = {
    bank: detail.bank,
    journals: detail.journals,
    gst: detail.gst,
    openingCashBalance: opening,
    bankIn: detail.bankIn,
    bankOut: detail.bankOut,
    bankNet: detail.bankNet,
    bankClosing,
    // legacy key kept for older clients
    bankTotal: bankClosing,
    taxCode,
  };

  const updated = await prisma.gstHandoffPack.update({
    where: { id: packId },
    data: {
      status: GstHandoffStatus.SENT,
      sentAt: new Date(),
      sentById: actorId,
      snapshot: snapshot as Prisma.InputJsonValue,
    },
  });
  await recordAudit({
    companyId,
    userId: actorId,
    action: 'SEND',
    entityType: 'gst_handoff_pack',
    entityId: packId,
  });
  return {
    ...serializePack(updated),
    missingHsnLines: detail.gst.missingHsnLines,
    hsnWarning:
      detail.gst.missingHsnLines > 0
        ? `${detail.gst.missingHsnLines} sales lines missing HSN/SAC — auditors will flag this.`
        : null,
  };
}

export async function listOwnerPacks(companyId: string) {
  const rows = await prisma.gstHandoffPack.findMany({
    where: { companyId },
    orderBy: [{ periodEnd: 'desc' }, { createdAt: 'desc' }],
  });
  return rows.map(serializePack);
}

export async function listAuditorInbox(userId: string, companyId: string) {
  const membership = await prisma.auditorMembership.findUnique({
    where: { userId_companyId: { userId, companyId } },
  });
  if (!membership?.isActive) throw ApiError.forbidden('Not an auditor on this shop');

  const rows = await prisma.gstHandoffPack.findMany({
    where: {
      companyId,
      status: { in: [GstHandoffStatus.SENT, GstHandoffStatus.IN_PROGRESS, GstHandoffStatus.FILED] },
    },
    orderBy: [{ sentAt: 'desc' }, { createdAt: 'desc' }],
  });
  return rows.map(serializePack);
}

type PackRow = {
  id: string;
  companyId: string;
  periodStart: Date;
  periodEnd: Date;
  label: string;
  status: GstHandoffStatus;
  notes: string | null;
  openingCashBalance: Prisma.Decimal | number | null;
  snapshot: Prisma.JsonValue | null;
  sentAt: Date | null;
  filedAt: Date | null;
  createdAt: Date;
};

function addHsn(
  hsnMap: Map<string, { hsn: string; taxable: number; tax: number; qty: number; lineCount: number }>,
  hsnRaw: string | null | undefined,
  taxable: number,
  rate: number,
  qty: number,
): boolean {
  const hsn = hsnRaw?.trim() || '';
  const missing = !hsn;
  const key = hsn || '(missing)';
  const cur = hsnMap.get(key) ?? { hsn: key, taxable: 0, tax: 0, qty: 0, lineCount: 0 };
  cur.taxable += taxable;
  cur.tax += (taxable * rate) / 100;
  cur.qty += qty;
  cur.lineCount += 1;
  hsnMap.set(key, cur);
  return missing;
}

function parseBillSnapshotLines(snapshot: Prisma.JsonValue | null): Array<{
  description: string;
  qty: number;
  taxable: number;
  gstRate: number;
  hsn: string | null;
}> {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return [];
  const lines = (snapshot as { lines?: unknown }).lines;
  if (!Array.isArray(lines)) return [];
  return lines.map((raw, idx) => {
    const l = (raw ?? {}) as Record<string, unknown>;
    const qty = Number(l.quantity ?? l.qty ?? 0) || 0;
    const rate = Number(l.rate ?? l.unitRate ?? 0) || 0;
    const amount = Number(l.amount ?? qty * rate) || 0;
    const gstRate = Number(l.gstRate ?? l.gst ?? 0) || 0;
    const hsn = typeof l.hsn === 'string' ? l.hsn : typeof l.hsnSacCode === 'string' ? l.hsnSacCode : null;
    return {
      description: String(l.description ?? `Line ${idx + 1}`),
      qty,
      taxable: amount,
      gstRate,
      hsn: hsn?.trim() || null,
    };
  });
}

async function buildPackSlices(
  companyId: string,
  packId: string,
  periodStart: Date,
  periodEnd: Date,
) {
  const start = periodStart;
  const endExclusive = new Date(periodEnd);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

  const [bank, journals, invoices, bills, creditNotes, debitNotes, manualEntries] = await Promise.all([
    prisma.inventoryCashBookEntry.findMany({
      where: { companyId, entryDate: { gte: start, lt: endExclusive } },
      orderBy: { entryDate: 'asc' },
      select: {
        id: true,
        entryDate: true,
        paymentMode: true,
        amount: true,
        description: true,
        entryType: true,
        direction: true,
      },
    }),
    prisma.journalEntry.findMany({
      where: { companyId, entryDate: { gte: start, lt: endExclusive } },
      orderBy: { entryDate: 'asc' },
      select: {
        id: true,
        entryDate: true,
        description: true,
        debitAccount: true,
        creditAccount: true,
        amount: true,
        reference: true,
      },
    }),
    prisma.invoice.findMany({
      where: { companyId, invoiceDate: { gte: start, lt: endExclusive } },
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        clientName: true,
        clientGstin: true,
        clientState: true,
        gstRate: true,
        total: true,
        subtotal: true,
        cgstAmount: true,
        sgstAmount: true,
        igstAmount: true,
        gstAmount: true,
        lineItems: {
          select: {
            id: true,
            description: true,
            quantity: true,
            rate: true,
            amount: true,
            gstRate: true,
            hsnSacCode: true,
          },
        },
      },
    }),
    prisma.bill.findMany({
      where: { companyId, billDate: { gte: start, lt: endExclusive } },
      select: {
        id: true,
        billNumber: true,
        billDate: true,
        vendorName: true,
        vendorGstin: true,
        subtotal: true,
        total: true,
        gstAmount: true,
        billSnapshot: true,
      },
    }),
    prisma.creditNote.findMany({
      where: { companyId, status: 'ISSUED', creditDate: { gte: start, lt: endExclusive } },
      select: {
        id: true,
        creditNoteNumber: true,
        creditDate: true,
        customerName: true,
        subtotal: true,
        total: true,
        gstAmount: true,
        cgstAmount: true,
        sgstAmount: true,
        igstAmount: true,
        customer: { select: { gstin: true } },
        invoice: { select: { clientGstin: true, clientState: true, invoiceNumber: true } },
        lines: {
          select: {
            id: true,
            description: true,
            quantity: true,
            rate: true,
            amount: true,
            gstRate: true,
            resourceId: true,
          },
        },
      },
    }),
    prisma.debitNote.findMany({
      where: { companyId, status: 'ISSUED', debitDate: { gte: start, lt: endExclusive } },
      select: {
        id: true,
        debitNoteNumber: true,
        debitDate: true,
        vendorName: true,
        subtotal: true,
        total: true,
        gstAmount: true,
        cgstAmount: true,
        sgstAmount: true,
        igstAmount: true,
        vendor: { select: { gstin: true } },
        bill: { select: { vendorGstin: true, billNumber: true } },
        lines: {
          select: {
            id: true,
            description: true,
            quantity: true,
            rate: true,
            amount: true,
            gstRate: true,
            resourceId: true,
          },
        },
      },
    }),
    prisma.auditorManualEntry.findMany({
      where: { packId },
      orderBy: { entryDate: 'asc' },
      select: {
        id: true,
        entryType: true,
        entryDate: true,
        amount: true,
        narration: true,
        createdBy: { select: { name: true } },
        createdAt: true,
      },
    }),
  ]);

  // Credit/Debit note lines store resourceId without a Prisma relation — resolve HSN in one query.
  const noteResourceIds = [
    ...new Set(
      [...creditNotes, ...debitNotes]
        .flatMap((n) => n.lines.map((li) => li.resourceId))
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const noteResources =
    noteResourceIds.length === 0
      ? []
      : await prisma.resource.findMany({
          where: { id: { in: noteResourceIds }, companyId },
          select: { id: true, hsnSacCode: true },
        });
  const hsnByResourceId = new Map(
    noteResources.map((r) => [r.id, r.hsnSacCode?.trim() || null] as const),
  );

  const hsnMap = new Map<
    string,
    { hsn: string; taxable: number; tax: number; qty: number; lineCount: number }
  >();
  let missingHsnLines = 0;
  let b2bCount = 0;
  let b2cCount = 0;

  const invoiceRows = invoices.map((i) => {
    const hasGstin = Boolean(i.clientGstin?.trim());
    if (hasGstin) b2bCount += 1;
    else b2cCount += 1;

    const lines = i.lineItems.map((li) => {
      const taxable = Number(li.amount);
      const rate = Number(li.gstRate);
      if (addHsn(hsnMap, li.hsnSacCode, taxable, rate, Number(li.quantity))) missingHsnLines += 1;
      return {
        id: li.id,
        description: li.description,
        qty: Number(li.quantity),
        rate: Number(li.rate),
        taxable,
        gstRate: rate,
        hsn: li.hsnSacCode?.trim() || null,
      };
    });

    return {
      id: i.id,
      number: i.invoiceNumber,
      date: i.invoiceDate.toISOString().slice(0, 10),
      clientName: i.clientName,
      clientGstin: i.clientGstin,
      clientState: i.clientState,
      gstRate: Number(i.gstRate),
      total: Number(i.total),
      taxable: Number(i.subtotal ?? 0),
      cgst: Number(i.cgstAmount ?? 0),
      sgst: Number(i.sgstAmount ?? 0),
      igst: Number(i.igstAmount ?? 0),
      bucket: hasGstin ? ('B2B' as const) : ('B2C' as const),
      lines,
    };
  });

  const creditNoteRows = creditNotes.map((cn) => {
    const gstin = cn.customer?.gstin ?? cn.invoice?.clientGstin ?? null;
    const lines = cn.lines.map((li) => {
      const taxable = Number(li.amount);
      const rate = Number(li.gstRate);
      const hsn = li.resourceId ? hsnByResourceId.get(li.resourceId) ?? null : null;
      if (addHsn(hsnMap, hsn, taxable, rate, Number(li.quantity))) missingHsnLines += 1;
      return {
        id: li.id,
        description: li.description,
        qty: Number(li.quantity),
        rate: Number(li.rate),
        taxable,
        gstRate: rate,
        hsn,
      };
    });
    return {
      id: cn.id,
      number: cn.creditNoteNumber,
      date: cn.creditDate.toISOString().slice(0, 10),
      partyName: cn.customerName,
      partyGstin: gstin,
      againstInvoice: cn.invoice?.invoiceNumber ?? null,
      taxable: Number(cn.subtotal),
      total: Number(cn.total),
      gst: Number(cn.gstAmount),
      cgst: Number(cn.cgstAmount),
      sgst: Number(cn.sgstAmount),
      igst: Number(cn.igstAmount),
      lines,
    };
  });

  const debitNoteRows = debitNotes.map((dn) => {
    const gstin = dn.vendor?.gstin ?? dn.bill?.vendorGstin ?? null;
    const lines = dn.lines.map((li) => {
      const taxable = Number(li.amount);
      const rate = Number(li.gstRate);
      const hsn = li.resourceId ? hsnByResourceId.get(li.resourceId) ?? null : null;
      addHsn(hsnMap, hsn, taxable, rate, Number(li.quantity));
      return {
        id: li.id,
        description: li.description,
        qty: Number(li.quantity),
        rate: Number(li.rate),
        taxable,
        gstRate: rate,
        hsn,
      };
    });
    return {
      id: dn.id,
      number: dn.debitNoteNumber,
      date: dn.debitDate.toISOString().slice(0, 10),
      partyName: dn.vendorName,
      partyGstin: gstin,
      againstBill: dn.bill?.billNumber ?? null,
      taxable: Number(dn.subtotal),
      total: Number(dn.total),
      gst: Number(dn.gstAmount),
      cgst: Number(dn.cgstAmount),
      sgst: Number(dn.sgstAmount),
      igst: Number(dn.igstAmount),
      lines,
    };
  });

  const billRows = bills.map((b) => {
    const lines = parseBillSnapshotLines(b.billSnapshot);
    for (const li of lines) {
      addHsn(hsnMap, li.hsn, li.taxable, li.gstRate, li.qty);
    }
    return {
      id: b.id,
      number: b.billNumber,
      date: b.billDate.toISOString().slice(0, 10),
      vendorName: b.vendorName,
      vendorGstin: b.vendorGstin,
      taxable: Number(b.subtotal ?? 0),
      total: Number(b.total),
      gst: Number(b.gstAmount ?? 0),
      lines,
    };
  });

  const rateMap = new Map<string, { rate: number; taxable: number; tax: number; count: number }>();
  for (const inv of invoiceRows) {
    for (const line of inv.lines) {
      const key = String(line.gstRate);
      const cur = rateMap.get(key) ?? { rate: line.gstRate, taxable: 0, tax: 0, count: 0 };
      cur.taxable += line.taxable;
      cur.tax += (line.taxable * line.gstRate) / 100;
      cur.count += 1;
      rateMap.set(key, cur);
    }
  }

  const gstSummary = {
    invoiceCount: invoices.length,
    billCount: bills.length,
    creditNoteCount: creditNotes.length,
    debitNoteCount: debitNotes.length,
    invoiceTaxable: invoices.reduce((a, i) => a + Number(i.subtotal ?? 0), 0),
    invoiceCgst: invoices.reduce((a, i) => a + Number(i.cgstAmount ?? 0), 0),
    invoiceSgst: invoices.reduce((a, i) => a + Number(i.sgstAmount ?? 0), 0),
    invoiceIgst: invoices.reduce((a, i) => a + Number(i.igstAmount ?? 0), 0),
    invoiceGst: invoices.reduce((a, i) => a + Number(i.gstAmount ?? 0), 0),
    billGst: bills.reduce((a, b) => a + Number(b.gstAmount ?? 0), 0),
    billTaxable: bills.reduce((a, b) => a + Number(b.subtotal ?? 0), 0),
    billTotal: bills.reduce((a, b) => a + Number(b.total ?? 0), 0),
    creditNoteGst: creditNotes.reduce((a, c) => a + Number(c.gstAmount ?? 0), 0),
    debitNoteGst: debitNotes.reduce((a, d) => a + Number(d.gstAmount ?? 0), 0),
    b2bCount,
    b2cCount,
    missingHsnLines,
    rateWise: [...rateMap.values()].sort((a, b) => a.rate - b.rate),
    hsnSummary: [...hsnMap.values()].sort((a, b) => a.hsn.localeCompare(b.hsn)),
  };

  return {
    id: packId,
    companyId,
    periodStart: periodStart.toISOString().slice(0, 10),
    periodEnd: periodEnd.toISOString().slice(0, 10),
    bank: bank.map((b) => ({
      id: b.id,
      paymentMode: b.paymentMode,
      entryType: b.entryType,
      direction: b.direction,
      description: b.description,
      amount: Number(b.amount),
      entryDate: b.entryDate.toISOString().slice(0, 10),
    })),
    journals: journals.map((j) => ({
      id: j.id,
      entryDate: j.entryDate.toISOString().slice(0, 10),
      description: j.description,
      debitAccount: j.debitAccount,
      creditAccount: j.creditAccount,
      amount: Number(j.amount),
      reference: j.reference,
    })),
    gst: {
      ...gstSummary,
      invoices: invoiceRows,
      bills: billRows,
      creditNotes: creditNoteRows,
      debitNotes: debitNoteRows,
    },
    manualEntries: manualEntries.map((m) => ({
      id: m.id,
      entryType: m.entryType,
      entryDate: m.entryDate.toISOString().slice(0, 10),
      amount: m.amount == null ? null : Number(m.amount),
      narration: m.narration,
      createdByName: m.createdBy.name,
      createdAt: m.createdAt.toISOString(),
    })),
    ...summarizeBankMovement(bank),
  };
}

function summarizeBankMovement(
  bank: Array<{ amount: unknown; direction: string; entryType: string }>,
) {
  let bankIn = 0;
  let bankOut = 0;
  for (const b of bank) {
    if (b.entryType === 'OPENING') continue;
    const amt = Number(b.amount);
    if (b.direction === 'IN') bankIn += amt;
    else bankOut += amt;
  }
  return {
    bankIn: Number(bankIn.toFixed(2)),
    bankOut: Number(bankOut.toFixed(2)),
    bankNet: Number((bankIn - bankOut).toFixed(2)),
    /** @deprecated use bankClosing with owner opening; kept as net for drafts without opening */
    bankTotal: Number((bankIn - bankOut).toFixed(2)),
  };
}

/** Prefill hint: signed OPENING cash-book rows on or before period start. */
async function suggestOpeningCashBalance(companyId: string, periodStart: Date): Promise<number | null> {
  const rows = await prisma.inventoryCashBookEntry.findMany({
    where: { companyId, entryType: 'OPENING', entryDate: { lte: periodStart } },
    select: { amount: true, direction: true },
  });
  if (rows.length === 0) return null;
  let sum = 0;
  for (const r of rows) {
    const amt = Number(r.amount);
    sum += r.direction === 'IN' ? amt : -amt;
  }
  return Number(sum.toFixed(2));
}

type PackGstSlice = Awaited<ReturnType<typeof buildPackSlices>>['gst'];

/** Fill missing arrays on older snapshots (pre-CN/DN / pre-HSN rollup). */
function normalizePackGst(raw: unknown): PackGstSlice {
  const g = (raw && typeof raw === 'object' ? raw : {}) as Partial<PackGstSlice>;
  return {
    invoiceCount: Number(g.invoiceCount ?? 0),
    billCount: Number(g.billCount ?? 0),
    creditNoteCount: Number(g.creditNoteCount ?? (Array.isArray(g.creditNotes) ? g.creditNotes.length : 0)),
    debitNoteCount: Number(g.debitNoteCount ?? (Array.isArray(g.debitNotes) ? g.debitNotes.length : 0)),
    invoiceTaxable: Number(g.invoiceTaxable ?? 0),
    invoiceCgst: Number(g.invoiceCgst ?? 0),
    invoiceSgst: Number(g.invoiceSgst ?? 0),
    invoiceIgst: Number(g.invoiceIgst ?? 0),
    invoiceGst: Number(g.invoiceGst ?? 0),
    billGst: Number(g.billGst ?? 0),
    billTaxable: Number(g.billTaxable ?? 0),
    billTotal: Number(g.billTotal ?? 0),
    creditNoteGst: Number(g.creditNoteGst ?? 0),
    debitNoteGst: Number(g.debitNoteGst ?? 0),
    b2bCount: Number(g.b2bCount ?? 0),
    b2cCount: Number(g.b2cCount ?? 0),
    missingHsnLines: Number(g.missingHsnLines ?? 0),
    rateWise: Array.isArray(g.rateWise) ? g.rateWise : [],
    hsnSummary: Array.isArray(g.hsnSummary) ? g.hsnSummary : [],
    invoices: Array.isArray(g.invoices) ? g.invoices : [],
    bills: Array.isArray(g.bills) ? g.bills : [],
    creditNotes: Array.isArray(g.creditNotes) ? g.creditNotes : [],
    debitNotes: Array.isArray(g.debitNotes) ? g.debitNotes : [],
  };
}

export async function getGstHandoffPackDetail(
  companyId: string,
  packId: string,
  opts: { auditorUserId?: string },
) {
  const pack = await prisma.gstHandoffPack.findFirst({ where: { id: packId, companyId } });
  if (!pack) throw ApiError.notFound('Pack not found');

  if (opts.auditorUserId) {
    const membership = await prisma.auditorMembership.findUnique({
      where: { userId_companyId: { userId: opts.auditorUserId, companyId } },
    });
    if (!membership?.isActive) throw ApiError.forbidden('Not an auditor on this shop');
    if (pack.status === GstHandoffStatus.DRAFT) throw ApiError.notFound('Pack not found');
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { inventoryVertical: true, inventoryProfile: true },
  });
  const taxCode = getGstTaxCodeLabels(company?.inventoryVertical, company?.inventoryProfile);

  type PackSlices = Awaited<ReturnType<typeof buildPackSlices>>;

  // Prefer immutable snapshot after send; always refresh manual entries.
  if (pack.snapshot && pack.status !== GstHandoffStatus.DRAFT) {
    const snap = pack.snapshot as Partial<PackSlices> & {
      taxCode?: { short: string; field: string; missing: string };
      openingCashBalance?: number;
      bankClosing?: number;
    };
    const manualEntries = await prisma.auditorManualEntry.findMany({
      where: { packId },
      orderBy: { entryDate: 'asc' },
      select: {
        id: true,
        entryType: true,
        entryDate: true,
        amount: true,
        narration: true,
        createdBy: { select: { name: true } },
        createdAt: true,
      },
    });
    const snapTax = snap.taxCode ?? taxCode;
    const opening =
      snap.openingCashBalance != null
        ? Number(snap.openingCashBalance)
        : pack.openingCashBalance == null
          ? null
          : Number(pack.openingCashBalance);
    const bankIn = Number(snap.bankIn ?? 0);
    const bankOut = Number(snap.bankOut ?? 0);
    const bankNet = Number(snap.bankNet ?? bankIn - bankOut);
    const bankClosing =
      snap.bankClosing != null
        ? Number(snap.bankClosing)
        : opening == null
          ? bankNet
          : Number((opening + bankIn - bankOut).toFixed(2));
    return {
      ...serializePack(pack),
      bank: snap.bank ?? [],
      journals: snap.journals ?? [],
      gst: normalizePackGst(snap.gst),
      openingCashBalance: opening,
      bankIn,
      bankOut,
      bankNet,
      bankClosing,
      bankTotal: bankClosing,
      suggestedOpeningCashBalance: null,
      taxCode: snapTax,
      manualEntries: manualEntries.map((m) => ({
        id: m.id,
        entryType: m.entryType,
        entryDate: m.entryDate.toISOString().slice(0, 10),
        amount: m.amount == null ? null : Number(m.amount),
        narration: m.narration,
        createdByName: m.createdBy.name,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }

  const slices = await buildPackSlices(companyId, packId, pack.periodStart, pack.periodEnd);
  const opening =
    pack.openingCashBalance == null ? null : Number(pack.openingCashBalance);
  const suggested =
    pack.status === GstHandoffStatus.DRAFT
      ? await suggestOpeningCashBalance(companyId, pack.periodStart)
      : null;
  const bankClosing =
    opening == null
      ? slices.bankNet
      : Number((opening + slices.bankIn - slices.bankOut).toFixed(2));
  return {
    ...serializePack(pack),
    bank: slices.bank,
    journals: slices.journals,
    gst: slices.gst,
    manualEntries: slices.manualEntries,
    openingCashBalance: opening,
    bankIn: slices.bankIn,
    bankOut: slices.bankOut,
    bankNet: slices.bankNet,
    bankClosing,
    bankTotal: bankClosing,
    suggestedOpeningCashBalance: suggested,
    taxCode,
  };
}

/** Export pack as GST Offline Tool JSON or section-wise CSV zip. */
export async function exportGstHandoffPack(
  companyId: string,
  packId: string,
  opts: { auditorUserId?: string; format: 'gstr1-json' | 'csv' },
): Promise<{ filename: string; contentType: string; body: string | Buffer }> {
  const detail = await getGstHandoffPackDetail(companyId, packId, {
    auditorUserId: opts.auditorUserId,
  });
  if (detail.status === 'DRAFT') {
    throw ApiError.badRequest('Send the pack before exporting');
  }
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { gstin: true, name: true, state: true },
  });
  const gst = normalizePackGst(detail.gst);
  const label = detail.label.replace(/[^\w.-]+/g, '_');
  const supplierStateCode = resolveStateCode(company.state, company.gstin);

  if (opts.format === 'gstr1-json') {
    const json = buildGstr1OfflineJson({
      gstin: company.gstin,
      periodEnd: detail.periodEnd,
      gst,
      supplierStateCode,
    });
    return {
      filename: `gstr1-${label}.json`,
      contentType: 'application/json',
      body: JSON.stringify(json, null, 2),
    };
  }

  const files = buildGstr1OfflineSectionFiles({
    gst,
    periodEnd: detail.periodEnd,
    supplierStateCode,
  });
  const zip = await zipSectionFiles(files);
  return {
    filename: `gstr1-offline-${label}.zip`,
    contentType: 'application/zip',
    body: zip,
  };
}

export async function updatePackStatus(
  companyId: string,
  packId: string,
  userId: string,
  input: UpdateGstHandoffPackStatusInput,
) {
  const pack = await prisma.gstHandoffPack.findFirst({ where: { id: packId, companyId } });
  if (!pack) throw ApiError.notFound('Pack not found');
  const membership = await prisma.auditorMembership.findUnique({
    where: { userId_companyId: { userId, companyId } },
  });
  if (!membership?.isActive) throw ApiError.forbidden('Not an auditor on this shop');
  if (pack.status === GstHandoffStatus.DRAFT) throw ApiError.badRequest('Pack has not been sent');

  const updated = await prisma.gstHandoffPack.update({
    where: { id: packId },
    data: {
      status: input.status,
      filedAt: input.status === 'FILED' ? new Date() : pack.filedAt,
    },
  });
  return serializePack(updated);
}

export async function addManualEntry(
  companyId: string,
  packId: string,
  userId: string,
  input: AuditorManualEntryInput,
) {
  const pack = await prisma.gstHandoffPack.findFirst({ where: { id: packId, companyId } });
  if (!pack) throw ApiError.notFound('Pack not found');
  if (pack.status === GstHandoffStatus.DRAFT) throw ApiError.badRequest('Pack has not been sent');
  const membership = await prisma.auditorMembership.findUnique({
    where: { userId_companyId: { userId, companyId } },
  });
  if (!membership?.isActive) throw ApiError.forbidden('Not an auditor on this shop');

  const row = await prisma.auditorManualEntry.create({
    data: {
      packId,
      companyId,
      createdById: userId,
      entryType: input.entryType,
      entryDate: new Date(`${input.entryDate}T00:00:00.000Z`),
      amount: input.amount ?? null,
      narration: input.narration,
    },
  });
  return {
    id: row.id,
    entryType: row.entryType,
    entryDate: row.entryDate.toISOString().slice(0, 10),
    amount: row.amount == null ? null : Number(row.amount),
    narration: row.narration,
  };
}

function serializePack(pack: PackRow | Omit<PackRow, 'snapshot'>) {
  return {
    id: pack.id,
    companyId: pack.companyId,
    periodStart: pack.periodStart.toISOString().slice(0, 10),
    periodEnd: pack.periodEnd.toISOString().slice(0, 10),
    label: pack.label,
    status: pack.status,
    notes: pack.notes,
    openingCashBalance:
      pack.openingCashBalance == null ? null : Number(pack.openingCashBalance),
    sentAt: pack.sentAt?.toISOString() ?? null,
    filedAt: pack.filedAt?.toISOString() ?? null,
    createdAt: pack.createdAt.toISOString(),
    hasSnapshot: 'snapshot' in pack ? Boolean(pack.snapshot) : false,
  };
}
