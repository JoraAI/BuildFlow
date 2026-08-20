import { prisma } from '../lib/prisma';
import { Prisma, type ApprovalStatus } from '@prisma/client';
import { ApiError } from '../utils/errors';
import {
  nextSequentialNumber,
  peekNextSequentialNumber,
  resolveSequentialNumber,
} from '../lib/id-generator';
import { assertProjectAccess } from '../middleware/project-access.middleware';
import { getDefaultProjectId } from './module-gate.service';
import { getProject } from './project.service';
import type {
  CreateRequisitionInput,
  CreatePurchaseOrderInput,
  CreateGrnInput,
  IssueStockInput,
  AdjustStockInput,
  OpeningStockImportInput,
  QuickVendorReceiptInput,
} from '@buildflow/shared';
import { StockAdjustReason } from '@buildflow/shared';
import { resolveRequisitionLineRate } from './material-rate.service';
import { alertOnPurchaseOrderRateVariance } from './material-rate-alert.service';
import { createDraftBillFromGrn } from './bill.service';
import { createDraftInvoiceFromStockIssue } from './invoice.service';
import { updateWacOnIn } from './finance.service';
import { notifyLowStock, notifyPoRateAnomaly } from './inventory-alerts.service';
import { applyBatchIn, allocateBatchOut, isBatchTracked } from './stock-batch.service';
import { logger } from '../config/logger';
import {
  createDraftIndentsFromDemand,
  fetchBoqMaterialDemands,
  previewBoqShortfalls,
} from './material-demand.service';

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}

export async function getOrCreateProjectStockLocation(
  companyId: string,
  projectId: string,
  tx: Pick<typeof prisma, 'stockLocation'>,
  opts?: { locationId?: string },
) {
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 3.1): an explicit location wins.
  if (opts?.locationId) {
    const loc = await tx.stockLocation.findFirst({
      where: { id: opts.locationId, companyId },
    });
    if (!loc) throw ApiError.notFound('Stock location not found');
    return loc;
  }
  // Phase 3.1: inventory tenants resolve the company default location. The
  // lazy-created first location for an inventory company becomes the default.
  const isInventory =
    (
      await prisma.company.findUnique({
        where: { id: companyId },
        select: { subscriptionPlan: true },
      })
    )?.subscriptionPlan === 'INVENTORY';
  if (isInventory) {
    const def = await tx.stockLocation.findFirst({
      where: { companyId, projectId, isDefault: true },
    });
    if (def) return def;
    const any = await tx.stockLocation.findFirst({
      where: { companyId, projectId },
    });
    if (any) return any;
  }
  const existing = await tx.stockLocation.findFirst({
    where: { companyId, projectId },
  });
  if (existing) return existing;
  return tx.stockLocation.create({
    data: {
      companyId,
      projectId,
      name: isInventory ? 'Main Store' : 'Site Store',
      isDefault: isInventory,
    },
  });
}

async function enrichLinesWithBoq<T extends { boqItemId: string | null }>(
  lines: T[],
): Promise<Array<T & { boqItem: { itemCode: string; description: string } | null }>> {
  const boqIds = lines.map((l) => l.boqItemId).filter(Boolean) as string[];
  if (boqIds.length === 0) {
    return lines.map((l) => ({ ...l, boqItem: null }));
  }
  const boqItems = await prisma.bOQItem.findMany({
    where: { id: { in: boqIds } },
    select: { id: true, itemCode: true, description: true },
  });
  const boqById = new Map(boqItems.map((b) => [b.id, b]));
  return lines.map((l) => ({
    ...l,
    boqItem: l.boqItemId ? (boqById.get(l.boqItemId) ?? null) : null,
  }));
}

