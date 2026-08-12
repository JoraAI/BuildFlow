/**
 * BuildFlow - Warehouse ops service (INVENTORY_HORIZONTAL_PLATFORM Phase 3).
 *
 * 3.1 Multi-warehouse: CRUD StockLocation rows per inventory company.
 * 3.2 Stock transfers: TransferOrder DRAFT → IN_TRANSIT (stock OUT from source)
 *     → RECEIVED (stock IN to destination) | CANCELLED (DRAFT only).
 * 3.3 Stock counts: StockCount DRAFT → APPROVED (writes ADJUST/STOCKTAKE
 *     movements + sets balances to counted quantities).
 * 3.4 Barcode identify: lookup a company Resource by its barcode.
 *
 * Company + STORE project scoped; routes gated by `multi_warehouse` / `barcode`.
 */
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { logger } from '../config/logger';
import { nextSequentialNumber } from '../lib/id-generator';
import { assertProjectAccess } from '../middleware/project-access.middleware';
import { getDefaultProjectId } from './module-gate.service';
import { notifyCountVariance } from './inventory-alerts.service';
import type {
  CreateWarehouseInput,
  UpdateWarehouseInput,
  CreateTransferOrderInput,
  CreateStockCountInput,
} from '@buildflow/shared';
import { StockAdjustReason } from '@buildflow/shared';

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

async function resolveDefaultProject(companyId: string, userId: string, role: string) {
  const projectId = await getDefaultProjectId(companyId);
  if (!projectId) throw ApiError.forbidden('Warehouse operations are not available on this plan.');
  await assertProjectAccess(companyId, userId, role as never, projectId);
  return projectId;
}

/* ── 3.1 Multi-warehouse ──────────────────────────────────────────── */

export async function listWarehouses(companyId: string, userId: string, role: string) {
  const projectId = await resolveDefaultProject(companyId, userId, role);
  return prisma.stockLocation.findMany({
    where: { companyId, projectId },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    include: {
      balances: {
        select: { resourceId: true, quantity: true },
      },
    },
  });
}

export async function getWarehouse(companyId: string, userId: string, role: string, id: string) {
  await resolveDefaultProject(companyId, userId, role);
  const loc = await prisma.stockLocation.findFirst({ where: { id, companyId } });
  if (!loc) throw ApiError.notFound('Warehouse not found');
  return loc;
}

