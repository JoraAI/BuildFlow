/**
 * BuildFlow - Inventory alerts (INVENTORY_HORIZONTAL_PLATFORM Phase 8.5).
 *
 * Lightweight hooks into the EXISTING notification infra (in-app first — no new
 * notification product). All functions are non-fatal (never throw) and only run
 * for INVENTORY tenants. D10 is untouched: these are rules + the shared notify()
 * pipeline, no chat model involved.
 */
import { prisma } from '../lib/prisma';
import { logger } from '../config/logger';
import { notifyMany } from './notification.service';
import { ApiError } from '../utils/errors';

/** PO rate vs WAC/last-buy flag band — mirrors inventory-ai.service (8.1-8.3). */
const PO_RATE_BAND_PCT = 0.15;
const ANOMALY_WINDOW_MS = 30 * 86400000;

async function inventoryAlertRecipients(companyId: string): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { companyId, role: { in: ['OWNER', 'INVENTORY_MANAGER'] } },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

async function isInventoryTenant(companyId: string): Promise<boolean> {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { subscriptionPlan: true },
  });
  return company.subscriptionPlan === 'INVENTORY';
}

export interface LowStockAlertLine {
  resourceId: string;
  name: string;
  unit: string | null;
  onHand: number;
  reorderPoint: number;
}

/** Low-stock alert after an OUT movement crosses an item below its reorder point. */
export async function notifyLowStock(
  companyId: string,
  lines: LowStockAlertLine[],
): Promise<void> {
  try {
    if (!(await isInventoryTenant(companyId))) return;
    const flagged = lines.filter((l) => l.reorderPoint > 0 && l.onHand < l.reorderPoint);
    if (flagged.length === 0) return;
    const recipients = await inventoryAlertRecipients(companyId);
    if (recipients.length === 0) return;
    for (const l of flagged.slice(0, 5)) {
      await notifyMany(recipients, {
        companyId,
        title: `Low stock: ${l.name}`,
        body: `${l.name} has only ${l.onHand} ${l.unit ?? ''} left (reorder point ${l.reorderPoint}). Time to reorder.`,
        type: 'INVENTORY_LOW_STOCK',
        referenceId: l.resourceId,
      });
    }
  } catch (err) {
    logger.warn('notifyLowStock failed (non-fatal)', { error: String(err), companyId });
  }
}

/** PO-rate anomaly alert — fires when a PO line is above WAC/last-buy band. */
export async function notifyPoRateAnomaly(
  companyId: string,
  opts: {
    poId: string;
    poNumber: string;
    vendorName: string;
    lines: Array<{ resourceId: string; rate: number }>;
  },
): Promise<void> {
  try {
    if (!(await isInventoryTenant(companyId))) return;

    const [resources, grnLines] = await Promise.all([
      prisma.resource.findMany({
        where: { companyId, isDeleted: false },
        select: { id: true, name: true, avgCost: true },
      }),
      prisma.goodsReceiptLine.findMany({
        where: { grn: { companyId } },
        select: { resourceId: true, unitCost: true, grn: { select: { receivedDate: true } } },
        orderBy: { grn: { receivedDate: 'desc' } },
      }),
    ]);
    const resourceById = new Map(resources.map((r) => [r.id, r]));
    const lastBuyByResource = new Map<string, number>();
    for (const l of grnLines) {
      if (!lastBuyByResource.has(l.resourceId)) lastBuyByResource.set(l.resourceId, Number(l.unitCost));
    }

    const flagged = opts.lines
      .filter((l) => l.rate > 0)
      .map((l) => {
        const res = resourceById.get(l.resourceId);
        if (!res) return null;
        const baseline = Math.max(Number(res.avgCost ?? 0), lastBuyByResource.get(l.resourceId) ?? 0);
        if (baseline <= 0) return null;
        if (l.rate <= baseline * (1 + PO_RATE_BAND_PCT)) return null;
        return { name: res.name, overPct: Math.round((l.rate / baseline - 1) * 100) };
      })
      .filter((x): x is { name: string; overPct: number } => x !== null);

    if (flagged.length === 0) return;
    const recipients = await inventoryAlertRecipients(companyId);
    if (recipients.length === 0) return;
    for (const f of flagged.slice(0, 3)) {
      await notifyMany(recipients, {
        companyId,
        title: `PO ${opts.poNumber} rate above last cost`,
        body: `${f.name}: PO rate is ${f.overPct}% above the WAC/last-buy from ${opts.vendorName}. Review before paying.`,
        type: 'INVENTORY_PO_RATE_ANOMALY',
        referenceId: opts.poId,
      });
    }
  } catch (err) {
    logger.warn('notifyPoRateAnomaly failed (non-fatal)', { error: String(err), companyId });
  }
}