export async function listRequisitions(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
) {
  await assertProjectAccess(companyId, userId, role as never, projectId);
  const requisitions = await prisma.materialRequisition.findMany({
    where: { projectId, companyId },
    include: {
      lines: {
        include: {
          resource: { select: { id: true, name: true, costPrice: true, avgCost: true } },
        },
      },
      purchaseOrders: {
        select: {
          id: true,
          poNumber: true,
          status: true,
          vendorName: true,
          vendorGstin: true,
          totalAmount: true,
          lines: {
            include: { resource: { select: { id: true, name: true, unit: true } } },
          },
          goodsReceipts: {
            select: {
              id: true,
              grnNumber: true,
              receivedDate: true,
              lines: { select: { resourceId: true, quantity: true, unit: true } },
            },
            orderBy: { receivedDate: 'desc' },
          },
          // PROC-B2: Include linked bills so the mobile PO card can show
          // "Vendor bill pending" vs "Vendor bill recorded".
          bills: {
            select: {
              id: true,
              billNumber: true,
              status: true,
              total: true,
              attachmentUrl: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return Promise.all(
    requisitions.map(async (req) => ({
      ...req,
      lines: await enrichLinesWithBoq(req.lines),
    })),
  );
}

export async function getBoqShortfalls(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
) {
  await assertProjectAccess(companyId, userId, role as never, projectId);
  return previewBoqShortfalls(companyId, projectId);
}

export async function generateIndentsFromBoq(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
) {
  await assertProjectAccess(companyId, userId, role as never, projectId, ['OWNER', 'PM', 'SUPERVISOR']);

  const demands = await fetchBoqMaterialDemands(projectId, companyId);
  const lines = demands.map(({ itemCode: _c, description: _d, ...line }) => line);
  return createDraftIndentsFromDemand(
    companyId,
    userId,
    projectId,
    lines,
    'BOQ_UPDATE',
    'bulk-generate',
  );
}

export async function createRequisition(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
  input: CreateRequisitionInput,
) {
  await assertProjectAccess(companyId, userId, role as never, projectId, ['OWNER', 'PM', 'SUPERVISOR']);

  const lineCreates = await Promise.all(
    input.lines.map(async (line) => {
      const { expectedRate, rateSource } = await resolveRequisitionLineRate(companyId, projectId, {
        resourceId: line.resourceId,
        boqItemId: line.boqItemId,
        expectedRate: line.expectedRate,
        rateSource: line.rateSource,
      });
      return {
        // FIX (NR-13): resourceId can now be null for BOQ-only lines.
        resourceId: line.resourceId ?? null,
        quantity: line.quantity,
        unit: line.unit,
        boqItemId: line.boqItemId ?? null,
        expectedRate,
        rateSource,
      };
    }),
  );

  // INVENTORY_UX_POLISH (D2): inventory indents auto-reach APPROVED on create -
  // no DRAFT → SUBMITTED → APPROVED clicks. Construction keeps the full flow.
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { subscriptionPlan: true },
  });
  const autoApprove = company.subscriptionPlan === 'INVENTORY';

  return prisma.materialRequisition.create({
    data: {
      projectId,
      companyId,
      // Always auto-generate reqNumber - it must not be client-editable.
      // Format: IND-{YYYY}-{NNNN} (scoped per company + year).
      reqNumber: await nextSequentialNumber(companyId, 'indent'),
      notes: input.notes,
      requestedBy: userId,
      status: autoApprove ? 'APPROVED' : undefined,
      approvedBy: autoApprove ? userId : undefined,
      lines: { create: lineCreates },
    },
    include: {
      lines: { include: { resource: { select: { id: true, name: true } } } },
    },
  });
}

export async function deleteRequisition(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
  requisitionId: string,
) {
  await assertProjectAccess(companyId, userId, role as never, projectId, ['OWNER', 'PM', 'SUPERVISOR']);
  const req = await prisma.materialRequisition.findFirst({
    where: { id: requisitionId, projectId, companyId },
    include: { purchaseOrders: { select: { id: true } } },
  });
  if (!req) throw ApiError.notFound('Requisition not found');
  // Safety: only allow deleting DRAFT requisitions with no POs
  if (req.status !== 'DRAFT') {
    throw ApiError.badRequest('Only draft requisitions can be deleted');
  }
  if (req.purchaseOrders.length > 0) {
    throw ApiError.badRequest('Cannot delete requisition with purchase orders');
  }
  await prisma.materialRequisition.delete({ where: { id: requisitionId } });
  return { success: true };
}

export async function submitRequisition(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
  requisitionId: string,
) {
  const req = await prisma.materialRequisition.findFirst({
    where: { id: requisitionId, projectId, companyId },
  });
  if (!req) throw ApiError.notFound('Requisition not found');
  await assertProjectAccess(companyId, userId, role as never, projectId, ['OWNER', 'PM', 'SUPERVISOR']);
  if (req.status !== 'DRAFT' && req.status !== 'REJECTED') {
    throw ApiError.badRequest('Only draft or rejected requisitions can be submitted');
  }
  return prisma.materialRequisition.update({
    where: { id: requisitionId },
    data: { status: 'SUBMITTED' },
    include: { lines: true },
  });
}

export async function approveRequisition(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
  requisitionId: string,
) {
  // Route-level guard `requirePermission('procurement.approve_indent')` enforces
  // who may call this. The company can customize that per role in Settings.
  const req = await prisma.materialRequisition.findFirst({
    where: { id: requisitionId, projectId, companyId },
  });
  if (!req) throw ApiError.notFound('Requisition not found');
  await assertProjectAccess(companyId, userId, role as never, projectId);
  if (req.status !== 'SUBMITTED') throw ApiError.badRequest('Requisition must be submitted first');

  return prisma.materialRequisition.update({
    where: { id: requisitionId },
    data: { status: 'APPROVED', approvedBy: userId },
    include: { lines: true },
  });
}

export async function createPO(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
  input: CreatePurchaseOrderInput,
) {
  await assertProjectAccess(companyId, userId, role as never, projectId, ['OWNER', 'PM', 'ACCOUNTANT']);

  if (input.requisitionId) {
    const req = await prisma.materialRequisition.findFirst({
      where: { id: input.requisitionId, projectId, companyId },
      include: { lines: true },
    });
    if (!req) throw ApiError.notFound('Requisition not found');
    if (req.status !== 'APPROVED') throw ApiError.badRequest('Requisition must be approved before creating PO');

    // FIX (EST-M6): Validate that every PO line exists on the requisition and
    // doesn't exceed the requisitioned quantity (cumulative across POs).
    // FIX (R2-6): Match PO lines to requisition by resourceId or boqItemId (BOQ-only lines).
    const reqLineByResource = new Map(req.lines.filter((l) => l.resourceId).map((l) => [l.resourceId!, l]));
    const reqLineByBoq = new Map(req.lines.filter((l) => l.boqItemId).map((l) => [l.boqItemId!, l]));
    const existingPOs = await prisma.purchaseOrder.findMany({
      where: { requisitionId: input.requisitionId },
      include: { lines: { select: { resourceId: true, quantity: true } } },
    });
    // PROCUREMENT_PICKER_PERF (locked rule): one PO per indent. A second PO is
    // rejected so the "New PO" picker (APPROVED + zero POs) can't dual-submit.
    if (existingPOs.length > 0) {
      throw ApiError.badRequest(
        'This indent already has a purchase order. Create a new indent for additional orders.',
      );
    }
    const orderedQty = new Map<string, number>();
    for (const ep of existingPOs) {
      for (const l of ep.lines) {
        const k = `r:${l.resourceId}`;
        orderedQty.set(k, (orderedQty.get(k) ?? 0) + Number(l.quantity));
      }
    }
    for (const poLine of input.lines) {
      const reqLine =
        reqLineByResource.get(poLine.resourceId) ??
        (poLine.boqItemId ? reqLineByBoq.get(poLine.boqItemId) : undefined);
      if (!reqLine) {
        throw ApiError.badRequest(`Resource on PO line is not on the requisition`);
      }
      const orderKey = poLine.boqItemId ? `b:${poLine.boqItemId}` : `r:${poLine.resourceId}`;
      const alreadyOrdered = orderedQty.get(orderKey) ?? 0;
      const totalAfter = alreadyOrdered + poLine.quantity;
      if (totalAfter > Number(reqLine.quantity) + 0.001) {
        throw ApiError.badRequest(
          `PO quantity exceeds requisition: requisitioned ${Number(reqLine.quantity)}, already ordered ${alreadyOrdered}, ` +
            `this PO adds ${poLine.quantity} (total ${totalAfter}).`,
        );
      }
    }
  }

  const lines = input.lines.map((l) => ({
    ...l,
    amount: round2(l.quantity * l.rate),
  }));
  const totalAmount = round2(lines.reduce((s, l) => s + l.amount, 0));

  // Generate poNumber server-side if not provided; sync counter when user keeps/overrides a sequential suggestion.
  const poNumber = await resolveSequentialNumber(companyId, 'po', input.poNumber);

  // INVENTORY_HORIZONTAL_PLATFORM (Phase 4.4): simple approval thresholds for
  // inventory POs. Off (0) by default → auto-approve like today. When enabled:
  //   total <  poAutoApproveBelow → APPROVED (auto)
  //   total <= poOwnerApproveAbove → SUBMITTED (manager approves)
  //   total >  poOwnerApproveAbove → SUBMITTED (OWNER only, enforced in approve)
  let poStatus: ApprovalStatus = 'APPROVED';
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { subscriptionPlan: true, poAutoApproveBelow: true, poOwnerApproveAbove: true },
  });
  if (company.subscriptionPlan === 'INVENTORY' && Number(company.poAutoApproveBelow) > 0) {
    const autoBelow = Number(company.poAutoApproveBelow);
    const ownerAbove = Math.max(Number(company.poOwnerApproveAbove), autoBelow);
    if (totalAmount < autoBelow) {
      poStatus = 'APPROVED';
    } else if (totalAmount <= ownerAbove) {
      poStatus = 'SUBMITTED';
    } else {
      poStatus = 'SUBMITTED';
    }
  }

  let po;
  try {
    po = await prisma.purchaseOrder.create({
      data: {
        projectId,
        companyId,
        requisitionId: input.requisitionId,
        poNumber,
        vendorName: input.vendorName,
        totalAmount,
        // POs are created from an already-approved requisition, so they start
        // APPROVED for construction; inventory applies the 4.4 banding above.
        status: poStatus,
        lines: { create: lines },
      },
      include: { lines: { include: { resource: { select: { id: true, name: true } } } } },
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw ApiError.conflict(
        `PO number "${poNumber}" already exists. Edit the number or clear it to auto-assign.`,
      );
    }
    throw err;
  }

  // Fire-and-forget: rate alerts may touch Redis (Bull). Awaiting them made the
  // HTTP response hang when Redis was slow/unreachable - PO was saved but the
  // client never saw success (modal stuck until reload).
  void alertOnPurchaseOrderRateVariance(
    companyId,
    projectId,
    po.id,
    po.poNumber,
    input.lines.map((l) => ({ resourceId: l.resourceId, rate: l.rate })),
  ).catch((err) =>
    logger.warn('PO rate alert failed (non-fatal)', { error: String(err) }),
  );

  // INVENTORY_HORIZONTAL_PLATFORM (Phase 8.5): in-app anomaly alert (inventory only).
  void notifyPoRateAnomaly(companyId, {
    poId: po.id,
    poNumber: po.poNumber,
    vendorName: po.vendorName,
    lines: input.lines.map((l) => ({ resourceId: l.resourceId, rate: l.rate })),
  }).catch((err) => logger.warn('Inventory PO rate notify failed (non-fatal)', { error: String(err) }));

  return po;
}

export async function getNextDocumentNumbers(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
) {
  await assertProjectAccess(companyId, userId, role as never, projectId);
  const [po, grn] = await Promise.all([
    peekNextSequentialNumber(companyId, 'po'),
    peekNextSequentialNumber(companyId, 'grn'),
  ]);
  return { po, grn };
}

/**
 * INVENTORY_HORIZONTAL_PLATFORM (Phase 4.4): approve a SUBMITTED inventory PO.
 *
 * Banding (enabled when poAutoApproveBelow > 0):
 *   - total ≤ poOwnerApproveAbove → manager approval (OWNER/PM/INVENTORY_MANAGER)
 *   - total >  poOwnerApproveAbove → OWNER only (403 otherwise)
 * Construction POs are always created APPROVED, so this returns 400 for them -
 * the construction Draft→Submit→Approve path is unchanged.
 */
export async function approvePurchaseOrder(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
  poId: string,
) {
  await assertProjectAccess(companyId, userId, role as never, projectId, [
    'OWNER',
    'PM',
    'INVENTORY_MANAGER',
  ]);

  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, companyId, projectId },
  });
  if (!po) throw ApiError.notFound('Purchase order not found');
  if (po.status !== 'SUBMITTED') {
    throw ApiError.badRequest(`Only submitted purchase orders can be approved (current: ${po.status}).`);
  }

  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { subscriptionPlan: true, poAutoApproveBelow: true, poOwnerApproveAbove: true },
  });
  if (company.subscriptionPlan === 'INVENTORY' && Number(company.poAutoApproveBelow) > 0) {
    const ownerAbove = Math.max(Number(company.poOwnerApproveAbove), Number(company.poAutoApproveBelow));
    if (Number(po.totalAmount) > ownerAbove && role !== 'OWNER') {
      throw ApiError.forbidden(
        'This purchase order exceeds your approval authority - only the owner can approve it.',
      );
    }
  }

  return prisma.purchaseOrder.update({
    where: { id: poId },
    data: { status: 'APPROVED' },
    include: { lines: { include: { resource: { select: { id: true, name: true } } } } },
  });
}