export async function createWarehouse(
  companyId: string,
  userId: string,
  role: string,
  input: CreateWarehouseInput,
) {
  const projectId = await resolveDefaultProject(companyId, userId, role);

  // Reject a duplicate code when one is supplied.
  if (input.code?.trim()) {
    const dup = await prisma.stockLocation.findFirst({
      where: { companyId, projectId, code: input.code.trim() },
      select: { id: true },
    });
    if (dup) throw ApiError.conflict(`A warehouse with code "${input.code.trim()}" already exists.`);
  }

  return prisma.$transaction(async (tx) => {
    const count = await tx.stockLocation.count({ where: { companyId, projectId } });
    // First warehouse for a tenant is the default (matches the lazy default).
    const isDefault = input.isDefault === true || count === 0;
    if (isDefault) {
      await tx.stockLocation.updateMany({
        where: { companyId, projectId, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.stockLocation.create({
      data: {
        companyId,
        projectId,
        name: input.name.trim(),
        code: input.code?.trim() || null,
        address: input.address?.trim() || null,
        isDefault,
        isActive: input.isActive ?? true,
      },
    });
  });
}

export async function updateWarehouse(
  companyId: string,
  userId: string,
  role: string,
  id: string,
  input: UpdateWarehouseInput,
) {
  await resolveDefaultProject(companyId, userId, role);
  const loc = await prisma.stockLocation.findFirst({ where: { id, companyId } });
  if (!loc) throw ApiError.notFound('Warehouse not found');

  // Deactivating the last active location would leave the company without a
  // warehouse — block it.
  if (input.isActive === false && (loc.isDefault || (await countActive(companyId)) <= 1)) {
    throw ApiError.badRequest('Cannot deactivate the default warehouse — set another default first.');
  }

  if (input.code?.trim()) {
    const dup = await prisma.stockLocation.findFirst({
      where: { companyId, id: { not: id }, code: input.code.trim() },
      select: { id: true },
    });
    if (dup) throw ApiError.conflict(`A warehouse with code "${input.code.trim()}" already exists.`);
  }

  return prisma.$transaction(async (tx) => {
    if (input.isDefault === true) {
      await tx.stockLocation.updateMany({
        where: { companyId, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.stockLocation.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name.trim() }),
        ...(input.code !== undefined && { code: input.code?.trim() || null }),
        ...(input.address !== undefined && { address: input.address?.trim() || null }),
        ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });
  });
}

async function countActive(companyId: string): Promise<number> {
  const projectId = await getDefaultProjectId(companyId);
  return prisma.stockLocation.count({
    where: { companyId, projectId: projectId ?? undefined, isActive: true },
  });
}

/**
 * Soft delete: deactivate. Hard delete would cascade balances + movements, so
 * we never physically remove a location with history. Deactivating the default
 * or the last active location is blocked.
 */
export async function deactivateWarehouse(companyId: string, userId: string, role: string, id: string) {
  await resolveDefaultProject(companyId, userId, role);
  const loc = await prisma.stockLocation.findFirst({ where: { id, companyId } });
  if (!loc) throw ApiError.notFound('Warehouse not found');
  if (loc.isDefault || (await countActive(companyId)) <= 1) {
    throw ApiError.badRequest('Cannot deactivate the default warehouse — set another default first.');
  }
  return prisma.stockLocation.update({ where: { id }, data: { isActive: false } });
}

/* ── 3.2 Stock transfers ──────────────────────────────────────────── */

function transferInclude() {
  return {
    lines: true,
    fromLocation: { select: { id: true, name: true, code: true } },
    toLocation: { select: { id: true, name: true, code: true } },
  };
}

export async function listTransfers(companyId: string, userId: string, role: string) {
  await resolveDefaultProject(companyId, userId, role);
  return prisma.transferOrder.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    include: transferInclude(),
  });
}

export async function createTransferOrder(
  companyId: string,
  userId: string,
  role: string,
  input: CreateTransferOrderInput,
) {
  const projectId = await resolveDefaultProject(companyId, userId, role);
  const locations = await prisma.stockLocation.findMany({
    where: { id: { in: [input.fromLocationId, input.toLocationId] }, companyId, isActive: true },
    select: { id: true, name: true },
  });
  if (locations.length !== 2) throw ApiError.badRequest('Both locations must belong to this company.');

  const resources = await prisma.resource.findMany({
    where: { id: { in: input.lines.map((l) => l.resourceId) }, companyId },
    select: { id: true, name: true, unit: true },
  });
  const resourceById = new Map(resources.map((r) => [r.id, r]));

  const lines = input.lines.map((l) => {
    const r = resourceById.get(l.resourceId);
    if (!r) throw ApiError.notFound('Resource not found');
    return {
      resourceId: l.resourceId,
      itemName: r.name,
      unit: r.unit,
      quantity: l.quantity,
    };
  });

  return prisma.$transaction(async (tx) => {
    return tx.transferOrder.create({
      data: {
        companyId,
        projectId,
        transferNumber: await nextSequentialNumber(companyId, 'transfer'),
        fromLocationId: input.fromLocationId,
        toLocationId: input.toLocationId,
        status: 'DRAFT',
        notes: input.notes?.trim() || null,
        createdBy: userId,
        lines: { create: lines },
      },
      include: transferInclude(),
    });
  });
}

export async function dispatchTransfer(companyId: string, userId: string, role: string, id: string) {
  await resolveDefaultProject(companyId, userId, role);
  const transfer = await prisma.transferOrder.findFirst({
    where: { id, companyId },
    include: { lines: true },
  });
  if (!transfer) throw ApiError.notFound('Transfer order not found');
  if (transfer.status !== 'DRAFT') {
    throw ApiError.badRequest(`Only draft transfers can be dispatched (current: ${transfer.status}).`);
  }

  return prisma.$transaction(async (tx) => {
    for (const line of transfer.lines) {
      const balance = await tx.stockBalance.findUnique({
        where: {
          locationId_resourceId: { locationId: transfer.fromLocationId, resourceId: line.resourceId },
        },
      });
      const onHand = balance ? Number(balance.quantity) : 0;
      const qty = Number(line.quantity);
      if (!balance || onHand < qty) {
        throw ApiError.unprocessable(
          `${line.itemName}: only ${onHand} ${line.unit} on hand at source, transfer requires ${qty} ${line.unit} — dispatch aborted.`,
        );
      }
      await tx.stockBalance.update({ where: { id: balance.id }, data: { quantity: { decrement: qty } } });
      const resOut = await tx.resource.findUnique({
        where: { id: line.resourceId },
        select: { avgCost: true },
      });
      await tx.stockMovement.create({
        data: {
          locationId: transfer.fromLocationId,
          resourceId: line.resourceId,
          quantity: qty,
          type: 'OUT',
          referenceType: 'TRANSFER_OUT',
          referenceId: transfer.id,
          notes: `Transfer out ${transfer.transferNumber}`,
          // INVENTORY_HORIZONTAL_PLATFORM (Phase 5.2): cost metadata at WAC.
          unitCost: Number(resOut?.avgCost ?? 0),
          inventoryValue: Math.round(Number(resOut?.avgCost ?? 0) * qty * 100) / 100,
        },
      });
    }
    return tx.transferOrder.update({
      where: { id: transfer.id },
      data: { status: 'IN_TRANSIT', dispatchedAt: new Date() },
      include: transferInclude(),
    });
  });
}

export async function receiveTransfer(companyId: string, userId: string, role: string, id: string) {
  await resolveDefaultProject(companyId, userId, role);
  const transfer = await prisma.transferOrder.findFirst({
    where: { id, companyId },
    include: { lines: true },
  });
  if (!transfer) throw ApiError.notFound('Transfer order not found');
  if (transfer.status !== 'IN_TRANSIT') {
    throw ApiError.badRequest(`Only in-transit transfers can be received (current: ${transfer.status}).`);
  }

  return prisma.$transaction(async (tx) => {
    for (const line of transfer.lines) {
      const qty = Number(line.quantity);
      const balance = await tx.stockBalance.findUnique({
        where: {
          locationId_resourceId: { locationId: transfer.toLocationId, resourceId: line.resourceId },
        },
      });
      if (balance) {
        await tx.stockBalance.update({ where: { id: balance.id }, data: { quantity: { increment: qty } } });
      } else {
        await tx.stockBalance.create({
          data: {
            locationId: transfer.toLocationId,
            resourceId: line.resourceId,
            quantity: qty,
          },
        });
      }
      const resIn = await tx.resource.findUnique({
        where: { id: line.resourceId },
        select: { avgCost: true },
      });
      await tx.stockMovement.create({
        data: {
          locationId: transfer.toLocationId,
          resourceId: line.resourceId,
          quantity: qty,
          type: 'IN',
          referenceType: 'TRANSFER_IN',
          referenceId: transfer.id,
          notes: `Transfer in ${transfer.transferNumber}`,
          // INVENTORY_HORIZONTAL_PLATFORM (Phase 5.2): cost metadata at WAC.
          unitCost: Number(resIn?.avgCost ?? 0),
          inventoryValue: Math.round(Number(resIn?.avgCost ?? 0) * qty * 100) / 100,
        },
      });
      await tx.transferOrderLine.update({
        where: { id: line.id },
        data: { receivedQty: qty },
      });
    }
    return tx.transferOrder.update({
      where: { id: transfer.id },
      data: { status: 'RECEIVED', receivedAt: new Date() },
      include: transferInclude(),
    });
  });
}

export async function cancelTransfer(companyId: string, userId: string, role: string, id: string) {
  await resolveDefaultProject(companyId, userId, role);
  const transfer = await prisma.transferOrder.findFirst({ where: { id, companyId } });
  if (!transfer) throw ApiError.notFound('Transfer order not found');
  // Stock has already left the source once dispatched — only drafts can cancel.
  if (transfer.status !== 'DRAFT') {
    throw ApiError.badRequest(
      `Only draft transfers can be cancelled. For an in-transit transfer, receive or reverse it.`,
    );
  }
  return prisma.transferOrder.update({
    where: { id },
    data: { status: 'CANCELLED' },
    include: transferInclude(),
  });
}

/* ── 3.3 Stock count / stocktake ──────────────────────────────────── */

function countInclude() {
  return {
    lines: true,
    location: { select: { id: true, name: true, code: true } },
  };
}

export async function listStockCounts(companyId: string, userId: string, role: string) {
  await resolveDefaultProject(companyId, userId, role);
  return prisma.stockCount.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    include: countInclude(),
  });
}

