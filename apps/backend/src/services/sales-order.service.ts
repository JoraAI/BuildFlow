/**
 * BuildFlow - Sales order + delivery challan service
 * (INVENTORY_HORIZONTAL_PLATFORM Phase 2.1).
 *
 * Optional formal path: SalesOrder (DRAFT → CONFIRMED → DELIVERED → INVOICED)
 * → DeliveryChallan (DRAFT → DISPATCHED → DELIVERED) → Invoice (reuses the
 * existing invoice service for multi-line GST). Stock is moved OUT on dispatch.
 * The Issue → draft Invoice shortcut stays unchanged for small shops.
 */
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { logger } from '../config/logger';
import { nextSequentialNumber } from '../lib/id-generator';
import { assertProjectAccess } from '../middleware/project-access.middleware';
import { getDefaultProjectId } from './module-gate.service';
import { getOrCreateProjectStockLocation } from './procurement.service';
import { createInvoice, backfillStockIssueSalesOrders } from './invoice.service';
import { notifyLowStock } from './inventory-alerts.service';
import { resolveEffectiveRates } from './price-list.service';
import { allocateBatchOut, isBatchTracked } from './stock-batch.service';
import type {
  CreateSalesOrderInput,
  CreateDeliveryChallanInput,
  CreateInvoiceFromSalesOrderInput,
  RecordChallanReturnInput,
} from '@buildflow/shared';

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

async function resolveDefaultProject(companyId: string, userId: string, role: string) {
  const projectId = await getDefaultProjectId(companyId);
  if (!projectId) throw ApiError.forbidden('Sales orders are not available on this plan.');
  await assertProjectAccess(companyId, userId, role as never, projectId);
  return projectId;
}

function withLinesInclude() {
  return {
    lines: true,
    deliveryChallans: {
      include: { lines: true },
    },
  };
}

export async function listSalesOrders(companyId: string, userId: string, role: string) {
  const projectId = await resolveDefaultProject(companyId, userId, role);
  await backfillStockIssueSalesOrders(companyId, projectId);
  return prisma.salesOrder.findMany({
    where: { companyId, projectId },
    orderBy: { createdAt: 'desc' },
    include: withLinesInclude(),
  });
}

export async function getSalesOrder(companyId: string, userId: string, role: string, id: string) {
  await resolveDefaultProject(companyId, userId, role);
  const so = await prisma.salesOrder.findFirst({
    where: { id, companyId },
    include: withLinesInclude(),
  });
  if (!so) throw ApiError.notFound('Sales order not found');
  return so;
}

export async function createSalesOrder(
  companyId: string,
  userId: string,
  role: string,
  input: CreateSalesOrderInput,
) {
  const projectId = await resolveDefaultProject(companyId, userId, role);

  let customerName = input.customerName.trim();
  if (input.customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: input.customerId, companyId },
      select: { id: true, name: true },
    });
    if (!customer) throw ApiError.notFound('Customer not found');
    customerName = customer.name;
  }

  const resources = await prisma.resource.findMany({
    where: { id: { in: input.lines.map((l) => l.resourceId) }, companyId },
    select: { id: true, name: true, unit: true },
  });
  const byId = new Map(resources.map((r) => [r.id, r]));

  // INVENTORY_HORIZONTAL_PLATFORM (Phase 9.1): when a line has no explicit rate,
  // resolve the customer price-list override (customer → company default → catalog).
  const effectiveRates = await resolveEffectiveRates(
    companyId,
    input.customerId ?? null,
    input.lines.filter((l) => l.rate <= 0).map((l) => l.resourceId),
  );

  let subtotal = 0;
  let gstAmount = 0;
  const lines = input.lines.map((l) => {
    const r = byId.get(l.resourceId);
    if (!r) throw ApiError.notFound('Resource not found');
    const rate = l.rate > 0 ? l.rate : effectiveRates.get(l.resourceId) ?? 0;
    const amount = round2(l.quantity * rate);
    const gstRate = l.gstRate ?? 18;
    subtotal += amount;
    gstAmount += round2(amount * (gstRate / 100));
    return {
      resourceId: l.resourceId,
      itemName: r.name,
      unit: l.unit || r.unit,
      quantity: l.quantity,
      rate,
      amount,
      gstRate,
      deliveredQty: 0,
    };
  });
  const total = round2(subtotal + gstAmount);

  return prisma.salesOrder.create({
    data: {
      companyId,
      projectId,
      soNumber: await nextSequentialNumber(companyId, 'so'),
      customerId: input.customerId ?? null,
      customerName,
      status: 'DRAFT',
      orderDate: input.orderDate,
      expectedDelivery: input.expectedDelivery ?? null,
      notes: input.notes?.trim() || null,
      subtotal,
      gstAmount,
      total,
      createdBy: userId,
      lines: { create: lines },
    },
    include: withLinesInclude(),
  });
}