export async function createGRN(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
  input: CreateGrnInput,
) {
  await assertProjectAccess(companyId, userId, role as never, projectId, ['OWNER', 'PM', 'SUPERVISOR']);

  const po = await prisma.purchaseOrder.findFirst({
    where: { id: input.purchaseOrderId, projectId, companyId },
    include: { lines: true, requisition: { include: { lines: true } } },
  });
  if (!po) throw ApiError.notFound('Purchase order not found');

  // FIX (EST-H3): Require PO status to be APPROVED before receiving goods.
  if (po.status !== 'APPROVED') {
    throw ApiError.badRequest(
      `Cannot create GRN against a PO with status "${po.status}". The PO must be APPROVED first.`,
    );
  }

  // FIX (EST-H3): Validate each GRN line against the PO - the resource must be
  // on the PO, and the cumulative received quantity must not exceed the PO
  // line quantity (prevent over-receiving).
  const poLineByResource = new Map(po.lines.map((l) => [l.resourceId, l]));

  // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.2): per-line tracking mode so
  // batch-tracked receipts also write StockBatchBalance lots (K6 dual-write).
  const grnResources = await prisma.resource.findMany({
    where: { id: { in: input.lines.map((l) => l.resourceId) }, companyId },
    select: { id: true, trackingMode: true },
  });
  const trackingByResource = new Map(grnResources.map((r) => [r.id, r.trackingMode]));

  // Fetch cumulative received quantities from existing GRNs
  const existingGrns = await prisma.goodsReceiptNote.findMany({
    where: { purchaseOrderId: po.id },
    include: { lines: { select: { resourceId: true, quantity: true } } },
  });
  const cumulativeReceived = new Map<string, number>();
  for (const g of existingGrns) {
    for (const l of g.lines) {
      cumulativeReceived.set(l.resourceId, (cumulativeReceived.get(l.resourceId) ?? 0) + Number(l.quantity));
    }
  }

  // PROCUREMENT_PICKER_PERF (locked rule): once every PO line is fully
  // received (±0.001), the PO drops out of the "New GRN" picker and further
  // GRNs are rejected here (partial receipts stay allowed until then).
  const fullyReceived = po.lines.every(
    (l) => (cumulativeReceived.get(l.resourceId) ?? 0) >= Number(l.quantity) - 0.001,
  );
  if (fullyReceived) {
    throw ApiError.badRequest('This PO is fully received.');
  }

  for (const grnLine of input.lines) {
    const poLine = poLineByResource.get(grnLine.resourceId);
    if (!poLine) {
      throw ApiError.badRequest(
        `Resource ${grnLine.resourceId} is not on this purchase order. Cannot receive items not ordered.`,
      );
    }
    const alreadyReceived = cumulativeReceived.get(grnLine.resourceId) ?? 0;
    const newTotal = alreadyReceived + grnLine.quantity;
    if (newTotal > Number(poLine.quantity)) {
      throw ApiError.badRequest(
        `Over-receiving detected: PO line for this resource is ${Number(poLine.quantity)} ${poLine.unit}, ` +
          `already received ${alreadyReceived}, attempting to receive ${grnLine.quantity} ` +
          `(total ${newTotal}). Maximum remaining: ${Number(poLine.quantity) - alreadyReceived}.`,
      );
    }
  }

  const grnNumber = await resolveSequentialNumber(companyId, 'grn', input.grnNumber);

  // INVENTORY_HORIZONTAL_PLATFORM (Phase 5.1): landed cost allocation. Extra
  // acquisition costs (freight/insurance/handling/customs) are added to the PO
  // rate per line, allocated by quantity (default) or by line value.
  const landedCosts = {
    freightCost: input.freightCost ?? 0,
    insuranceCost: input.insuranceCost ?? 0,
    handlingCost: input.handlingCost ?? 0,
    customsCost: input.customsCost ?? 0,
  };
  const totalExtra = landedCosts.freightCost + landedCosts.insuranceCost + landedCosts.handlingCost + landedCosts.customsCost;
  const allocation = input.landedCostAllocation ?? 'QUANTITY';
  const unitCostByResource = new Map<string, number>();
  if (totalExtra > 0 && allocation === 'VALUE') {
    const totalValue = input.lines.reduce(
      (s, l) => s + Number(poLineByResource.get(l.resourceId)?.rate ?? 0) * l.quantity,
      0,
    );
    for (const l of input.lines) {
      const poRate = Number(poLineByResource.get(l.resourceId)?.rate ?? 0);
      const share = totalValue > 0 ? totalExtra * ((poRate * l.quantity) / totalValue) : 0;
      unitCostByResource.set(l.resourceId, poRate + (l.quantity > 0 ? share / l.quantity : 0));
    }
  } else {
    const totalQty = input.lines.reduce((s, l) => s + l.quantity, 0);
    const extraPerUnit = totalQty > 0 ? totalExtra / totalQty : 0;
    for (const l of input.lines) {
      unitCostByResource.set(
        l.resourceId,
        Number(poLineByResource.get(l.resourceId)?.rate ?? 0) + extraPerUnit,
      );
    }
  }

  let grn;
  try {
    grn = await prisma.$transaction(async (tx) => {
    const created = await tx.goodsReceiptNote.create({
      data: {
        projectId,
        companyId,
        purchaseOrderId: input.purchaseOrderId,
        grnNumber,
        receivedDate: input.receivedDate,
        notes: input.notes,
        // INVENTORY_HORIZONTAL_PLATFORM (Phase 5.1): landed cost metadata.
        freightCost: landedCosts.freightCost,
        insuranceCost: landedCosts.insuranceCost,
        handlingCost: landedCosts.handlingCost,
        customsCost: landedCosts.customsCost,
        landedCostAllocation: allocation,
        lines: {
          create: input.lines.map((l) => ({
            resourceId: l.resourceId,
            quantity: l.quantity,
            unit: l.unit,
            unitCost: unitCostByResource.get(l.resourceId) ?? 0,
            // INVENTORY_HORIZONTAL_PLATFORM (Phase 8.3) + Phase 11.2: lot code +
            // dates on the receipt line (audit + StockBatchBalance copy source).
            batchCode: l.batchCode ?? null,
            manufacturedAt: l.manufacturedAt ?? null,
            expiresAt: l.expiresAt ?? null,
          })),
        },
      },
      include: { lines: true },
    });

    const location = await getOrCreateProjectStockLocation(companyId, projectId, tx, {
      locationId: input.locationId,
    });

    for (const line of input.lines) {
      const balance = await tx.stockBalance.findUnique({
        where: {
          locationId_resourceId: { locationId: location.id, resourceId: line.resourceId },
        },
      });
      const unitCost = unitCostByResource.get(line.resourceId) ?? 0;

      // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.2): batch-tracked receipts
      // must name a lot and also write the StockBatchBalance row (K6 dual-write).
      const tracked = isBatchTracked(trackingByResource.get(line.resourceId));
      if (tracked) {
        if (!line.batchCode) {
          throw ApiError.unprocessable(
            'Batch-tracked items require a batch / lot code on receipt (GRN).',
          );
        }
        await applyBatchIn(tx, {
          locationId: location.id,
          resourceId: line.resourceId,
          batchCode: line.batchCode,
          quantity: line.quantity,
          manufacturedAt: line.manufacturedAt ?? null,
          expiresAt: line.expiresAt ?? null,
        });
      }

      if (balance) {
        await tx.stockBalance.update({
          where: { id: balance.id },
          data: { quantity: { increment: line.quantity } },
        });
      } else {
        await tx.stockBalance.create({
          data: {
            locationId: location.id,
            resourceId: line.resourceId,
            quantity: line.quantity,
          },
        });
      }

      await tx.stockMovement.create({
        data: {
          locationId: location.id,
          resourceId: line.resourceId,
          quantity: line.quantity,
          type: 'IN',
          referenceType: 'GRN',
          referenceId: created.id,
          // INVENTORY_HORIZONTAL_PLATFORM (Phase 5.1/5.2): cost metadata + WAC.
          unitCost,
          inventoryValue: round2(unitCost * line.quantity),
          // INVENTORY_HORIZONTAL_PLATFORM (Phase 8.3): optional batch / lot code.
          batchCode: line.batchCode,
        },
      });

      await updateWacOnIn(
        tx,
        line.resourceId,
        balance ? Number(balance.quantity) : 0,
        line.quantity,
        unitCost,
      );

      // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.7): the received unit cost
      // is the vendor-cost source of truth. Update costPrice (WAC already
      // updated above); skip a zero/blank PO rate so it cannot wipe a known
      // cost. Construction ignores costPrice entirely.
      if (unitCost > 0) {
        await tx.resource.update({
          where: { id: line.resourceId },
          data: { costPrice: unitCost },
        });
      }
    }

    // FIX (EST-H4): Apportion GRN quantity across ALL matching requisition lines
    // by outstanding quantity, instead of crediting the FULL quantity to the
    // first matching line. Two requisition lines for one resource against
    // different BOQ items should each get their proportional share.
    if (po.requisition?.lines.length) {
      for (const grnLine of input.lines) {
        // Find ALL requisition lines matching this resource that have a BOQ item
        const matchingReqLines = po.requisition.lines.filter(
          (rl) => rl.resourceId === grnLine.resourceId && rl.boqItemId,
        );
        if (matchingReqLines.length === 0) continue;

        // Look up outstanding (unfulfilled) qty per BOQ item to apportion
        const boqItemIds = matchingReqLines.map((rl) => rl.boqItemId!);
        const boqItems = await tx.bOQItem.findMany({
          where: { id: { in: boqItemIds } },
          select: { id: true, quantity: true, procuredQty: true },
        });
        const outstandingByBoq = new Map(
          boqItems.map((b) => [
            b.id,
            Math.max(0, Number(b.quantity) - Number(b.procuredQty)),
          ]),
        );
        const totalOutstanding = [...outstandingByBoq.values()].reduce((s, v) => s + v, 0);

        if (totalOutstanding <= 0) continue;

        // Apportion the GRN quantity proportionally
        let remaining = grnLine.quantity;
        const linesToCredit = matchingReqLines
          .map((rl) => ({
            boqItemId: rl.boqItemId!,
            outstanding: outstandingByBoq.get(rl.boqItemId!) ?? 0,
          }))
          .filter((l) => l.outstanding > 0)
          .sort((a, b) => b.outstanding - a.outstanding);

        for (let i = 0; i < linesToCredit.length; i++) {
          const { boqItemId, outstanding } = linesToCredit[i];
          // Last line gets the remainder to avoid rounding gaps
          const share = i === linesToCredit.length - 1
            ? remaining
            : Math.min(outstanding, grnLine.quantity * (outstanding / totalOutstanding));
          const credit = Math.max(0, Math.min(share, remaining));
          if (credit > 0) {
            await tx.bOQItem.update({
              where: { id: boqItemId },
              data: { procuredQty: { increment: credit } },
            });
            remaining -= credit;
          }
        }
      }
    }

    // FIX (EST-M1): After GRN is created, check if the requisition is fully
    // fulfilled (all lines received). NOTE: status is intentionally left as
    // APPROVED - there is no CLOSED state in the requisition state machine yet
    // (transition would require a schema migration). Tracking fulfillment via
    // received-vs-ordered quantities only; no cosmetic no-op write here.
    if (po.requisition?.lines.length) {
      // Sum all GRN lines across all GRNs for this PO that match requisition resources
      const allGrns = await prisma.goodsReceiptNote.findMany({
        where: { purchaseOrderId: po.id },
        include: { lines: { select: { resourceId: true, quantity: true } } },
      });
      const receivedByResource = new Map<string, number>();
      for (const g of allGrns) {
        for (const l of g.lines) {
          receivedByResource.set(l.resourceId, (receivedByResource.get(l.resourceId) ?? 0) + Number(l.quantity));
        }
      }
      // Check if all requisition lines are fully received
      const allFulfilled = po.requisition.lines.every((rl) => {
        if (!rl.resourceId) return true; // BOQ-only lines skip this check
        const received = receivedByResource.get(rl.resourceId) ?? 0;
        return received >= Number(rl.quantity) - 0.001; // tolerance
      });
      // No status transition - see note above. A CLOSED enum can be added in a
      // future migration if business logic requires marking requisitions done.
      void allFulfilled;
    }

    return created;
  });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw ApiError.conflict(
        `GRN number "${grnNumber}" already exists. Edit the number or clear it to auto-assign.`,
      );
    }
    throw err;
  }

  // Inventory only: draft vendor bill from received qty × PO rates.
  // After stock is committed - failures are non-fatal (do not roll back GRN).
  try {
    await createDraftBillFromGrn({
      companyId,
      projectId,
      purchaseOrderId: grn.purchaseOrderId,
      goodsReceiptId: grn.id,
      grnNumber: grn.grnNumber,
      receivedDate: grn.receivedDate,
      lines: grn.lines.map((l) => ({
        resourceId: l.resourceId,
        quantity: Number(l.quantity),
        unit: l.unit,
      })),
    });
  } catch (err) {
    logger.warn('Auto draft bill from GRN failed (non-fatal)', { error: String(err), grnId: grn.id });
  }

  return grn;
}

