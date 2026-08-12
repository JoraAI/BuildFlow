/**
 * BuildFlow - Inventory analytics service (INVENTORY_HORIZONTAL_PLATFORM Phase 6).
 *
 * 6.1 Executive dashboard: inventory value, today's sales/purchases,
 *     receivables/payables, low-stock count, dead-stock count.
 * 6.2 Stock health reports: dead/slow stock classification + per-warehouse
 *     value summary.
 * 6.3 Margin reports: revenue − WAC×qty sold per item, and last-buy vs WAC.
 *
 * Documented bases:
 *   - "today" = IST calendar day (UTC+05:30).
 *   - inventory value = balance × Resource.avgCost (WAC, company-wide).
 *   - sales revenue per item = qty sold × Resource.rate (catalog sale price).
 *   - receivables = open invoice total − paid − issued credit notes.
 *   - payables    = open bill total − paid − issued debit notes.
 *   - dead stock  = on-hand > 0 with no OUT movement in the last N days (default 90).
 */
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { assertProjectAccess } from '../middleware/project-access.middleware';
import { getDefaultProjectId } from './module-gate.service';

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}

/** IST calendar day string (YYYY-MM-DD) for "today". */
export function istToday(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

/** IST day boundary as Date range for DATE-column filters. */
export function istTodayRange(): { gte: Date; lt: Date } {
  const day = istToday();
  return {
    gte: new Date(`${day}T00:00:00.000Z`),
    lt: new Date(`${day}T23:59:59.999Z`),
  };
}

async function resolveDefaultProject(companyId: string, userId: string, role: string) {
  const projectId = await getDefaultProjectId(companyId);
  if (!projectId) throw ApiError.forbidden('Analytics are not available on this plan.');
  await assertProjectAccess(companyId, userId, role as never, projectId);
  return projectId;
}

async function loadOnHandByResource(
  companyId: string,
  projectId: string,
  locationId?: string,
): Promise<Map<string, number>> {
  const balances = await prisma.stockBalance.findMany({
    where: { location: { companyId, projectId, ...(locationId ? { id: locationId } : {}) } },
    select: { resourceId: true, quantity: true },
  });
  const map = new Map<string, number>();
  for (const b of balances) {
    map.set(b.resourceId, (map.get(b.resourceId) ?? 0) + Number(b.quantity));
  }
  return map;
}

async function countDeadStock(
  companyId: string,
  projectId: string,
  days: number,
): Promise<number> {
  const cutoff = new Date(Date.now() - days * 86400000);
  const [outMoved, onHand] = await Promise.all([
    prisma.stockMovement.findMany({
      where: { location: { companyId, projectId }, type: 'OUT', createdAt: { gte: cutoff } },
      select: { resourceId: true },
      distinct: ['resourceId'],
    }),
    loadOnHandByResource(companyId, projectId),
  ]);
  const moved = new Set(outMoved.map((m) => m.resourceId));
  let count = 0;
  for (const [rid, qty] of onHand) {
    if (qty > 0 && !moved.has(rid)) count += 1;
  }
  return count;
}

export async function getDashboard(
  companyId: string,
  userId: string,
  role: string,
): Promise<Record<string, number>> {
  const projectId = await resolveDefaultProject(companyId, userId, role);
  const today = istTodayRange();

  const [balances, resources, invoices, bills, creditNotes, debitNotes] = await Promise.all([
    prisma.stockBalance.findMany({
      where: { location: { companyId, projectId } },
      select: { resourceId: true, quantity: true },
    }),
    prisma.resource.findMany({
      where: { companyId, isDeleted: false },
      select: { id: true, avgCost: true, reorderPoint: true },
    }),
    prisma.invoice.findMany({
      where: { companyId, projectId },
      select: { invoiceDate: true, total: true, paidAmount: true, status: true },
    }),
    prisma.bill.findMany({
      where: { companyId, projectId },
      select: { billDate: true, total: true, paidAmount: true, status: true },
    }),
    prisma.creditNote.findMany({
      where: { companyId, projectId, status: 'ISSUED' },
      select: { total: true },
    }),
    prisma.debitNote.findMany({
      where: { companyId, projectId, status: 'ISSUED' },
      select: { total: true },
    }),
  ]);

  const resourceById = new Map(resources.map((r) => [r.id, r]));
  const onHand = new Map<string, number>();

  // Inventory value = balance × WAC.
  let inventoryValue = 0;
  for (const b of balances) {
    const qty = Number(b.quantity);
    onHand.set(b.resourceId, (onHand.get(b.resourceId) ?? 0) + qty);
    inventoryValue += qty * Number(resourceById.get(b.resourceId)?.avgCost ?? 0);
  }

  const salesToday = invoices
    .filter((i) => i.invoiceDate >= today.gte && i.invoiceDate < today.lt)
    .reduce((s, i) => s + Number(i.total), 0);
  const purchasesToday = bills
    .filter((b) => b.billDate >= today.gte && b.billDate < today.lt)
    .reduce((s, b) => s + Number(b.total), 0);

  const receivables =
    invoices
      .filter((i) => i.status !== 'DRAFT')
      .reduce((s, i) => s + (Number(i.total) - Number(i.paidAmount)), 0) -
    creditNotes.reduce((s, c) => s + Number(c.total), 0);
  const payables =
    bills
      .filter((b) => b.status !== 'DRAFT' && b.status !== 'REJECTED')
      .reduce((s, b) => s + (Number(b.total) - Number(b.paidAmount)), 0) -
    debitNotes.reduce((s, d) => s + Number(d.total), 0);

  const lowStockCount = resources.filter(
    (r) => Number(r.reorderPoint ?? 0) > 0 && (onHand.get(r.id) ?? 0) < Number(r.reorderPoint),
  ).length;

  return {
    inventoryValue: round2(inventoryValue),
    salesToday: round2(salesToday),
    purchasesToday: round2(purchasesToday),
    receivables: round2(Math.max(0, receivables)),
    payables: round2(Math.max(0, payables)),
    lowStockCount,
    deadStockCount: await countDeadStock(companyId, projectId, 90),
  };
}
/* ── 6.2 Stock health ─────────────────────────────────────────────── */

export interface StockHealthRow {
  resourceId: string;
  name: string;
  unit: string;
  onHand: number;
  unitCost: number;
  value: number;
  daysSinceLastOut: number | null;
  classification: 'ACTIVE' | 'SLOW' | 'DEAD';
}

const DEAD_DAYS = 90;
const SLOW_DAYS = 30;

export async function getStockHealthReport(
  companyId: string,
  userId: string,
  role: string,
  opts: { locationId?: string; days?: number } = {},
): Promise<StockHealthRow[]> {
  const projectId = await resolveDefaultProject(companyId, userId, role);
  const days = Math.min(Math.max(opts.days ?? DEAD_DAYS, 1), 365);

  const [resources, onHandMap, outMovements] = await Promise.all([
    prisma.resource.findMany({
      where: { companyId, isDeleted: false },
      select: { id: true, name: true, unit: true, avgCost: true },
    }),
    loadOnHandByResource(companyId, projectId, opts.locationId),
    prisma.stockMovement.findMany({
      where: { location: { companyId, projectId }, type: 'OUT' },
      select: { resourceId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const lastOutByResource = new Map<string, Date>();
  for (const m of outMovements) {
    if (!lastOutByResource.has(m.resourceId)) lastOutByResource.set(m.resourceId, m.createdAt);
  }

  const rows: StockHealthRow[] = [];
  for (const r of resources) {
    const onHand = onHandMap.get(r.id) ?? 0;
    if (onHand <= 0) continue;
    const lastOut = lastOutByResource.get(r.id);
    const daysSince = lastOut ? (Date.now() - lastOut.getTime()) / 86400000 : null;
    const classification: StockHealthRow['classification'] =
      lastOut === null || daysSince === null || daysSince > days
        ? 'DEAD'
        : daysSince > SLOW_DAYS
          ? 'SLOW'
          : 'ACTIVE';
    const unitCost = Number(r.avgCost ?? 0);
    rows.push({
      resourceId: r.id,
      name: r.name,
      unit: r.unit,
      onHand: round2(onHand),
      unitCost: round4(unitCost),
      value: round2(onHand * unitCost),
      daysSinceLastOut: daysSince != null ? Math.round(daysSince) : null,
      classification,
    });
  }
  return rows.sort((a, b) => b.value - a.value);
}

/* ── 6.2 Warehouse value summary ──────────────────────────────────── */

export interface WarehouseValueRow {
  locationId: string;
  name: string;
  value: number;
  itemCount: number;
}

export async function getWarehouseValueReport(
  companyId: string,
  userId: string,
  role: string,
): Promise<WarehouseValueRow[]> {
  const projectId = await resolveDefaultProject(companyId, userId, role);
  const locations = await prisma.stockLocation.findMany({
    where: { companyId, projectId, isActive: true },
    include: {
      balances: { include: { resource: { select: { avgCost: true } } } },
    },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  });

  return locations.map((loc) => {
    let value = 0;
    let itemCount = 0;
    for (const b of loc.balances) {
      const qty = Number(b.quantity);
      if (qty <= 0) continue;
      value += qty * Number(b.resource.avgCost ?? 0);
      itemCount += 1;
    }
    return { locationId: loc.id, name: loc.name, value: round2(value), itemCount };
  });
}

/* ── 6.3 Margin report ────────────────────────────────────────────── */

export interface MarginRow {
  resourceId: string;
  name: string;
  unit: string;
  qtySold: number;
  revenue: number;
  cogs: number;
  margin: number;
  marginPct: number;
  /** INVENTORY_HORIZONTAL_PLATFORM (Phase 8.4): 'BILLED' when invoice line links
   *  exist (billed net), else 'CATALOG' (qty sold × catalog rate). */
  revenueSource: 'BILLED' | 'CATALOG';
}

/** Sales OUT reference types (excludes internal transfers + purchase returns). */
const SALES_OUT_TYPES = ['MANUAL_ISSUE', 'DELIVERY_CHALLAN'];

export async function getMarginReport(
  companyId: string,
  userId: string,
  role: string,
): Promise<MarginRow[]> {
  const projectId = await resolveDefaultProject(companyId, userId, role);

  const [resources, movements, linkedLines] = await Promise.all([
    prisma.resource.findMany({
      where: { companyId, isDeleted: false },
      select: { id: true, name: true, unit: true, rate: true },
    }),
    prisma.stockMovement.findMany({
      where: { location: { companyId, projectId }, type: 'OUT', referenceType: { in: SALES_OUT_TYPES } },
      select: { resourceId: true, quantity: true, unitCost: true, inventoryValue: true },
    }),
    // INVENTORY_HORIZONTAL_PLATFORM (Phase 8.4): billed net per item from
    // resource-linked invoice lines (ex-GST line amounts).
    prisma.invoiceLineItem.findMany({
      where: { invoice: { companyId, projectId }, resourceId: { not: null } },
      select: { resourceId: true, amount: true },
    }),
  ]);

  const resourceById = new Map(resources.map((r) => [r.id, r]));
  const acc = new Map<string, { qtySold: number; cogs: number }>();

  for (const m of movements) {
    const a = acc.get(m.resourceId) ?? { qtySold: 0, cogs: 0 };
    a.qtySold += Number(m.quantity);
    a.cogs += Number(m.inventoryValue) || Number(m.unitCost) * Number(m.quantity);
    acc.set(m.resourceId, a);
  }

  const billedByResource = new Map<string, number>();
  for (const li of linkedLines) {
    if (!li.resourceId) continue;
    billedByResource.set(li.resourceId, (billedByResource.get(li.resourceId) ?? 0) + Number(li.amount));
  }

  const rows: MarginRow[] = [];
  for (const [resourceId, a] of acc) {
    const r = resourceById.get(resourceId);
    if (!r || a.qtySold <= 0) continue;
    const billed = billedByResource.get(resourceId);
    const revenueSource: MarginRow['revenueSource'] = billed !== undefined ? 'BILLED' : 'CATALOG';
    const revenue = billed !== undefined ? round2(billed) : round2(a.qtySold * Number(r.rate ?? 0));
    const cogs = round2(a.cogs);
    const margin = round2(revenue - cogs);
    rows.push({
      resourceId,
      name: r.name,
      unit: r.unit,
      qtySold: round2(a.qtySold),
      revenue,
      cogs,
      margin,
      marginPct: revenue > 0 ? Math.round((margin / revenue) * 1000) / 10 : 0,
      revenueSource,
    });
  }
  return rows.sort((a, b) => b.margin - a.margin);
}

/* ── 6.3 Purchase price history vs WAC ────────────────────────────── */

export interface PurchaseHistoryRow {
  resourceId: string;
  name: string;
  unit: string;
  lastBuyRate: number;
  lastBuyDate: string | null;
  currentWac: number;
  /** currentWac − lastBuyRate (positive = landed cost above last quoted rate). */
  wacVsLastBuy: number;
}

export async function getPurchaseHistoryReport(
  companyId: string,
  userId: string,
  role: string,
): Promise<PurchaseHistoryRow[]> {
  const projectId = await resolveDefaultProject(companyId, userId, role);

  const [resources, grnLines] = await Promise.all([
    prisma.resource.findMany({
      where: { companyId, isDeleted: false },
      select: { id: true, name: true, unit: true, avgCost: true },
    }),
    prisma.goodsReceiptLine.findMany({
      where: { grn: { companyId, projectId } },
      select: { resourceId: true, unitCost: true, grn: { select: { receivedDate: true } } },
      orderBy: { grn: { receivedDate: 'desc' } },
    }),
  ]);

  const lastBuy = new Map<string, { rate: number; date: string }>();
  for (const l of grnLines) {
    if (!lastBuy.has(l.resourceId)) {
      lastBuy.set(l.resourceId, {
        rate: Number(l.unitCost),
        date: l.grn.receivedDate.toISOString().slice(0, 10),
      });
    }
  }

  const rows: PurchaseHistoryRow[] = [];
  for (const r of resources) {
    const last = lastBuy.get(r.id);
    const currentWac = Number(r.avgCost ?? 0);
    const lastBuyRate = last?.rate ?? 0;
    if (!last && currentWac <= 0) continue;
    rows.push({
      resourceId: r.id,
      name: r.name,
      unit: r.unit,
      lastBuyRate: round4(lastBuyRate),
      lastBuyDate: last?.date ?? null,
      currentWac: round4(currentWac),
      wacVsLastBuy: round2(currentWac - lastBuyRate),
    });
  }
  return rows.sort((a, b) => Math.abs(b.wacVsLastBuy) - Math.abs(a.wacVsLastBuy));
}

