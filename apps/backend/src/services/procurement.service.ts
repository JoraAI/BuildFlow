import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { nextSequentialNumber } from '../lib/id-generator';
import { assertProjectAccess } from '../middleware/project-access.middleware';
import { getProject } from './project.service';
import type {
  CreateRequisitionInput,
  CreatePurchaseOrderInput,
  CreateGrnInput,
} from '@buildflow/shared';
import { resolveRequisitionLineRate } from './material-rate.service';
import { alertOnPurchaseOrderRateVariance } from './material-rate-alert.service';
import { logger } from '../config/logger';
import {
  createDraftIndentsFromDemand,
  fetchBoqMaterialDemands,
  previewBoqShortfalls,
} from './material-demand.service';

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

async function getOrCreateProjectStockLocation(
  companyId: string,
  projectId: string,
  tx: Pick<typeof prisma, 'stockLocation'>,
) {
  const existing = await tx.stockLocation.findFirst({
    where: { companyId, projectId },
  });
  if (existing) return existing;
  return tx.stockLocation.create({
    data: { companyId, projectId, name: 'Site Store' },
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
      lines: { include: { resource: { select: { id: true, name: true } } } },
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

  return prisma.materialRequisition.create({
    data: {
      projectId,
      companyId,
      // Always auto-generate reqNumber — it must not be client-editable.
      // Format: IND-{YYYY}-{NNNN} (scoped per company + year).
      reqNumber: await nextSequentialNumber(companyId, 'indent'),
      notes: input.notes,
      requestedBy: userId,
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

  // FIX (EST-M6): Generate poNumber server-side if not provided.
  const poNumber = input.poNumber || await nextSequentialNumber(companyId, 'po');

  const po = await prisma.purchaseOrder.create({
    data: {
      projectId,
      companyId,
      requisitionId: input.requisitionId,
      poNumber,
      vendorName: input.vendorName,
      totalAmount,
      // FIX (PROCGRN-1): PO is created from an already-approved requisition,
      // so it starts as APPROVED — no separate PO approval step needed.
      // Without this, the GRN endpoint rejects with "Cannot create GRN
      // against a PO with status DRAFT" because the schema defaults to DRAFT.
      status: 'APPROVED',
      lines: { create: lines },
    },
    include: { lines: { include: { resource: { select: { id: true, name: true } } } } },
  });

  await alertOnPurchaseOrderRateVariance(
    companyId,
    projectId,
    po.id,
    po.poNumber,
    input.lines.map((l) => ({ resourceId: l.resourceId, rate: l.rate })),
  ).catch((err) =>
    logger.warn('PO rate alert failed (non-fatal)', { error: String(err) }),
  );

  return po;
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

  // FIX (EST-H3): Validate each GRN line against the PO — the resource must be
  // on the PO, and the cumulative received quantity must not exceed the PO
  // line quantity (prevent over-receiving).
  const poLineByResource = new Map(po.lines.map((l) => [l.resourceId, l]));

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

  return prisma.$transaction(async (tx) => {
    const grn = await tx.goodsReceiptNote.create({
      data: {
        projectId,
        companyId,
        purchaseOrderId: input.purchaseOrderId,
        grnNumber: input.grnNumber,
        receivedDate: input.receivedDate,
        notes: input.notes,
        lines: { create: input.lines },
      },
      include: { lines: true },
    });

    const location = await getOrCreateProjectStockLocation(companyId, projectId, tx);

    for (const line of input.lines) {
      const balance = await tx.stockBalance.findUnique({
        where: {
          locationId_resourceId: { locationId: location.id, resourceId: line.resourceId },
        },
      });

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
          referenceId: grn.id,
        },
      });
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
    // APPROVED — there is no CLOSED state in the requisition state machine yet
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
      // No status transition — see note above. A CLOSED enum can be added in a
      // future migration if business logic requires marking requisitions done.
      void allFulfilled;
    }

    return grn;
  });
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
) {
  await assertProjectAccess(companyId, userId, role as never, projectId);

  const locations = await prisma.stockLocation.findMany({
    where: { companyId, projectId },
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
  received: number;
  issued: number;
  balance: number;
}

export async function getStockSummary(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
): Promise<StockSummaryRow[]> {
  await assertProjectAccess(companyId, userId, role as never, projectId);

  const locations = await prisma.stockLocation.findMany({
    where: { companyId, projectId },
    select: { id: true },
  });
  const locationIds = locations.map((l) => l.id);
  if (locationIds.length === 0) return [];

  const [movements, balances] = await Promise.all([
    prisma.stockMovement.findMany({
      where: { locationId: { in: locationIds } },
      include: { resource: { select: { id: true, name: true, unit: true } } },
    }),
    prisma.stockBalance.findMany({
      where: { locationId: { in: locationIds } },
      include: { resource: { select: { id: true, name: true, unit: true } } },
    }),
  ]);

  const map = new Map<string, StockSummaryRow>();

  const ensure = (resourceId: string, name: string, unit: string) => {
    let row = map.get(resourceId);
    if (!row) {
      row = { resourceId, name, unit, received: 0, issued: 0, balance: 0 };
      map.set(resourceId, row);
    }
    return row;
  };

  for (const m of movements) {
    const row = ensure(m.resourceId, m.resource.name, m.resource.unit);
    const qty = Number(m.quantity);
    if (m.type === 'IN') row.received += qty;
    else if (m.type === 'OUT') row.issued += qty;
  }

  for (const b of balances) {
    const row = ensure(b.resourceId, b.resource.name, b.resource.unit);
    row.balance += Number(b.quantity);
  }

  return Array.from(map.values())
    .filter((r) => r.received > 0 || r.issued > 0 || r.balance > 0)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((r) => ({
      ...r,
      received: round3(r.received),
      issued: round3(r.issued),
      balance: round3(r.balance),
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
}

export async function listStockMovements(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
  opts: { resourceId?: string; limit?: number } = {},
): Promise<StockMovementRow[]> {
  await assertProjectAccess(companyId, userId, role as never, projectId);

  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);

  const locations = await prisma.stockLocation.findMany({
    where: { companyId, projectId },
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

  const grnIds = [
    ...new Set(
      movements
        .filter((m) => m.referenceType === 'GRN' && m.referenceId)
        .map((m) => m.referenceId!),
    ),
  ];
  const reportIds = [
    ...new Set(
      movements
        .filter((m) => m.referenceType === 'DAILY_REPORT' && m.referenceId)
        .map((m) => m.referenceId!),
    ),
  ];

  const [grns, reports] = await Promise.all([
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
    };
  });
}