type StockTx = Pick<
  typeof prisma,
  'stockLocation' | 'stockBalance' | 'stockMovement'
>;

export async function issueStockForDailyReport(
  companyId: string,
  projectId: string,
  dailyReportId: string,
  lines: Array<{ resourceId: string; quantityUsed: number }>,
  tx: StockTx = prisma,
  opts?: { strict?: boolean },
) {
  const strict = opts?.strict ?? false;
  const location = await getOrCreateProjectStockLocation(companyId, projectId, tx);

  const resourceMeta = strict
    ? new Map(
        (
          await prisma.resource.findMany({
            where: { id: { in: lines.map((l) => l.resourceId) } },
            select: { id: true, name: true, unit: true },
          })
        ).map((r) => [r.id, r]),
      )
    : null;

  for (const line of lines) {
    const balance = await tx.stockBalance.findUnique({
      where: {
        locationId_resourceId: { locationId: location.id, resourceId: line.resourceId },
      },
    });
    const onHand = balance ? Number(balance.quantity) : 0;
    if (!balance || onHand < line.quantityUsed) {
      if (strict) {
        const meta = resourceMeta!.get(line.resourceId);
        const name = meta?.name ?? 'Material';
        const unit = meta?.unit ?? '';
        if (!balance || onHand === 0) {
          throw ApiError.unprocessable(
            `${name}: no site stock for this project - receive via GRN first`,
          );
        }
        throw ApiError.unprocessable(
          `${name}: only ${onHand} ${unit} on hand, requested ${line.quantityUsed} ${unit}`,
        );
      }
      continue;
    }
    await tx.stockBalance.update({
      where: { id: balance.id },
      data: { quantity: { decrement: line.quantityUsed } },
    });
    await tx.stockMovement.create({
      data: {
        locationId: location.id,
        resourceId: line.resourceId,
        quantity: line.quantityUsed,
        type: 'OUT',
        referenceType: 'DAILY_REPORT',
        referenceId: dailyReportId,
      },
    });
  }
}

export interface IssueStockLineResult {
  movementId: string;
  resourceId: string;
  resourceName: string;
  unit: string;
  quantityIssued: number;
  quantityOnHand: number;
  unitPrice: number | null;
  // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.3): FEFO lot allocations made by
  // the server for batch-tracked items (null for untracked). UI warns only -
  // it never chooses lot quantities.
  allocations: Array<{ batchCode: string; quantity: number; expiresAt: Date | null }> | null;
}

export interface IssueStockResult extends IssueStockLineResult {
  /** All OUT movement ids (one per issued material). */
  movementIds: string[];
  /** One result per issued material line. */
  lines: IssueStockLineResult[];
  notes: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  draftInvoiceId: string | null;
}

/**
 * Manual stock issue (OUT) - inventory store operations, sales fulfilment, etc.
 * INVENTORY_UX_POLISH (D9): processes ALL lines in one DB transaction; fails
 * (rolling back the whole request) if any line exceeds on-hand stock.
 * Requires on-hand balance; throws if insufficient stock.
 */