export async function getStockCount(companyId: string, userId: string, role: string, id: string) {
  await resolveDefaultProject(companyId, userId, role);
  const count = await prisma.stockCount.findFirst({ where: { id, companyId }, include: countInclude() });
  if (!count) throw ApiError.notFound('Stock count not found');
  return count;
}

export async function createStockCount(
  companyId: string,
  userId: string,
  role: string,
  input: CreateStockCountInput,
) {
  const projectId = await resolveDefaultProject(companyId, userId, role);
  const location = await prisma.stockLocation.findFirst({
    where: { id: input.locationId, companyId, isActive: true },
    select: { id: true },
  });
  if (!location) throw ApiError.badRequest('Location not found for this company.');

  const resources = await prisma.resource.findMany({
    where: { id: { in: input.lines.map((l) => l.resourceId) }, companyId },
    select: { id: true, name: true, unit: true },
  });
  const resourceById = new Map(resources.map((r) => [r.id, r]));
  const balances = await prisma.stockBalance.findMany({
    where: { locationId: input.locationId, resourceId: { in: input.lines.map((l) => l.resourceId) } },
    select: { resourceId: true, quantity: true },
  });
  const systemById = new Map(balances.map((b) => [b.resourceId, Number(b.quantity)]));

  const lines = input.lines.map((l) => {
    const r = resourceById.get(l.resourceId);
    if (!r) throw ApiError.notFound('Resource not found');
    const systemQty = systemById.get(l.resourceId) ?? 0;
    const countedQty = l.countedQty;
    return {
      resourceId: l.resourceId,
      itemName: r.name,
      unit: r.unit,
      systemQty,
      countedQty,
      variance: round3(countedQty - systemQty),
    };
  });

  return prisma.stockCount.create({
    data: {
      companyId,
      projectId,
      locationId: input.locationId,
      countNumber: await nextSequentialNumber(companyId, 'stock-count'),
      status: 'DRAFT',
      countDate: input.countDate,
      notes: input.notes?.trim() || null,
      createdBy: userId,
      lines: { create: lines },
    },
    include: countInclude(),
  });
}

