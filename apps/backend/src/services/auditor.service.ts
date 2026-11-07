/**
 * Inventory auditor multi-shop membership + GST handoff packs.
 */
import { GstHandoffStatus, Prisma, Role } from '@prisma/client';
import {
  MAX_INVENTORY_AUDITORS,
  getGstTaxCodeLabels,
  type AuditorManualEntryInput,
  type CreateGstHandoffPackInput,
  type UpdateGstHandoffPackStatusInput,
} from '@buildflow/shared';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { recordAudit } from '../utils/audit';

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

export async function sendGstHandoffPack(companyId: string, packId: string, actorId: string) {
  const pack = await prisma.gstHandoffPack.findFirst({ where: { id: packId, companyId } });
  if (!pack) throw ApiError.notFound('Pack not found');
  if (pack.status !== GstHandoffStatus.DRAFT) {
    throw ApiError.badRequest('Only draft packs can be sent');
  }

  const detail = await buildPackSlices(companyId, packId, pack.periodStart, pack.periodEnd);
  const companyMeta = await prisma.company.findUnique({
    where: { id: companyId },
    select: { inventoryVertical: true, inventoryProfile: true },
  });
  const taxCode = getGstTaxCodeLabels(companyMeta?.inventoryVertical, companyMeta?.inventoryProfile);
  const snapshot = {
    bank: detail.bank,
    quotes: detail.quotes,
    journals: detail.journals,
    gst: detail.gst,
    bankTotal: detail.bankTotal,
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
  return serializePack(updated);
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
  snapshot: Prisma.JsonValue | null;
  sentAt: Date | null;
  filedAt: Date | null;
  createdAt: Date;
};

async function buildPackSlices(
  companyId: string,
  packId: string,
  periodStart: Date,
  periodEnd: Date,
) {
  const start = periodStart;
  const endExclusive = new Date(periodEnd);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

  const [bank, quotes, journals, invoices, bills, manualEntries] = await Promise.all([
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
    prisma.quote.findMany({
      where: { companyId, quoteDate: { gte: start, lt: endExclusive } },
      orderBy: { quoteDate: 'desc' },
      select: {
        id: true,
        quoteNumber: true,
        status: true,
        total: true,
        customerName: true,
        quoteDate: true,
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
      const tax = (taxable * rate) / 100;
      const hsn = li.hsnSacCode?.trim() || '';
      if (!hsn) missingHsnLines += 1;
      const key = hsn || '(missing)';
      const cur = hsnMap.get(key) ?? { hsn: key, taxable: 0, tax: 0, qty: 0, lineCount: 0 };
      cur.taxable += taxable;
      cur.tax += tax;
      cur.qty += Number(li.quantity);
      cur.lineCount += 1;
      hsnMap.set(key, cur);
      return {
        id: li.id,
        description: li.description,
        qty: Number(li.quantity),
        rate: Number(li.rate),
        taxable,
        gstRate: rate,
        hsn: hsn || null,
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
    invoiceTaxable: invoices.reduce((a, i) => a + Number(i.subtotal ?? 0), 0),
    invoiceCgst: invoices.reduce((a, i) => a + Number(i.cgstAmount ?? 0), 0),
    invoiceSgst: invoices.reduce((a, i) => a + Number(i.sgstAmount ?? 0), 0),
    invoiceIgst: invoices.reduce((a, i) => a + Number(i.igstAmount ?? 0), 0),
    invoiceGst: invoices.reduce((a, i) => a + Number(i.gstAmount ?? 0), 0),
    billGst: bills.reduce((a, b) => a + Number(b.gstAmount ?? 0), 0),
    billTaxable: bills.reduce((a, b) => a + Number(b.subtotal ?? 0), 0),
    billTotal: bills.reduce((a, b) => a + Number(b.total ?? 0), 0),
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
    quotes: quotes.map((q) => ({
      id: q.id,
      quoteNumber: q.quoteNumber,
      status: q.status,
      total: Number(q.total),
      customerName: q.customerName,
      quoteDate: q.quoteDate.toISOString().slice(0, 10),
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
      bills: bills.map((b) => ({
        id: b.id,
        number: b.billNumber,
        date: b.billDate.toISOString().slice(0, 10),
        vendorName: b.vendorName,
        vendorGstin: b.vendorGstin,
        taxable: Number(b.subtotal ?? 0),
        total: Number(b.total),
        gst: Number(b.gstAmount ?? 0),
      })),
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
    bankTotal: bank.reduce((a, b) => a + Number(b.amount), 0),
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

  // Prefer immutable snapshot after send; always refresh manual entries.
  if (pack.snapshot && pack.status !== GstHandoffStatus.DRAFT) {
    const snap = pack.snapshot as Record<string, unknown>;
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
    const snapTax =
      snap.taxCode && typeof snap.taxCode === 'object'
        ? (snap.taxCode as { short: string; field: string; missing: string })
        : taxCode;
    return {
      ...serializePack(pack),
      ...snap,
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
  return {
    ...serializePack(pack),
    bank: slices.bank,
    quotes: slices.quotes,
    journals: slices.journals,
    gst: slices.gst,
    manualEntries: slices.manualEntries,
    bankTotal: slices.bankTotal,
    taxCode,
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
    sentAt: pack.sentAt?.toISOString() ?? null,
    filedAt: pack.filedAt?.toISOString() ?? null,
    createdAt: pack.createdAt.toISOString(),
    hasSnapshot: 'snapshot' in pack ? Boolean(pack.snapshot) : false,
  };
}