export async function issueStockManual(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
  input: IssueStockInput,
): Promise<IssueStockResult> {
  await assertProjectAccess(companyId, userId, role as never, projectId);

  // Normalize legacy single-resource body to the multi-line shape.
  const rawLines: Array<{ resourceId: string; quantity: number; unitPrice?: number; batchCode?: string }> =
    input.lines && input.lines.length > 0
      ? input.lines
      : [
          {
            resourceId: input.resourceId!,
            quantity: input.quantity!,
            unitPrice: input.unitPrice,
            batchCode: (input as { batchCode?: string }).batchCode,
          },
        ];

  // Defensive server-side duplicate block (UI also blocks duplicates).
  const seen = new Set<string>();
  for (const l of rawLines) {
    if (seen.has(l.resourceId)) {
      throw ApiError.badRequest('Each material can be issued only once per request.');
    }
    seen.add(l.resourceId);
  }

  const resources = await prisma.resource.findMany({
    where: { id: { in: rawLines.map((l) => l.resourceId) }, companyId },
    select: { id: true, name: true, unit: true, avgCost: true, reorderPoint: true, trackingMode: true },
  });
  const resourceById = new Map(resources.map((r) => [r.id, r]));
  for (const l of rawLines) {
    if (!resourceById.has(l.resourceId)) throw ApiError.notFound('Resource not found');
  }

  const lineResults = await prisma.$transaction(async (tx) => {
    const location = await getOrCreateProjectStockLocation(companyId, projectId, tx, {
      locationId: input.locationId,
    });
    const results: IssueStockLineResult[] = [];
    for (const l of rawLines) {
      const resource = resourceById.get(l.resourceId)!;
      const balance = await tx.stockBalance.findUnique({
        where: {
          locationId_resourceId: { locationId: location.id, resourceId: l.resourceId },
        },
      });
      const onHand = balance ? Number(balance.quantity) : 0;
      if (!balance || onHand < l.quantity) {
        if (!balance || onHand === 0) {
          throw ApiError.unprocessable(
            `${resource.name}: no stock on hand - receive via GRN first`,
          );
        }
        throw ApiError.unprocessable(
          `${resource.name}: only ${onHand} ${resource.unit} on hand, requested ${l.quantity} ${resource.unit}`,
        );
      }

      await tx.stockBalance.update({
        where: { id: balance.id },
        data: { quantity: { decrement: l.quantity } },
      });

      // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.2): batch-tracked items are
      // FEFO-allocated (earliest expiry first). Each allocated lot becomes its
      // own OUT movement so the audit trail records the actual lot(s) sold;
      // the draft sales invoice still uses ONE line per resource (first lot).
      const tracked = isBatchTracked(resource.trackingMode);
      if (tracked) {
        const allocations = await allocateBatchOut(tx, {
          locationId: location.id,
          resourceId: l.resourceId,
          resourceName: resource.name,
          unit: resource.unit,
          quantity: l.quantity,
          allowExpired: input.allowExpired,
        });
        const firstMovement = await tx.stockMovement.create({
          data: {
            locationId: location.id,
            resourceId: l.resourceId,
            quantity: allocations[0].quantity,
            type: 'OUT',
            referenceType: 'MANUAL_ISSUE',
            referenceId: null,
            unitCost: Number(resource.avgCost ?? 0),
            inventoryValue: round2(Number(resource.avgCost ?? 0) * allocations[0].quantity),
            batchCode: allocations[0].batchCode,
          },
        });
        for (let i = 1; i < allocations.length; i++) {
          await tx.stockMovement.create({
            data: {
              locationId: location.id,
              resourceId: l.resourceId,
              quantity: allocations[i].quantity,
              type: 'OUT',
              referenceType: 'MANUAL_ISSUE',
              referenceId: null,
              unitCost: Number(resource.avgCost ?? 0),
              inventoryValue: round2(Number(resource.avgCost ?? 0) * allocations[i].quantity),
              batchCode: allocations[i].batchCode,
            },
          });
        }
        results.push({
          movementId: firstMovement.id,
          resourceId: resource.id,
          resourceName: resource.name,
          unit: resource.unit,
          quantityIssued: l.quantity,
          quantityOnHand: round3(onHand - l.quantity),
          unitPrice: l.unitPrice ?? null,
          // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.3): server-side FEFO lots.
          allocations: allocations.map((a) => ({
            batchCode: a.batchCode,
            quantity: a.quantity,
            expiresAt: a.expiresAt,
          })),
        });
        continue;
      }

      const movement = await tx.stockMovement.create({
        data: {
          locationId: location.id,
          resourceId: l.resourceId,
          quantity: l.quantity,
          type: 'OUT',
          referenceType: 'MANUAL_ISSUE',
          referenceId: null,
          // INVENTORY_HORIZONTAL_PLATFORM (Phase 5.2): cost at WAC.
          unitCost: Number(resource.avgCost ?? 0),
          inventoryValue: round2(Number(resource.avgCost ?? 0) * l.quantity),
          // INVENTORY_HORIZONTAL_PLATFORM (Phase 8.3): optional batch / lot code.
          batchCode: l.batchCode,
        },
      });

      results.push({
        movementId: movement.id,
        resourceId: resource.id,
        resourceName: resource.name,
        unit: resource.unit,
        quantityIssued: l.quantity,
        quantityOnHand: round3(onHand - l.quantity),
        unitPrice: l.unitPrice ?? null,
        allocations: null,
      });
    }
    return results;
  });

  const first = lineResults[0];

  // Inventory only: draft sales invoice - non-fatal after stock is committed.
  // D9: one draft invoice with one line item per issued material.
  let draftInvoiceId: string | null = null;
  try {
    const draft = await createDraftInvoiceFromStockIssue({
      companyId,
      projectId,
      customerId: input.customerId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerAddress: input.customerAddress,
      notes: input.notes,
      lines: lineResults.map((r) => ({
        stockMovementId: r.movementId,
        resourceId: r.resourceId,
        quantity: r.quantityIssued,
        unitPrice: r.unitPrice,
      })),
    });
    draftInvoiceId = draft?.id ?? null;
  } catch (err) {
    logger.warn('Auto draft invoice from stock issue failed (non-fatal)', {
      error: String(err),
      movementId: first.movementId,
    });
  }

  // INVENTORY_HORIZONTAL_PLATFORM (Phase 8.5): low-stock alert when an issue
  // pushes an item below its reorder point (inventory only, non-fatal).
  void notifyLowStock(
    companyId,
    lineResults.map((r) => {
      const res = resourceById.get(r.resourceId);
      return {
        resourceId: r.resourceId,
        name: r.resourceName,
        unit: res?.unit ?? null,
        onHand: r.quantityOnHand,
        reorderPoint: Number(res?.reorderPoint ?? 0),
      };
    }),
  ).catch((err) => logger.warn('Low-stock notify failed (non-fatal)', { error: String(err) }));

  return {
    ...first,
    movementIds: lineResults.map((r) => r.movementId),
    lines: lineResults,
    notes: input.notes?.trim() || null,
    customerName: input.customerName?.trim() || null,
    customerPhone: input.customerPhone?.trim() || null,
    customerAddress: input.customerAddress?.trim() || null,
    draftInvoiceId,
  };
}

