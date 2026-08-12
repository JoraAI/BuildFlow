/**
 * BuildFlow - Reorder automation service (INVENTORY_HORIZONTAL_PLATFORM Phase 4).
 *
 * 4.2 Reorder suggestions - items whose TOTAL on-hand (across all warehouses)
 *     is below reorderPoint, with preferred vendor + suggested qty.
 * 4.3 One-click purchase - creates an auto-approved indent (INVENTORY) and then
 *     a PO from it (reusing createRequisition / createPO; procurement is NOT
 *     forked). The PO goes through the 4.4 approval banding.
 *
 * Gated by `stock_adjustments` at the route layer (construction → 403).
 */
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { assertProjectAccess } from '../middleware/project-access.middleware';
import { getDefaultProjectId } from './module-gate.service';
import { createRequisition, createPO } from './procurement.service';

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

async function resolveDefaultProject(companyId: string, userId: string, role: string) {
  const projectId = await getDefaultProjectId(companyId);
  if (!projectId) throw ApiError.forbidden('Reorder automation is not available on this plan.');
  await assertProjectAccess(companyId, userId, role as never, projectId);
  return projectId;
}

export interface ReorderSuggestion {
  resourceId: string;
  name: string;
  unit: string;
  catalogRate: number;
  reorderPoint: number;
  /** Total on-hand across all company warehouses. */
  onHand: number;
  /** Quantity to order: reorderQty if set, else shortfall below reorderPoint. */
  suggestedQty: number;
  reorderQty: number | null;
  leadTimeDays: number | null;
  preferredVendor: { id: string; name: string; phone: string | null } | null;
}

async function computeOnHand(
  companyId: string,
  projectId: string,
): Promise<Map<string, number>> {
  const balances = await prisma.stockBalance.findMany({
    where: { location: { companyId, projectId } },
    select: { resourceId: true, quantity: true },
  });
  const map = new Map<string, number>();
  for (const b of balances) {
    map.set(b.resourceId, (map.get(b.resourceId) ?? 0) + Number(b.quantity));
  }
  return map;
}

export async function getReorderSuggestions(
  companyId: string,
  userId: string,
  role: string,
  resourceIds?: string[],
): Promise<ReorderSuggestion[]> {
  const projectId = await resolveDefaultProject(companyId, userId, role);

  const resources = await prisma.resource.findMany({
    where: {
      companyId,
      isDeleted: false,
      reorderPoint: { gt: 0 },
      ...(resourceIds && resourceIds.length > 0 ? { id: { in: resourceIds } } : {}),
    },
    select: {
      id: true,
      name: true,
      unit: true,
      rate: true,
      reorderPoint: true,
      reorderQty: true,
      leadTimeDays: true,
      preferredVendorId: true,
      preferredVendor: { select: { id: true, name: true, phone: true } },
    },
  });
  if (resources.length === 0) return [];

  const onHand = await computeOnHand(companyId, projectId);

  return resources
    .map((r) => {
      const hand = onHand.get(r.id) ?? 0;
      const reorderPoint = Number(r.reorderPoint);
      const reorderQty = r.reorderQty != null ? Number(r.reorderQty) : null;
      const shortfall = Math.max(0, reorderPoint - hand);
      return {
        resourceId: r.id,
        name: r.name,
        unit: r.unit,
        catalogRate: Number(r.rate),
        reorderPoint,
        onHand: round3(hand),
        suggestedQty: reorderQty ?? round3(shortfall),
        reorderQty,
        leadTimeDays: r.leadTimeDays,
        preferredVendor: r.preferredVendor,
      };
    })
    .filter((s) => s.onHand < s.reorderPoint)
    .sort((a, b) => a.onHand / a.reorderPoint - b.onHand / b.reorderPoint);
}

export async function createReorderPurchase(
  companyId: string,
  userId: string,
  role: string,
  resourceIds: string[],
) {
  const projectId = await resolveDefaultProject(companyId, userId, role);
  const suggestions = await getReorderSuggestions(companyId, userId, role, resourceIds);
  if (suggestions.length === 0) {
    throw ApiError.unprocessable('No low-stock items found to order - all selected items are above their reorder point.');
  }

  const lines = suggestions.map((s) => ({
    resourceId: s.resourceId,
    quantity: s.suggestedQty,
    unit: s.unit,
  }));

  // 1) Auto-approved indent (INVENTORY) with one line per low-stock item.
  const requisition = await createRequisition(companyId, userId, role, projectId, {
    notes: `Auto-generated from reorder suggestions (${suggestions.length} item(s))`,
    lines: lines.map((l) => ({
      resourceId: l.resourceId,
      quantity: l.quantity,
      unit: l.unit,
      expectedRate: suggestions.find((s) => s.resourceId === l.resourceId)?.catalogRate,
    })),
  });

  // 2) PO from the approved indent (preferred vendor + catalog rate). Goes
  //    through the 4.4 approval banding automatically inside createPO.
  const vendorName = suggestions[0]?.preferredVendor?.name ?? '-';
  const purchaseOrder = await createPO(companyId, userId, role, projectId, {
    requisitionId: requisition.id,
    vendorName,
    lines: lines.map((l) => ({
      resourceId: l.resourceId,
      quantity: l.quantity,
      unit: l.unit,
      rate: suggestions.find((s) => s.resourceId === l.resourceId)?.catalogRate ?? 0,
    })),
  });

  return {
    requisition,
    purchaseOrder,
    suggestionCount: suggestions.length,
  };
}