export async function approveStockCount(companyId: string, userId: string, role: string, id: string) {
  await resolveDefaultProject(companyId, userId, role);
  const count = await prisma.stockCount.findFirst({
    where: { id, companyId },
    include: { lines: true },
  });
  if (!count) throw ApiError.notFound('Stock count not found');
  if (count.status !== 'DRAFT') {
    throw ApiError.badRequest(`Only draft stock counts can be approved (current: ${count.status}).`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    for (const line of count.lines) {
      const variance = Number(line.variance);
      if (Math.abs(variance) < 0.0001) continue;
      const balance = await tx.stockBalance.findUnique({
        where: {
          locationId_resourceId: { locationId: count.locationId, resourceId: line.resourceId },
        },
      });
      const resCount = await tx.resource.findUnique({
        where: { id: line.resourceId },
        select: { avgCost: true },
      });
      await tx.stockMovement.create({
        data: {
          locationId: count.locationId,
          resourceId: line.resourceId,
          quantity: Math.abs(variance),
          type: 'ADJUST',
          referenceType: 'STOCK_COUNT',
          referenceId: count.id,
          reason: StockAdjustReason.STOCKTAKE,
          notes: `Stock count ${count.countNumber} · counted ${Number(line.countedQty)} ${line.unit}`,
          // INVENTORY_HORIZONTAL_PLATFORM (Phase 5.2): cost metadata at WAC.
          unitCost: Number(resCount?.avgCost ?? 0),
          inventoryValue: Math.round(Number(resCount?.avgCost ?? 0) * Math.abs(variance) * 100) / 100,
        },
      });
      if (!balance) {
        await tx.stockBalance.create({
          data: {
            locationId: count.locationId,
            resourceId: line.resourceId,
            quantity: Number(line.countedQty),
          },
        });
      } else {
        await tx.stockBalance.update({
          where: { id: balance.id },
          data: { quantity: Number(line.countedQty) },
        });
      }
    }
    return tx.stockCount.update({
      where: { id: count.id },
      data: { status: 'APPROVED', approvedAt: new Date() },
      include: countInclude(),
    });
  });

  // INVENTORY_HORIZONTAL_PLATFORM (Phase 8.5): large-variance alert (inventory only).
  try {
    const location = await prisma.stockLocation.findUnique({
      where: { id: count.locationId },
      select: { name: true },
    });
    void notifyCountVariance(companyId, {
      countId: count.id,
      countNumber: count.countNumber,
      locationName: location?.name ?? 'warehouse',
      lines: count.lines.map((l) => ({
        itemName: l.itemName,
        systemQty: Number(l.systemQty),
        countedQty: Number(l.countedQty),
        variance: Number(l.variance),
      })),
    }).catch((err) => logger.warn('Count variance notify failed (non-fatal)', { error: String(err) }));
  } catch (err) {
    logger.warn('Count variance check failed (non-fatal)', { error: String(err), countId: count.id });
  }

  return updated;
}

export async function cancelStockCount(companyId: string, userId: string, role: string, id: string) {
  await resolveDefaultProject(companyId, userId, role);
  const count = await prisma.stockCount.findFirst({ where: { id, companyId } });
  if (!count) throw ApiError.notFound('Stock count not found');
  if (count.status !== 'DRAFT') {
    throw ApiError.badRequest(`Only draft stock counts can be cancelled (current: ${count.status}).`);
  }
  return prisma.stockCount.update({
    where: { id },
    data: { status: 'CANCELLED' },
    include: countInclude(),
  });
}

/* ── 3.4 Barcode identify ─────────────────────────────────────────── */

export async function findItemByBarcode(companyId: string, code: string) {
  const resource = await prisma.resource.findFirst({
    where: { companyId, barcode: code, isDeleted: false },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      type: true,
      unit: true,
      rate: true,
      sku: true,
      itemCode: true,
      barcode: true,
      hsnSacCode: true,
      gstRate: true,
    },
  });
  if (!resource) throw ApiError.notFound('No item found with this barcode');
  return resource;
}