export async function adjustStock(
  companyId: string,
  userId: string,
  role: string,
  input: AdjustStockInput,
) {
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 1.3): gated to INVENTORY plan by the
  // `stock_adjustments` feature flag at the route layer. Uses the single default
  // STORE project (inventory has no project picker).
  const projectId = await getDefaultProjectId(companyId);
  if (!projectId) throw ApiError.forbidden('Stock adjustments are not available on this plan.');
  await assertProjectAccess(companyId, userId, role as never, projectId);

  const resource = await prisma.resource.findFirst({
    where: { id: input.resourceId, companyId },
    select: { id: true, name: true, unit: true, avgCost: true, trackingMode: true },
  });
  if (!resource) throw ApiError.notFound('Resource not found');

  return prisma.$transaction(async (tx) => {
    const location = await getOrCreateProjectStockLocation(companyId, projectId, tx, {
      locationId: input.locationId,
    });
    const balance = await tx.stockBalance.findUnique({
      where: {
        locationId_resourceId: { locationId: location.id, resourceId: input.resourceId },
      },
    });
    const onHand = balance ? Number(balance.quantity) : 0;
    const newOnHand = round3(onHand + input.delta);
    if (newOnHand < 0) {
      throw ApiError.unprocessable(
        `${resource.name}: adjustment would leave ${newOnHand} ${resource.unit} on hand ` +
          `(currently ${onHand} ${resource.unit}, delta ${input.delta}).`,
      );
    }

    // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.2): keep lot rows consistent
    // with the aggregate - increases applyBatchIn (provided or generated lot),
    // decreases FEFO-allocate with one ADJUST movement per lot.
    const tracked = isBatchTracked(resource.trackingMode);
    const allocations: Array<{ batchCode: string; quantity: number; expiresAt: Date | null }> = [];
    if (tracked) {
      if (input.delta > 0) {
        const batchCode = input.batchCode ?? `ADJ-${Date.now()}`;
        await applyBatchIn(tx, {
          locationId: location.id,
          resourceId: input.resourceId,
          batchCode,
          quantity: input.delta,
          manufacturedAt: input.manufacturedAt ?? null,
          expiresAt: input.expiresAt ?? null,
        });
        allocations.push({ batchCode, quantity: input.delta, expiresAt: input.expiresAt ?? null });
      } else if (input.delta < 0) {
        allocations.push(
          ...(await allocateBatchOut(tx, {
            locationId: location.id,
            resourceId: input.resourceId,
            resourceName: resource.name,
            unit: resource.unit,
            quantity: Math.abs(input.delta),
          })),
        );
      }
    }

    const movement = await tx.stockMovement.create({
      data: {
        locationId: location.id,
        resourceId: input.resourceId,
        quantity: Math.abs(input.delta),
        type: 'ADJUST',
        referenceType: 'STOCK_ADJUSTMENT',
        referenceId: null,
        reason: input.reason,
        notes: input.notes?.trim() || null,
        // INVENTORY_HORIZONTAL_PLATFORM (Phase 5.2): carry current WAC metadata.
        unitCost: Number(resource.avgCost ?? 0),
        inventoryValue: round2(Number(resource.avgCost ?? 0) * Math.abs(input.delta)),
        // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.2): first allocated lot.
        batchCode: tracked ? (allocations[0]?.batchCode ?? null) : null,
      },
    });

    if (!balance) {
      await tx.stockBalance.create({
        data: {
          locationId: location.id,
          resourceId: input.resourceId,
          quantity: newOnHand,
        },
      });
    } else {
      await tx.stockBalance.update({
        where: { id: balance.id },
        data: { quantity: newOnHand },
      });
    }

    return {
      movementId: movement.id,
      resourceId: resource.id,
      resourceName: resource.name,
      unit: resource.unit,
      delta: input.delta,
      previousOnHand: onHand,
      quantityOnHand: newOnHand,
      reason: input.reason,
      notes: input.notes?.trim() || null,
    };
  });
}

/** Receive a small vendor purchase without creating a formal PO/GRN. */
export async function quickVendorReceipt(
  companyId: string,
  userId: string,
  role: string,
  input: QuickVendorReceiptInput,
) {
  const projectId = await getDefaultProjectId(companyId);
  if (!projectId) throw ApiError.forbidden('Vendor receipt is not available on this plan.');
  await assertProjectAccess(companyId, userId, role as never, projectId);

  let vendorName = input.vendorName?.trim() || null;
  if (input.vendorId) {
    const vendor = await prisma.vendor.findFirst({
      where: { id: input.vendorId, companyId, isActive: true },
      select: { name: true },
    });
    if (!vendor) throw ApiError.notFound('Vendor not found');
    vendorName = vendor.name;
  }
  if (!vendorName) throw ApiError.badRequest('Vendor is required');

  const resources = await prisma.resource.findMany({
    where: {
      companyId,
      isDeleted: false,
      id: { in: input.lines.map((line) => line.resourceId) },
    },
    select: { id: true, name: true, unit: true, trackingMode: true },
  });
  const resourceById = new Map(resources.map((resource) => [resource.id, resource]));
  if (resourceById.size !== new Set(input.lines.map((line) => line.resourceId)).size) {
    throw ApiError.notFound('One or more items were not found in your item master.');
  }

  return prisma.$transaction(async (tx) => {
    const location = await getOrCreateProjectStockLocation(companyId, projectId, tx, {
      locationId: input.locationId,
    });
    const received: Array<{
      movementId: string;
      resourceId: string;
      resourceName: string;
      quantity: number;
      unit: string;
      unitCost: number;
      quantityOnHand: number;
      batchCode: string | null;
    }> = [];
    for (const [index, line] of input.lines.entries()) {
      const resource = resourceById.get(line.resourceId)!;
      const balance = await tx.stockBalance.findUnique({
        where: {
          locationId_resourceId: { locationId: location.id, resourceId: resource.id },
        },
      });
      const onHand = Number(balance?.quantity ?? 0);
      const quantityOnHand = round4(onHand + line.quantity);
      const newWac = await updateWacOnIn(tx, resource.id, onHand, line.quantity, line.unitCost);
      // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.7): the received unit cost
      // is the vendor-cost source of truth. Update costPrice (WAC already
      // updated above); skip a zero/blank rate so it cannot wipe a known cost.
      // Construction ignores costPrice entirely.
      if (line.unitCost > 0) {
        await tx.resource.update({
          where: { id: resource.id },
          data: { costPrice: line.unitCost },
        });
      }
      const batchCode = isBatchTracked(resource.trackingMode)
        ? line.batchCode?.trim() || `QVR-${Date.now()}-${index + 1}`
        : null;
      if (batchCode) {
        await applyBatchIn(tx, {
          locationId: location.id,
          resourceId: resource.id,
          batchCode,
          quantity: line.quantity,
          manufacturedAt: line.manufacturedAt ?? null,
          expiresAt: line.expiresAt ?? null,
        });
      }
      await tx.stockBalance.upsert({
        where: {
          locationId_resourceId: { locationId: location.id, resourceId: resource.id },
        },
        create: { locationId: location.id, resourceId: resource.id, quantity: line.quantity },
        update: { quantity: { increment: line.quantity } },
      });
      const movement = await tx.stockMovement.create({
        data: {
          locationId: location.id,
          resourceId: resource.id,
          quantity: line.quantity,
          type: 'IN',
          referenceType: 'QUICK_VENDOR_RECEIPT',
          referenceId: input.vendorId ?? null,
          reason: 'VENDOR_PURCHASE',
          notes: [
            `Vendor: ${vendorName}`,
            input.invoiceNumber ? `Invoice: ${input.invoiceNumber}` : null,
            `Received: ${input.receivedDate.toISOString().slice(0, 10)}`,
            input.notes || null,
          ].filter(Boolean).join(' · '),
          unitCost: line.unitCost,
          inventoryValue: round2(line.quantity * line.unitCost),
          batchCode,
        },
      });
      received.push({
        movementId: movement.id,
        resourceId: resource.id,
        resourceName: resource.name,
        quantity: line.quantity,
        unit: resource.unit,
        unitCost: line.unitCost,
        quantityOnHand,
        batchCode,
      });
      // Keep the returned WAC calculation intentional even when no caller
      // currently displays it; it is persisted on Resource by updateWacOnIn.
      void newWac;
    }
    return { locationId: location.id, vendorName, invoiceNumber: input.invoiceNumber ?? null, received };
  }, { maxWait: 10_000, timeout: 60_000 });
}