/** Stock-count variance alert after a count is approved. */
export async function notifyCountVariance(
  companyId: string,
  opts: {
    countId: string;
    countNumber: string;
    locationName: string;
    lines: Array<{ itemName: string; systemQty: number; countedQty: number; variance: number }>;
  },
): Promise<void> {
  try {
    if (!(await isInventoryTenant(companyId))) return;
    const flagged = opts.lines.filter((l) => {
      const abs = Math.abs(l.variance);
      const pct = l.systemQty > 0 ? abs / l.systemQty : abs;
      return abs >= 5 || pct >= 0.25;
    });
    if (flagged.length === 0) return;
    const recipients = await inventoryAlertRecipients(companyId);
    if (recipients.length === 0) return;
    for (const l of flagged.slice(0, 5)) {
      await notifyMany(recipients, {
        companyId,
        title: `Large variance in count ${opts.countNumber}`,
        body: `${l.itemName}: system ${l.systemQty}, counted ${l.countedQty} (${l.variance > 0 ? '+' : ''}${l.variance}) at ${opts.locationName}.`,
        type: 'INVENTORY_COUNT_VARIANCE',
        referenceId: opts.countId,
      });
    }
  } catch (err) {
    logger.warn('notifyCountVariance failed (non-fatal)', { error: String(err), companyId });
  }
}

export { ANOMALY_WINDOW_MS };

/** Overdue-invoice reminders (Phase 9.4) — deduped to once per invoice per week. */
export async function notifyOverdueInvoices(companyId: string): Promise<void> {
  try {
    if (!(await isInventoryTenant(companyId))) return;
    const today = new Date();
    const invoices = await prisma.invoice.findMany({
      where: { companyId, status: { in: ['SENT', 'OVERDUE'] }, dueDate: { lt: today } },
      select: { id: true, invoiceNumber: true, clientName: true, total: true, dueDate: true },
    });
    if (invoices.length === 0) return;
    const recipients = await inventoryAlertRecipients(companyId);
    if (recipients.length === 0) return;

    for (const inv of invoices) {
      const recent = await prisma.notification.count({
        where: {
          userId: recipients[0],
          type: 'INVENTORY_OVERDUE_INVOICE',
          referenceId: inv.id,
          createdAt: { gte: new Date(Date.now() - 7 * 86400000) },
        },
      });
      if (recent > 0) continue;
      const days = Math.max(Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / 86400000), 1);
      await notifyMany(recipients, {
        companyId,
        title: `Invoice ${inv.invoiceNumber} overdue`,
        body: `${inv.clientName} · ₹${Number(inv.total)} · ${days} day(s) past due. Follow up for payment.`,
        type: 'INVENTORY_OVERDUE_INVOICE',
        referenceId: inv.id,
      });
    }
  } catch (err) {
    logger.warn('notifyOverdueInvoices failed (non-fatal)', { error: String(err), companyId });
  }
}

/** Manual "Remind" action on an invoice — in-app nudge for OWNER/INVENTORY_MANAGER. */
export async function remindOverdueInvoice(companyId: string, invoiceId: string): Promise<void> {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, companyId },
    select: { invoiceNumber: true, clientName: true, total: true, dueDate: true },
  });
  if (!invoice) throw new ApiError('NOT_FOUND', 'Invoice not found');
  const recipients = await inventoryAlertRecipients(companyId);
  if (recipients.length === 0) return;
  await notifyMany(recipients, {
    companyId,
    title: `Invoice ${invoice.invoiceNumber} — payment reminder`,
    body: `${invoice.clientName} · ₹${Number(invoice.total)} · due ${invoice.dueDate.toISOString().slice(0, 10)}. Send the reminder.`,
    type: 'INVENTORY_OVERDUE_INVOICE',
    referenceId: invoiceId,
  });
}
