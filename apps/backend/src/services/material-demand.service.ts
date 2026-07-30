/**
 * Material demand engine - compute shortfalls and create DRAFT indents for PM review.
 */
import { CostType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { resolveRequisitionLineRate } from './material-rate.service';

export type DemandSourceType = 'ESTIMATE_CONVERT' | 'VARIATION' | 'BOQ_UPDATE' | 'MANUAL';

export interface MaterialDemandLine {
  resourceId: string;
  quantity: number;
  unit: string;
  boqItemId?: string;
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

async function getStockQty(companyId: string, projectId: string, resourceId: string): Promise<number> {
  const balances = await prisma.stockBalance.findMany({
    where: {
      resourceId,
      location: { companyId, projectId },
    },
  });
  return balances.reduce((s, b) => s + Number(b.quantity), 0);
}

async function getOpenRequisitionQty(
  companyId: string,
  projectId: string,
  resourceId: string,
): Promise<number> {
  // FIX (EST-M1): Exclude requisitions that are fully received (their POs have
  // GRNs covering the full requisition quantity). Previously all DRAFT/
  // SUBMITTED/APPROVED requisitions counted, even if fully fulfilled via GRN.
  const lines = await prisma.materialRequisitionLine.findMany({
    where: {
      resourceId,
      requisition: {
        companyId,
        projectId,
        status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
      },
    },
    include: {
      requisition: {
        select: {
          purchaseOrders: {
            select: {
              lines: {
                where: { resourceId },
                select: { quantity: true },
              },
              goodsReceipts: {
                select: {
                  lines: {
                    where: { resourceId },
                    select: { quantity: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  let total = 0;
  for (const line of lines) {
    const reqQty = Number(line.quantity);
    // Sum received qty across all POs linked to this requisition
    let receivedQty = 0;
    for (const po of line.requisition.purchaseOrders) {
      for (const grn of po.goodsReceipts) {
        for (const grnLine of grn.lines) {
          receivedQty += Number(grnLine.quantity);
        }
      }
    }
    // Only count the unfulfilled portion of this requisition line
    if (receivedQty < reqQty) {
      total += reqQty - receivedQty;
    }
    // If fully received (receivedQty >= reqQty), skip — this requisition is fulfilled
  }
  return round3(total);
}

async function nextAutoReqNumber(companyId: string): Promise<string> {
  const count = await prisma.materialRequisition.count({ where: { companyId } });
  const ts = Date.now().toString(36).toUpperCase();
  return `IND-AUTO-${ts}-${count + 1}`;
}

/** Explode one estimate/BOQ MATERIAL line into catalog resource demand lines. */
export async function materialDemandsForEstimateItem(
  item: {
    type: string;
    resourceId: string | null;
    rateAnalysisId: string | null;
    quantity: unknown;
    unit: string;
    description?: string;
  },
  boqItemId?: string,
  companyId?: string, // FIX (EST-H2): required for tenant-scoped safety-net match
): Promise<MaterialDemandLine[]> {
  if (item.type !== CostType.MATERIAL && item.type !== 'MATERIAL') return [];

  const scopeQty = Number(item.quantity);
  // FIX (EST-L6): reject NaN/non-finite quantities.
  if (!Number.isFinite(scopeQty) || scopeQty <= 0) return [];

  // 1. Direct catalog resource link
  if (item.resourceId) {
    return [
      {
        resourceId: item.resourceId,
        quantity: round3(scopeQty),
        unit: item.unit,
        boqItemId,
      },
    ];
  }

  // 2. Rate analysis BOM explosion
  if (item.rateAnalysisId) {
    const components = await prisma.rateAnalysisComponent.findMany({
      where: {
        rateAnalysisId: item.rateAnalysisId,
        type: CostType.MATERIAL,
        resourceId: { not: null },
      },
    });
    return components.map((c) => ({
      resourceId: c.resourceId!,
      quantity: round3(scopeQty * Number(c.quantityPerUnit)),
      unit: c.unit,
      boqItemId,
    }));
  }

  // 3. Safety-net: MATERIAL item with no procurement link.
  //    FIX (EST-H2): scope by companyId (was cross-tenant), keep the type
  //    MATERIAL filter, and correct the match direction: find a resource whose
  //    NAME is contained in the item description (not the inverse, which rarely
  //    matched because descriptions are long sentences).
  if (!item.resourceId && !item.rateAnalysisId && item.description && companyId) {
    // FIX (EST-H2): tenant-scoped + corrected match direction (description
    // contains resource name). Use `OR` with individual contains filters.
    const tokens = item.description.split(/\s+/).filter((t) => t.length >= 3);
    const match = await prisma.resource.findFirst({
      where: {
        companyId,
        type: CostType.MATERIAL,
        OR: tokens.map((t) => ({ name: { contains: t, mode: 'insensitive' as const } })),
      },
      select: { id: true, name: true },
    });
    if (match) {
      return [
        {
          resourceId: match.id,
          quantity: round3(scopeQty),
          unit: item.unit,
          boqItemId,
        },
      ];
    }
  }

  return [];
}

/**
 * Create DRAFT requisition(s) for material shortfall after comparing demand vs stock + open indents.
 */
export async function createDraftIndentsFromDemand(
  companyId: string,
  userId: string,
  projectId: string,
  lines: MaterialDemandLine[],
  sourceType: DemandSourceType,
  sourceRef: string,
): Promise<{ created: number; reqNumbers: string[] }> {
  if (lines.length === 0) return { created: 0, reqNumbers: [] };

  const grouped = new Map<
    string,
    { resourceId: string; quantity: number; unit: string; boqItemId?: string }
  >();

  for (const line of lines) {
    if (line.quantity <= 0) continue;
    const key = `${line.resourceId}:${line.boqItemId ?? ''}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.quantity = round3(existing.quantity + line.quantity);
    } else {
      grouped.set(key, {
        resourceId: line.resourceId,
        quantity: round3(line.quantity),
        unit: line.unit,
        boqItemId: line.boqItemId,
      });
    }
  }

  const reqNumbers: string[] = [];
  let created = 0;

  for (const demand of grouped.values()) {
    const stock = await getStockQty(companyId, projectId, demand.resourceId);
    const openReq = await getOpenRequisitionQty(companyId, projectId, demand.resourceId);
    const shortfall = round3(demand.quantity - stock - openReq);
    if (shortfall <= 0) continue;

    const reqNumber = await nextAutoReqNumber(companyId);
    const { expectedRate, rateSource } = await resolveRequisitionLineRate(companyId, projectId, {
      resourceId: demand.resourceId,
      boqItemId: demand.boqItemId,
    });
    await prisma.materialRequisition.create({
      data: {
        projectId,
        companyId,
        reqNumber,
        status: 'DRAFT',
        requestedBy: userId,
        sourceType,
        sourceRef,
        notes: `Auto-generated from ${sourceType.replace('_', ' ').toLowerCase()}: ${sourceRef}. Review before submit.`,
        lines: {
          create: [
            {
              resourceId: demand.resourceId,
              quantity: shortfall,
              unit: demand.unit,
              boqItemId: demand.boqItemId ?? null,
              expectedRate,
              rateSource,
            },
          ],
        },
      },
    });
    reqNumbers.push(reqNumber);
    created += 1;
  }

  return { created, reqNumbers };
}

export interface BoqMaterialDemand extends MaterialDemandLine {
  itemCode: string;
  description: string;
}

export interface BoqShortfallPreview extends BoqMaterialDemand {
  resourceName: string;
  stockQty: number;
  openRequisitionQty: number;
  shortfall: number;
}

/** Load remaining material demand from active BOQ MATERIAL lines (catalog or rate-analysis BOM). */
export async function fetchBoqMaterialDemands(
  projectId: string,
  companyId?: string,
): Promise<BoqMaterialDemand[]> {
  const items = await prisma.bOQItem.findMany({
    // Use startsWith so sub-estimate categories like "MATERIAL/Extra Scope"
    // are also included. Top-level estimates use the bare "MATERIAL" category.
    where: { projectId, isSuperseded: false, category: { startsWith: 'MATERIAL' } },
    include: {
      estimateItem: {
        select: { resourceId: true, rateAnalysisId: true, type: true },
      },
    },
  });

  const lines: BoqMaterialDemand[] = [];

  for (const item of items) {
    const remaining = round3(Math.max(0, Number(item.quantity) - Number(item.executedQty)));
    if (remaining <= 0) continue;

    const est = item.estimateItem;
    const demands = await materialDemandsForEstimateItem(
      {
        type: est?.type ?? 'MATERIAL',
        resourceId: est?.resourceId ?? null,
        rateAnalysisId: est?.rateAnalysisId ?? null,
        quantity: remaining,
        unit: item.unit,
        description: item.description,
      },
      item.id,
      companyId, // FIX (EST-H2): pass companyId for tenant-scoped match
    );

    for (const d of demands) {
      if (d.quantity <= 0) continue;
      lines.push({
        ...d,
        itemCode: item.itemCode,
        description: item.description,
      });
    }
  }

  return lines;
}

/** Build material demand lines from BOQ items (sync helper for tests). */
export function demandsFromBoqItems(
  items: Array<{
    id: string;
    itemCode: string;
    description: string;
    unit: string;
    quantity: unknown;
    executedQty: unknown;
    category: string | null;
    resourceId?: string | null;
  }>,
): MaterialDemandLine[] {
  return items
    .filter((i) => i.category === 'MATERIAL' && i.resourceId)
    .map((i) => ({
      resourceId: i.resourceId!,
      quantity: round3(Math.max(0, Number(i.quantity) - Number(i.executedQty ?? 0))),
      unit: i.unit,
      boqItemId: i.id,
    }))
    .filter((i) => i.quantity > 0);
}

export async function previewBoqShortfalls(
  companyId: string,
  projectId: string,
): Promise<BoqShortfallPreview[]> {
  const demands = await fetchBoqMaterialDemands(projectId, companyId);
  if (demands.length === 0) return [];

  // FIX (EST-H1): Compute stock and open-requisition quantities ONCE per
  // resource, then distribute across all demand lines referencing that
  // resource. Previously each demand line independently credited the full
  // stock, so a resource used by N BOQ lines was credited N× stock.
  const resourceIds = [...new Set(demands.map((d) => d.resourceId))];
  const resources = await prisma.resource.findMany({
    where: { id: { in: resourceIds }, companyId },
    select: { id: true, name: true },
  });
  const resourceNameById = new Map(resources.map((r) => [r.id, r.name]));

  // Aggregate total demand per resource
  const totalDemandByResource = new Map<string, number>();
  for (const d of demands) {
    totalDemandByResource.set(d.resourceId, round3((totalDemandByResource.get(d.resourceId) ?? 0) + d.quantity));
  }

  // Compute net shortfall per resource (stock credited only once)
  const shortfallByResource = new Map<string, number>();
  for (const resourceId of resourceIds) {
    const stockQty = await getStockQty(companyId, projectId, resourceId);
    const openRequisitionQty = await getOpenRequisitionQty(companyId, projectId, resourceId);
    const totalDemand = totalDemandByResource.get(resourceId) ?? 0;
    const resourceShortfall = round3(totalDemand - stockQty - openRequisitionQty);
    shortfallByResource.set(resourceId, resourceShortfall);
  }

  // Build preview rows — each demand line shows its proportional shortfall
  const previews: BoqShortfallPreview[] = [];
  for (const demand of demands) {
    const resourceShortfall = shortfallByResource.get(demand.resourceId) ?? 0;
    if (resourceShortfall <= 0) continue;
    const totalDemand = totalDemandByResource.get(demand.resourceId) ?? demand.quantity;
    // Pro-rate the shortfall across demand lines
    const proportion = totalDemand > 0 ? demand.quantity / totalDemand : 1;
    const lineShortfall = round3(resourceShortfall * proportion);
    if (lineShortfall <= 0) continue;
    previews.push({
      ...demand,
      resourceName: resourceNameById.get(demand.resourceId) ?? 'Material',
      stockQty: await getStockQty(companyId, projectId, demand.resourceId),
      openRequisitionQty: await getOpenRequisitionQty(companyId, projectId, demand.resourceId),
      shortfall: lineShortfall,
    });
  }

  return previews.filter((p) => p.shortfall > 0);
}

/** Build material demand lines from approved estimate items (MATERIAL + optional rate-analysis BOM). */
export async function buildMaterialDemandsFromEstimateItems(
  companyId: string,
  items: Array<{
    id: string;
    type: string;
    resourceId: string | null;
    rateAnalysisId: string | null;
    quantity: unknown;
    unit: string;
    description?: string;
  }>,
  boqByEstimateItemId: Map<string, string>,
): Promise<MaterialDemandLine[]> {
  const lines: MaterialDemandLine[] = [];
  for (const item of items) {
    const boqItemId = boqByEstimateItemId.get(item.id);
    const demands = await materialDemandsForEstimateItem(item, boqItemId, companyId);
    lines.push(...demands);
  }
  return lines;
}

/** @deprecated Use buildMaterialDemandsFromEstimateItems - sync path for direct resourceId only. */
export function demandsFromEstimateItems(
  items: Array<{
    type: string;
    resourceId: string | null;
    quantity: unknown;
    unit: string;
    estimateItemId?: string;
  }>,
  boqByEstimateItemId: Map<string, string>,
): MaterialDemandLine[] {
  return items
    .filter((i) => i.type === 'MATERIAL' && i.resourceId)
    .map((i) => ({
      resourceId: i.resourceId!,
      quantity: Number(i.quantity),
      unit: i.unit,
      boqItemId: i.estimateItemId ? boqByEstimateItemId.get(i.estimateItemId) : undefined,
    }));
}