export async function importOpeningStock(
  companyId: string,
  userId: string,
  role: string,
  input: OpeningStockImportInput,
) {
  // Phase 1.4 - opening stock import. Also gated to INVENTORY (STORE project).
  const projectId = await getDefaultProjectId(companyId);
  if (!projectId) throw ApiError.forbidden('Opening stock import is not available on this plan.');
  await assertProjectAccess(companyId, userId, role as never, projectId);

  // Resolve each line to a company resource by id / sku / itemCode / name.
  const resolved: Array<{
    resourceId: string;
    quantity: number;
    rate?: number;
    key: string;
    trackingMode: string;
    batchCode?: string;
    manufacturedAt?: Date | null;
    expiresAt?: Date | null;
  }> = [];
  const missed: Array<{ key: string; reason: string }> = [];
  for (const [i, line] of input.lines.entries()) {
    const key = `line ${i + 1} (${line.sku ?? line.itemCode ?? line.name ?? line.resourceId ?? '?'})`;
    const resource = await prisma.resource.findFirst({
      where: {
        companyId,
        isDeleted: false,
        ...(line.resourceId
          ? { id: line.resourceId }
          : line.sku
            ? { sku: line.sku }
            : line.itemCode
              ? { itemCode: line.itemCode }
              : { name: line.name! }),
      },
      select: { id: true, name: true, unit: true, trackingMode: true },
    });
    if (!resource) {
      missed.push({ key, reason: 'item not found in catalog' });
      continue;
    }
    resolved.push({
      resourceId: resource.id,
      quantity: line.quantity,
      rate: line.rate,
      key,
      trackingMode: resource.trackingMode,
      batchCode: line.batchCode,
      manufacturedAt: line.manufacturedAt ?? null,
      expiresAt: line.expiresAt ?? null,
    });
  }
  if (missed.length > 0 && resolved.length === 0) {
    throw ApiError.unprocessable(
      `Opening stock import failed - no items matched. ${missed.map((m) => m.key).join('; ')}`,
    );
  }

  const applied: Array<{ resourceId: string; resourceName: string; unit: string; delta: number; quantityOnHand: number }> = [];

  await prisma.$transaction(async (tx) => {
    const location = await getOrCreateProjectStockLocation(companyId, projectId, tx, {
      locationId: input.locationId,
    });
    for (const item of resolved) {
      if (item.rate !== undefined) {
        await tx.resource.update({
          where: { id: item.resourceId },
          data: { rate: item.rate },
        });
      }
      const balance = await tx.stockBalance.findUnique({
        where: {
          locationId_resourceId: { locationId: location.id, resourceId: item.resourceId },
        },
      });
      const onHand = balance ? Number(balance.quantity) : 0;
      const delta = round3(item.quantity - onHand);
      const resource = await tx.resource.findUniqueOrThrow({
        where: { id: item.resourceId },
        select: { name: true, unit: true, avgCost: true },
      });
      // INVENTORY_HORIZONTAL_PLATFORM (Phase 5.1/5.2): opening stock cost = the
      // per-line rate when supplied, else the current average cost.
      const unitCost = item.rate !== undefined ? item.rate : Number(resource.avgCost ?? 0);
      if (Math.abs(delta) > 0.0001) {
        // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.2): keep lot rows in sync
        // with the aggregate - increases applyBatchIn (provided or generated
        // OPEN-<ts> lot), decreases FEFO-allocate the existing lots.
        const tracked = isBatchTracked(item.trackingMode);
        let firstBatch: string | null = null;
        if (tracked) {
          if (delta > 0) {
            const batchCode = item.batchCode ?? `OPEN-${Date.now()}-${resolved.indexOf(item) + 1}`;
            await applyBatchIn(tx, {
              locationId: location.id,
              resourceId: item.resourceId,
              batchCode,
              quantity: delta,
              manufacturedAt: item.manufacturedAt ?? null,
              expiresAt: item.expiresAt ?? null,
            });
            firstBatch = batchCode;
          } else {
            const allocations = await allocateBatchOut(tx, {
              locationId: location.id,
              resourceId: item.resourceId,
              resourceName: resource.name,
              unit: resource.unit,
              quantity: Math.abs(delta),
            });
            firstBatch = allocations[0]?.batchCode ?? null;
          }
        }
        await tx.stockMovement.create({
          data: {
            locationId: location.id,
            resourceId: item.resourceId,
            quantity: Math.abs(delta),
            type: 'ADJUST',
            referenceType: 'OPENING_STOCK',
            referenceId: null,
            reason: StockAdjustReason.OPENING_STOCK,
            notes: `Opening stock import · ${item.key}`,
            unitCost,
            inventoryValue: round2(unitCost * Math.abs(delta)),
            // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.2): allocated lot.
            batchCode: firstBatch,
          },
        });
        if (!balance) {
          await tx.stockBalance.create({
            data: {
              locationId: location.id,
              resourceId: item.resourceId,
              quantity: item.quantity,
            },
          });
        } else {
          await tx.stockBalance.update({
            where: { id: balance.id },
            data: { quantity: item.quantity },
          });
        }
        // Only positive opening stock moves the WAC (adds cost); reductions
        // (delta < 0) leave the running average unchanged.
        if (delta > 0) {
          await updateWacOnIn(tx, item.resourceId, onHand, delta, unitCost);
        }
      }
      applied.push({
        resourceId: item.resourceId,
        resourceName: resource.name,
        unit: resource.unit,
        delta,
        quantityOnHand: round3(item.quantity),
      });
    }
  });

  return {
    applied: applied.length,
    missed: missed.length,
    lines: applied,
    unmatched: missed,
  };
}

export async function getResourceUtilization(companyId: string, projectId: string) {
  await getProject(companyId, projectId);

  const [taskResources, materialUsages] = await Promise.all([
    prisma.taskResource.findMany({
      where: { task: { projectId } },
      include: { resource: { select: { id: true, name: true, unit: true, type: true } } },
    }),
    prisma.materialUsage.findMany({
      where: { dailyReport: { projectId } },
      include: { resource: { select: { id: true, name: true, unit: true, type: true } } },
    }),
  ]);

  const map = new Map<
    string,
    { resourceId: string; name: string; unit: string; type: string; planned: number; used: number }
  >();

  for (const tr of taskResources) {
    const key = tr.resourceId;
    const e = map.get(key) ?? {
      resourceId: tr.resourceId,
      name: tr.resource.name,
      unit: tr.resource.unit ?? '',
      type: tr.resource.type,
      planned: 0,
      used: 0,
    };
    e.planned += Number(tr.quantity);
    map.set(key, e);
  }

  for (const mu of materialUsages) {
    const key = mu.resourceId;
    const e = map.get(key) ?? {
      resourceId: mu.resourceId,
      name: mu.resource.name,
      unit: mu.resource.unit ?? '',
      type: mu.resource.type,
      planned: 0,
      used: 0,
    };
    e.used += Number(mu.quantityUsed);
    map.set(key, e);
  }

  return Array.from(map.values()).map((r) => ({
    ...r,
    variance: r.used - r.planned,
    usedPct: r.planned > 0 ? Math.round((r.used / r.planned) * 100) : r.used > 0 ? 100 : 0,
  }));
}