export async function updateSalesOrderStatus(
  companyId: string,
  userId: string,
  role: string,
  id: string,
  action: 'confirm' | 'cancel',
) {
  const so = await getSalesOrder(companyId, userId, role, id);
  if (action === 'confirm') {
    if (so.status !== 'DRAFT') throw ApiError.badRequest('Only draft sales orders can be confirmed');
    return prisma.salesOrder.update({ where: { id }, data: { status: 'CONFIRMED' }, include: withLinesInclude() });
  }
  if (so.status === 'INVOICED' || so.status === 'CANCELLED') {
    throw ApiError.badRequest('This sales order cannot be cancelled');
  }
  return prisma.salesOrder.update({ where: { id }, data: { status: 'CANCELLED' }, include: withLinesInclude() });
}

export async function listDeliveryChallans(companyId: string, userId: string, role: string) {
  const projectId = await resolveDefaultProject(companyId, userId, role);
  return prisma.deliveryChallan.findMany({
    where: { companyId, projectId },
    orderBy: { createdAt: 'desc' },
    include: {
      lines: true,
      salesOrder: { select: { id: true, soNumber: true } },
    },
  });
}

export async function createDeliveryChallan(
  companyId: string,
  userId: string,
  role: string,
  input: CreateDeliveryChallanInput,
) {
  const projectId = await resolveDefaultProject(companyId, userId, role);
  const so = await prisma.salesOrder.findFirst({
    where: { id: input.salesOrderId, companyId, projectId },
    include: { lines: true },
  });
  if (!so) throw ApiError.notFound('Sales order not found');
  if (so.status !== 'CONFIRMED') throw ApiError.badRequest('Sales order must be confirmed before creating a challan');

  const existingDraft = await prisma.deliveryChallan.findFirst({
    where: { salesOrderId: so.id, companyId, projectId, status: 'DRAFT' },
  });
  if (existingDraft) {
    throw ApiError.badRequest(
      `Sales order already has draft delivery challan ${existingDraft.dcNumber}. Please dispatch or edit it before creating a new one.`,
    );
  }

  const lines = so.lines
    .map((l) => {
      const remaining = Number(l.quantity) - Number(l.deliveredQty);
      const requested = input.lines?.find((x) => x.salesOrderLineId === l.id);
      const qty = requested ? Number(requested.quantity) : remaining;
      if (qty <= 0) return null;
      if (qty > remaining + 0.0001) {
        throw ApiError.badRequest(
          `Challan quantity for ${l.itemName} exceeds undelivered qty (remaining ${remaining}).`,
        );
      }
      return {
        salesOrderLineId: l.id,
        resourceId: l.resourceId,
        itemName: l.itemName,
        unit: l.unit,
        quantity: qty,
        rate: Number(l.rate),
        // INVENTORY_HORIZONTAL_PLATFORM (Phase 8.3): per-line batch, else the
        // challan-wide batch code (lite), else null.
        batchCode: requested?.batchCode ?? input.batchCode ?? null,
      };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);

  if (lines.length === 0) throw ApiError.badRequest('No undelivered quantities remain on this sales order');

  return prisma.deliveryChallan.create({
    data: {
      companyId,
      projectId,
      dcNumber: await nextSequentialNumber(companyId, 'dc'),
      salesOrderId: so.id,
      customerId: so.customerId,
      customerName: so.customerName,
      status: 'DRAFT',
      notes: input.notes?.trim() || null,
      createdBy: userId,
      lines: { create: lines },
    },
    include: { lines: true },
  });
}
export async function dispatchDeliveryChallan(
  companyId: string,
  userId: string,
  role: string,
  dcId: string,
  opts?: { locationId?: string },
) {
  const projectId = await resolveDefaultProject(companyId, userId, role);
  const dc = await prisma.deliveryChallan.findFirst({
    where: { id: dcId, companyId, projectId },
    include: { lines: true },
  });
  if (!dc) throw ApiError.notFound('Delivery challan not found');
  if (dc.status !== 'DRAFT') throw ApiError.badRequest('Only draft challans can be dispatched');

  const updated = await prisma.$transaction(async (tx) => {
    // INVENTORY_HORIZONTAL_PLATFORM (Phase 3.1): dispatch from a specific
    // warehouse (inventory only; omitted = company default location).
    const location = await getOrCreateProjectStockLocation(companyId, projectId, tx, {
      locationId: opts?.locationId,
    });
    const dcResourceModes = await tx.resource.findMany({
      where: { id: { in: dc.lines.map((l) => l.resourceId) } },
      select: { id: true, trackingMode: true },
    });
    const dcTracking = new Map(dcResourceModes.map((r) => [r.id, r.trackingMode]));

    for (const line of dc.lines) {
      const balance = await tx.stockBalance.findUnique({
        where: { locationId_resourceId: { locationId: location.id, resourceId: line.resourceId } },
      });
      const onHand = balance ? Number(balance.quantity) : 0;
      const qty = Number(line.quantity);
      if (!balance || onHand < qty) {
        throw ApiError.unprocessable(
          `${line.itemName}: only ${onHand} on hand in ${location.name}, challan requires ${qty} - dispatch aborted.`,
        );
      }
      await tx.stockBalance.update({ where: { id: balance.id }, data: { quantity: { decrement: qty } } });
      const res = await tx.resource.findUnique({
        where: { id: line.resourceId },
        select: { avgCost: true, name: true, unit: true },
      });
      // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.2): batch-tracked items are
      // FEFO-allocated out on dispatch - one OUT movement per lot.
      if (isBatchTracked(dcTracking.get(line.resourceId))) {
        const allocations = await allocateBatchOut(tx, {
          locationId: location.id,
          resourceId: line.resourceId,
          resourceName: res?.name ?? line.itemName,
          unit: res?.unit ?? line.unit,
          quantity: qty,
        });
        for (const alloc of allocations) {
          await tx.stockMovement.create({
            data: {
              locationId: location.id,
              resourceId: line.resourceId,
              quantity: alloc.quantity,
              type: 'OUT',
              referenceType: 'DELIVERY_CHALLAN',
              referenceId: dc.id,
              notes: `Dispatch ${dc.dcNumber} (lot ${alloc.batchCode})`,
              unitCost: Number(res?.avgCost ?? 0),
              inventoryValue: Math.round(Number(res?.avgCost ?? 0) * alloc.quantity * 100) / 100,
              batchCode: alloc.batchCode,
            },
          });
        }
      } else {
        await tx.stockMovement.create({
          data: {
            locationId: location.id,
            resourceId: line.resourceId,
            quantity: qty,
            type: 'OUT',
            referenceType: 'DELIVERY_CHALLAN',
            referenceId: dc.id,
            notes: `Dispatch ${dc.dcNumber}`,
            // INVENTORY_HORIZONTAL_PLATFORM (Phase 5.2): cost at WAC.
            unitCost: Number(res?.avgCost ?? 0),
            inventoryValue: Math.round(Number(res?.avgCost ?? 0) * qty * 100) / 100,
            // INVENTORY_HORIZONTAL_PLATFORM (Phase 8.3): optional batch / lot code.
            batchCode: line.batchCode,
          },
        });
      }
      if (line.salesOrderLineId) {
        await tx.salesOrderLine.update({
          where: { id: line.salesOrderLineId },
          data: { deliveredQty: { increment: qty } },
        });
      }
    }
    const dispatched = await tx.deliveryChallan.update({
      where: { id: dc.id },
      data: { status: 'DISPATCHED', dispatchedAt: new Date() },
      include: { lines: true },
    });

    // If every SO line is now fully delivered, move the SO to DELIVERED.
    if (dc.salesOrderId) {
      const soLines = await tx.salesOrderLine.findMany({ where: { salesOrderId: dc.salesOrderId } });
      const allDelivered = soLines.every((l) => Number(l.deliveredQty) >= Number(l.quantity) - 0.0001);
      if (allDelivered) {
        await tx.salesOrder.update({ where: { id: dc.salesOrderId }, data: { status: 'DELIVERED' } });
      }
    }
    return dispatched;
  });

  // INVENTORY_HORIZONTAL_PLATFORM (Phase 8.5): low-stock alert after dispatch
  // pushes any item below its reorder point (inventory only, non-fatal).
  try {
    const resourceIds = dc.lines.map((l) => l.resourceId);
    const [resources, balances] = await Promise.all([
      prisma.resource.findMany({
        where: { id: { in: resourceIds }, companyId },
        select: { id: true, name: true, unit: true, reorderPoint: true },
      }),
      prisma.stockBalance.findMany({
        where: { location: { companyId, projectId }, resourceId: { in: resourceIds } },
        select: { resourceId: true, quantity: true },
      }),
    ]);
    const onHand = new Map<string, number>();
    for (const b of balances) {
      onHand.set(b.resourceId, (onHand.get(b.resourceId) ?? 0) + Number(b.quantity));
    }
    void notifyLowStock(
      companyId,
      resources.map((r) => ({
        resourceId: r.id,
        name: r.name,
        unit: r.unit,
        onHand: onHand.get(r.id) ?? 0,
        reorderPoint: Number(r.reorderPoint ?? 0),
      })),
    ).catch((err) => logger.warn('Low-stock notify failed (non-fatal)', { error: String(err) }));
  } catch (err) {
    logger.warn('Dispatch low-stock check failed (non-fatal)', { error: String(err), dcId });
  }

  // Same as stock issue: goods left the warehouse, so create a draft invoice.
  let draftInvoiceId: string | null = null;
  if (updated.salesOrderId) {
    try {
      const invoice = await createInvoiceFromSalesOrder(companyId, userId, role, {
        salesOrderId: updated.salesOrderId,
      });
      draftInvoiceId = invoice.id;
    } catch (err) {
      logger.warn('Auto draft invoice from challan dispatch failed (non-fatal)', {
        error: String(err),
        dcId,
        salesOrderId: updated.salesOrderId,
      });
    }
  }

  return { ...updated, draftInvoiceId };
}

export async function deliverDeliveryChallan(companyId: string, userId: string, role: string, dcId: string) {
  await resolveDefaultProject(companyId, userId, role);
  const dc = await prisma.deliveryChallan.findFirst({ where: { id: dcId, companyId } });
  if (!dc) throw ApiError.notFound('Delivery challan not found');
  if (dc.status !== 'DISPATCHED') throw ApiError.badRequest('Only dispatched challans can be delivered');
  return prisma.deliveryChallan.update({
    where: { id: dcId },
    data: { status: 'DELIVERED', deliveredAt: new Date() },
    include: { lines: true },
  });
}

/**
 * Records on-site return / unconsumed buffer items against a dispatched delivery challan
 * before final invoicing. Restocks items to warehouse (Stock IN) and decrements delivered quantities.
 */
export async function recordChallanReturn(
  companyId: string,
  userId: string,
  role: string,
  dcId: string,
  input: RecordChallanReturnInput,
) {
  const projectId = await resolveDefaultProject(companyId, userId, role);
  const dc = await prisma.deliveryChallan.findFirst({
    where: { id: dcId, companyId, projectId },
    include: { lines: true, salesOrder: { include: { lines: true } } },
  });
  if (!dc) throw ApiError.notFound('Delivery challan not found');
  if (dc.status !== 'DISPATCHED' && dc.status !== 'DELIVERED') {
    throw ApiError.badRequest('Returns can only be recorded for dispatched or delivered challans');
  }

  return prisma.$transaction(async (tx) => {
    const location = await getOrCreateProjectStockLocation(companyId, projectId, tx, {
      locationId: input.locationId,
    });

    for (const retLine of input.lines) {
      const dcLine = dc.lines.find((l) => l.resourceId === retLine.resourceId);
      if (!dcLine) {
        throw ApiError.badRequest(`Item not found on delivery challan ${dc.dcNumber}`);
      }
      const returnQty = Number(retLine.quantity);
      if (returnQty <= 0) continue;
      if (returnQty > Number(dcLine.quantity)) {
        throw ApiError.badRequest(
          `Cannot return ${returnQty} of ${dcLine.itemName}; only ${dcLine.quantity} was dispatched on this challan.`,
        );
      }

      // Restock to warehouse if GOOD
      const returnKind = retLine.returnKind ?? 'GOOD';
      if (returnKind === 'GOOD') {
        await tx.stockBalance.upsert({
          where: { locationId_resourceId: { locationId: location.id, resourceId: retLine.resourceId } },
          create: { locationId: location.id, resourceId: retLine.resourceId, quantity: returnQty },
          update: { quantity: { increment: returnQty } },
        });
        const res = await tx.resource.findUnique({
          where: { id: retLine.resourceId },
          select: { avgCost: true, name: true, unit: true },
        });
        await tx.stockMovement.create({
          data: {
            locationId: location.id,
            resourceId: retLine.resourceId,
            quantity: returnQty,
            type: 'IN',
            referenceType: 'DELIVERY_CHALLAN',
            referenceId: dc.id,
            notes: `Challan return ${dc.dcNumber} (${retLine.reason ?? 'Unconsumed on-site return'})`,
            unitCost: Number(res?.avgCost ?? 0),
            inventoryValue: Math.round(Number(res?.avgCost ?? 0) * returnQty * 100) / 100,
          },
        });
      }

      // Decrement DC line qty
      const newDcQty = Number(dcLine.quantity) - returnQty;
      await tx.deliveryChallanLine.update({
        where: { id: dcLine.id },
        data: { quantity: newDcQty },
      });

      // Decrement SO line deliveredQty
      if (dcLine.salesOrderLineId) {
        await tx.salesOrderLine.update({
          where: { id: dcLine.salesOrderLineId },
          data: { deliveredQty: { decrement: returnQty } },
        });
      }
    }

    // Sync any DRAFT invoice linked to this Sales Order so it reflects the net delivered items
    if (dc.salesOrderId) {
      const draftInvoices = await tx.invoice.findMany({
        where: { companyId, salesOrderId: dc.salesOrderId, status: 'DRAFT' },
        include: { lineItems: true },
      });
      const updatedDcLines = await tx.deliveryChallanLine.findMany({
        where: { deliveryChallanId: dc.id },
      });

      for (const draftInv of draftInvoices) {
        for (const dcL of updatedDcLines) {
          const invLine = draftInv.lineItems.find((il) => il.resourceId === dcL.resourceId);
          if (invLine) {
            const netQty = Number(dcL.quantity);
            if (netQty > 0) {
              await tx.invoiceLineItem.update({
                where: { id: invLine.id },
                data: {
                  quantity: netQty,
                  amount: Math.round(netQty * Number(invLine.rate) * 100) / 100,
                },
              });
            } else {
              await tx.invoiceLineItem.delete({ where: { id: invLine.id } });
            }
          }
        }
        // Recalculate draft invoice total
        const remainingLines = await tx.invoiceLineItem.findMany({
          where: { invoiceId: draftInv.id },
        });
        const subtotal = remainingLines.reduce((acc, l) => acc + Number(l.amount), 0);
        const gstAmount = Math.round(subtotal * (Number(draftInv.gstRate || 18) / 100) * 100) / 100;
        const total = subtotal + gstAmount;
        await tx.invoice.update({
          where: { id: draftInv.id },
          data: { subtotal, gstAmount, total },
        });
      }
    }

    return tx.deliveryChallan.findUnique({
      where: { id: dc.id },
      include: { lines: true },
    });
  });
}

export async function createInvoiceFromSalesOrder(
  companyId: string,
  userId: string,
  role: string,
  input: CreateInvoiceFromSalesOrderInput,
) {
  const projectId = await resolveDefaultProject(companyId, userId, role);
  const so = await prisma.salesOrder.findFirst({
    where: { id: input.salesOrderId, companyId, projectId },
    include: { lines: true, deliveryChallans: { include: { lines: true } } },
  });
  if (!so) throw ApiError.notFound('Sales order not found');
  if (so.status === 'INVOICED') throw ApiError.badRequest('This sales order is already invoiced');
  if (so.status === 'CANCELLED' || so.status === 'DRAFT') {
    throw ApiError.badRequest('Sales order must be confirmed and delivered before invoicing');
  }

  // Invoice the quantities that were DISPATCHED/DELIVERED via challans.
  const deliveredByResource = new Map<string, number>();
  for (const dc of so.deliveryChallans) {
    if (dc.status === 'DISPATCHED' || dc.status === 'DELIVERED') {
      for (const l of dc.lines) {
        deliveredByResource.set(l.resourceId, (deliveredByResource.get(l.resourceId) ?? 0) + Number(l.quantity));
      }
    }
  }
  if (deliveredByResource.size === 0) {
    throw ApiError.badRequest('No delivered quantities to invoice - dispatch a delivery challan first.');
  }

  const lineItems = so.lines
    .filter((l) => (deliveredByResource.get(l.resourceId) ?? 0) > 0)
    .map((l) => ({
      description: l.itemName,
      quantity: deliveredByResource.get(l.resourceId)!,
      unit: l.unit,
      rate: Number(l.rate),
      gstRate: Number(l.gstRate),
      resourceId: l.resourceId,
    }));

  const customer = so.customerId
    ? await prisma.customer.findUnique({
        where: { id: so.customerId },
        select: { phone: true, billingAddress: true, gstin: true },
      })
    : null;

  const today = new Date();
  const invoice = await createInvoice(companyId, userId, {
    projectId,
    invoiceNumber: input.invoiceNumber ?? '', // '' → service auto-assigns
    customerId: so.customerId ?? undefined,
    salesOrderId: so.id,
    clientName: so.customerName,
    clientGstin: customer?.gstin ?? undefined,
    clientPhone: customer?.phone ?? undefined,
    clientAddress: customer?.billingAddress ?? undefined,
    invoiceDate: today,
    dueDate: input.dueDate ?? new Date(today.getTime() + 15 * 86400000),
    gstRate: input.gstRate ?? 18,
    tdsEnabled: false,
    tdsRate: 0,
    invoiceType: 'STANDARD',
    retentionPct: 0,
    notes: input.notes,
    lineItems,
  });

  await prisma.salesOrder.update({ where: { id: so.id }, data: { status: 'INVOICED' } });
  return invoice;
}