export async function listStock(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
  opts: { locationId?: string } = {},
) {
  await assertProjectAccess(companyId, userId, role as never, projectId);

  const locations = await prisma.stockLocation.findMany({
    where: { companyId, projectId, ...(opts.locationId ? { id: opts.locationId } : {}) },
    include: {
      balances: {
        include: { resource: { select: { id: true, name: true, unit: true } } },
      },
    },
  });

  return locations;
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

export interface StockSummaryRow {
  resourceId: string;
  name: string;
  unit: string;
  /** Catalog / list rate - suggested selling price for Issue. */
  catalogRate: number;
  /** Printed maximum retail price (Kirana); null when not applicable. */
  mrp: number | null;
  /** INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.7): vendor unit cost; null when
   *  not captured yet. Used for read-only cost hints + cost/sell list columns. */
  costPrice: number | null;
  /** Item master search keys (INVENTORY_UX_POLISH M4): SKU / item code / barcode. */
  sku: string | null;
  itemCode: string | null;
  barcode: string | null;
  /** Low-stock threshold (Phase 1.5): balance below this = needs reorder. */
  reorderPoint: number;
  received: number;
  issued: number;
  balance: number;
  /** INVENTORY_HORIZONTAL_PLATFORM (Phase 5.2): WAC unit cost + inventory value. */
  unitCost: number;
  inventoryValue: number;
  // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.3): POS cart needs GST + tracking.
  /** Catalog GST % for the checkout cart line-tax display. */
  gstRate: number;
  /** NONE | BATCH_EXPIRY - cart shows FEFO / near-expiry hints for tracked items. */
  trackingMode: string;
  /** Earliest dated positive lot; null when no batch has an expiry date. */
  nextExpiryAt: Date | null;
  /** Positive-quantity lots currently held across the selected locations. */
  activeBatchCount: number;
}

export async function getStockSummary(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
  opts: { locationId?: string } = {},
): Promise<StockSummaryRow[]> {
  await assertProjectAccess(companyId, userId, role as never, projectId);

  const locations = await prisma.stockLocation.findMany({
    where: { companyId, projectId, ...(opts.locationId ? { id: opts.locationId } : {}) },
    select: { id: true },
  });
  const locationIds = locations.map((l) => l.id);
  if (locationIds.length === 0) return [];

  const [movements, balances, batches] = await Promise.all([
    prisma.stockMovement.findMany({
      where: { locationId: { in: locationIds } },
      include: {
        resource: {
          select: {
            id: true,
            name: true,
            unit: true,
            rate: true,
            mrp: true,
            costPrice: true,
            sku: true,
            itemCode: true,
            barcode: true,
            reorderPoint: true,
            avgCost: true,
            gstRate: true,
            trackingMode: true,
          },
        },
      },
    }),
    prisma.stockBalance.findMany({
      where: { locationId: { in: locationIds } },
      include: {
        resource: {
          select: {
            id: true,
            name: true,
            unit: true,
            rate: true,
            mrp: true,
            costPrice: true,
            sku: true,
            itemCode: true,
            barcode: true,
            reorderPoint: true,
            avgCost: true,
            gstRate: true,
            trackingMode: true,
          },
        },
      },
    }),
    prisma.stockBatchBalance.findMany({
      where: { locationId: { in: locationIds }, quantity: { gt: 0 } },
      select: { resourceId: true, expiresAt: true },
    }),
  ]);

  const map = new Map<string, StockSummaryRow>();

  const ensure = (
    resourceId: string,
    name: string,
    unit: string,
    catalogRate: number,
    mrp: number | null,
    costPrice: number | null,
    sku: string | null,
    itemCode: string | null,
    barcode: string | null,
    reorderPoint: number,
    avgCost: number,
    gstRate: number,
    trackingMode: string,
  ) => {
    let row = map.get(resourceId);
    if (!row) {
      row = {
        resourceId,
        name,
        unit,
        catalogRate,
        mrp,
        costPrice,
        sku,
        itemCode,
        barcode,
        reorderPoint,
        received: 0,
        issued: 0,
        balance: 0,
        unitCost: avgCost,
        inventoryValue: 0,
        gstRate,
        trackingMode,
        nextExpiryAt: null,
        activeBatchCount: 0,
      };
      map.set(resourceId, row);
    }
    return row;
  };

  for (const m of movements) {
    const rate = Number(m.resource.rate) || 0;
    const reorder = Number(m.resource.reorderPoint) || 0;
    const gst = Number(m.resource.gstRate) || 0;
    const row = ensure(
      m.resourceId,
      m.resource.name,
      m.resource.unit,
      rate,
      m.resource.mrp == null ? null : Number(m.resource.mrp),
      m.resource.costPrice == null ? null : Number(m.resource.costPrice),
      m.resource.sku ?? null,
      m.resource.itemCode ?? null,
      m.resource.barcode ?? null,
      reorder,
      Number(m.resource.avgCost) || 0,
      gst,
      m.resource.trackingMode,
    );
    const qty = Number(m.quantity);
    if (m.type === 'IN') row.received += qty;
    else if (m.type === 'OUT') row.issued += qty;
  }

  for (const b of balances) {
    const rate = Number(b.resource.rate) || 0;
    const reorder = Number(b.resource.reorderPoint) || 0;
    const avgCost = Number(b.resource.avgCost) || 0;
    const gst = Number(b.resource.gstRate) || 0;
    const row = ensure(
      b.resourceId,
      b.resource.name,
      b.resource.unit,
      rate,
      b.resource.mrp == null ? null : Number(b.resource.mrp),
      b.resource.costPrice == null ? null : Number(b.resource.costPrice),
      b.resource.sku ?? null,
      b.resource.itemCode ?? null,
      b.resource.barcode ?? null,
      reorder,
      avgCost,
      gst,
      b.resource.trackingMode,
    );
    row.balance += Number(b.quantity);
    row.unitCost = avgCost;
  }

  for (const batch of batches) {
    const row = map.get(batch.resourceId);
    if (!row) continue;
    row.activeBatchCount += 1;
    if (
      batch.expiresAt &&
      (!row.nextExpiryAt || batch.expiresAt.getTime() < row.nextExpiryAt.getTime())
    ) {
      row.nextExpiryAt = batch.expiresAt;
    }
  }

  return Array.from(map.values())
    .filter((r) => r.received > 0 || r.issued > 0 || r.balance > 0)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((r) => ({
      ...r,
      received: round3(r.received),
      issued: round3(r.issued),
      balance: round3(r.balance),
      unitCost: round4(r.unitCost),
      inventoryValue: round2(r.unitCost * r.balance),
    }));
}

export interface StockMovementRow {
  id: string;
  type: string;
  quantity: number;
  unit: string;
  createdAt: string;
  referenceType: string | null;
  referenceId: string | null;
  referenceLabel: string | null;
  locationName: string;
  /** INVENTORY_HORIZONTAL_PLATFORM (Phase 1.3): adjustment audit. */
  reason: string | null;
  notes: string | null;
}

export async function listStockMovements(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
  opts: { resourceId?: string; locationId?: string; limit?: number } = {},
): Promise<StockMovementRow[]> {
  await assertProjectAccess(companyId, userId, role as never, projectId);

  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);

  const locations = await prisma.stockLocation.findMany({
    where: { companyId, projectId, ...(opts.locationId ? { id: opts.locationId } : {}) },
    select: { id: true, name: true },
  });
  const locationIds = locations.map((l) => l.id);
  const locationNameById = new Map(locations.map((l) => [l.id, l.name]));
  if (locationIds.length === 0) return [];

  const movements = await prisma.stockMovement.findMany({
    where: {
      locationId: { in: locationIds },
      ...(opts.resourceId ? { resourceId: opts.resourceId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { resource: { select: { unit: true } } },
  });

  // StockMovement.referenceId is a free-text string; GRN/report ids are UUIDs.
  // Passing a non-UUID (grn number, empty junk from older rows) makes Postgres
  // throw "Inconsistent column data" and the whole item history fails.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const grnIds = [
    ...new Set(
      movements
        .filter((m) => m.referenceType === 'GRN' && m.referenceId && UUID_RE.test(m.referenceId))
        .map((m) => m.referenceId!),
    ),
  ];
  const reportIds = [
    ...new Set(
      movements
        .filter((m) => m.referenceType === 'DAILY_REPORT' && m.referenceId && UUID_RE.test(m.referenceId))
        .map((m) => m.referenceId!),
    ),
  ];

  let grns: Array<{ id: string; grnNumber: string }> = [];
  let reports: Array<{ id: string; reportDate: Date }> = [];
  try {
    [grns, reports] = await Promise.all([
      grnIds.length
        ? prisma.goodsReceiptNote.findMany({
            where: { id: { in: grnIds } },
            select: { id: true, grnNumber: true },
          })
        : [],
      reportIds.length
        ? prisma.dailyReport.findMany({
            where: { id: { in: reportIds } },
            select: { id: true, reportDate: true },
          })
        : [],
    ]);
  } catch (err) {
    logger.warn('Stock movement reference lookup failed (labels will be generic)', {
      error: String(err),
      grnIds: grnIds.length,
      reportIds: reportIds.length,
    });
  }

  const grnLabelById = new Map(grns.map((g) => [g.id, g.grnNumber]));
  const reportLabelById = new Map(
    reports.map((r) => [r.id, r.reportDate.toISOString().slice(0, 10)]),
  );

  return movements.map((m) => {
    let referenceLabel: string | null = null;
    if (m.referenceType === 'GRN' && m.referenceId) {
      referenceLabel = grnLabelById.get(m.referenceId) ?? 'GRN';
    } else if (m.referenceType === 'DAILY_REPORT' && m.referenceId) {
      const date = reportLabelById.get(m.referenceId);
      referenceLabel = date ? `Daily report · ${date}` : 'Daily report';
    } else if (m.referenceType === 'MANUAL_ISSUE') {
      referenceLabel = 'Stock issue';
    } else if (m.referenceType === 'STOCK_ADJUSTMENT') {
      referenceLabel = m.reason ? `Adjustment · ${m.reason.replace(/_/g, ' ')}` : 'Stock adjustment';
    } else if (m.referenceType === 'OPENING_STOCK') {
      referenceLabel = 'Opening stock';
    } else if (m.referenceType === 'TRANSFER_OUT') {
      referenceLabel = 'Transfer out';
    } else if (m.referenceType === 'TRANSFER_IN') {
      referenceLabel = 'Transfer in';
    } else if (m.referenceType === 'DELIVERY_CHALLAN') {
      referenceLabel = 'Dispatch / challan';
    } else if (m.referenceType === 'SALES_RETURN') {
      referenceLabel = 'Sales return';
    } else if (m.referenceType === 'PURCHASE_RETURN') {
      referenceLabel = 'Purchase return';
    } else if (m.referenceType === 'STOCK_COUNT') {
      referenceLabel = 'Stock count';
    }

    return {
      id: m.id,
      type: m.type,
      quantity: Number(m.quantity),
      unit: m.resource.unit,
      createdAt: m.createdAt.toISOString(),
      referenceType: m.referenceType,
      referenceId: m.referenceId,
      referenceLabel,
      locationName: locationNameById.get(m.locationId) ?? '',
      reason: m.reason,
      notes: m.notes,
      // INVENTORY_HORIZONTAL_PLATFORM (Phase 8.3): batch / lot code on history.
      batchCode: m.batchCode,
    };
  });
}
