/**
 * Material demand engine - compute shortfalls and create DRAFT indents for PM review.
 */
import { CostType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { resolveRequisitionLineRate } from './material-rate.service';
import { logger } from '../config/logger';

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

/**
 * FIX (EST-M15/NR-6): Resolve a demand line's unit against the resource's
 * canonical stock unit. NR-6 regression: previously this just relabeled the
 * unit without converting the quantity (5 MT became "5 kg"), corrupting stock.
 * Now we apply a small conversion factor for common Indian construction units,
 * or reject (return null) if the units are incompatible - the caller skips
 * the line rather than writing wrong quantities to StockBalance.
 */
const UNIT_CONVERSIONS: Record<string, number> = {
  // key = `${fromUnit.toLowerCase()}->${toUnit.toLowerCase()}`
  'kg->mt': 0.001,
  'kg->ton': 0.001,
  'kg->tonne': 0.001,
  'mt->kg': 1000,
  'ton->kg': 1000,
  'tonne->kg': 1000,
  'g->kg': 0.001,
  'kg->g': 1000,
  'l->kl': 0.001,
  'kl->l': 1000,
  'm->km': 0.001,
  'km->m': 1000,
  'sqm->sqft': 10.7639,
  'sqft->sqm': 0.092903,
  'cum->cft': 35.3147,
  'cft->cum': 0.0283168,
};

export async function resolveCanonicalUnitAndQty(
  companyId: string,
  resourceId: string,
  demandUnit: string,
  demandQty: number,
): Promise<{ unit: string; quantity: number } | null> {
  const resource = await prisma.resource.findFirst({
    where: { id: resourceId, companyId },
    select: { unit: true },
  });
  if (!resource?.unit) return { unit: demandUnit, quantity: demandQty };
  const resourceUnit = resource.unit;
  if (resourceUnit.toLowerCase() === demandUnit.toLowerCase()) {
    return { unit: resourceUnit, quantity: demandQty };
  }
  // Try a direct conversion factor.
  const key = `${demandUnit.toLowerCase()}->${resourceUnit.toLowerCase()}`;
  const factor = UNIT_CONVERSIONS[key];
  if (factor !== undefined) {
    return { unit: resourceUnit, quantity: round3(demandQty * factor) };
  }
  // NR-6: Cannot safely convert - reject rather than relabel.
  return null;
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
    // If fully received (receivedQty >= reqQty), skip - this requisition is fulfilled
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
  //    FIX (EST-H2/NR-7): scope by companyId (was cross-tenant), keep the type
  //    MATERIAL filter, correct the match direction, and require a STRONG match.
  //    NR-7 regression: the previous OR-over-every-≥3-char-word matched
  //    stopwords ("and", "for", "the") and auto-linked the wrong material.
  //    Now we drop stopwords, require a token that overlaps the resource name,
  //    and rank candidates by overlap score, requiring score >= 1.
  if (!item.resourceId && !item.rateAnalysisId && item.description && companyId) {
    const STOPWORDS = new Set([
      'the', 'and', 'for', 'with', 'from', 'into', 'per', 'each', 'incl',
      'work', 'item', 'material', 'construction', 'including', 'etc',
    ]);
    const descTokens = item.description
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 4 && !STOPWORDS.has(t));
    if (descTokens.length > 0) {
      const candidates = await prisma.resource.findMany({
        where: {
          companyId,
          type: CostType.MATERIAL,
          OR: descTokens.map((t) => ({ name: { contains: t, mode: 'insensitive' as const } })),
        },
        select: { id: true, name: true },
      });
      // Rank by token overlap with the resource name; require >= 1 overlap.
      let best: { id: string; score: number } | null = null;
      for (const c of candidates) {
        const nameTokens = new Set(
          c.name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean),
        );
        const score = descTokens.filter((t) => nameTokens.has(t)).length;
        if (score >= 1 && (!best || score > best.score)) {
          best = { id: c.id, score };
        }
      }
      if (best) {
        return [
          {
            resourceId: best.id,
            quantity: round3(scopeQty),
            unit: item.unit,
            boqItemId,
          },
        ];
      }
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

  // FIX (EST-L16): Group ALL shortfall lines into a SINGLE requisition
  // instead of creating one per line. This matches the expected UX: one
  // indent covering all shortfalls from a BOQ update / estimate convert.
  const shortfallLines: Array<{
    resourceId: string;
    quantity: number;
    unit: string;
    boqItemId?: string;
    expectedRate: number;
    rateSource: string;
  }> = [];

  // FIX (EST-H1): Compute stock and open-requisition ONCE per resource and
  // distribute across grouped demand lines, so a resource used by N BOQ lines
  // isn't credited N× stock. Previously this loop deducted the full stock from
  // each demand line independently → chronic under-ordering.
  // Aggregate total demand per resource first.
  const totalDemandByResource = new Map<string, number>();
  for (const demand of grouped.values()) {
    totalDemandByResource.set(
      demand.resourceId,
      round3((totalDemandByResource.get(demand.resourceId) ?? 0) + demand.quantity),
    );
  }
  // Compute per-resource shortfall once.
  const shortfallByResource = new Map<string, number>();
  for (const [resourceId, totalDemand] of totalDemandByResource) {
    const stock = await getStockQty(companyId, projectId, resourceId);
    const openReq = await getOpenRequisitionQty(companyId, projectId, resourceId);
    shortfallByResource.set(resourceId, round3(totalDemand - stock - openReq));
  }

  for (const demand of grouped.values()) {
    const resourceShortfall = shortfallByResource.get(demand.resourceId) ?? 0;
    if (resourceShortfall <= 0) continue;
    const totalDemand = totalDemandByResource.get(demand.resourceId) ?? demand.quantity;
    const proportion = totalDemand > 0 ? demand.quantity / totalDemand : 1;
    const shortfall = round3(resourceShortfall * proportion);
    if (shortfall <= 0) continue;

    const { expectedRate, rateSource } = await resolveRequisitionLineRate(companyId, projectId, {
      resourceId: demand.resourceId,
      boqItemId: demand.boqItemId,
    });
    // FIX (EST-M15/NR-6): Convert quantity + unit to the resource's canonical
    // stock unit. If units are incompatible, skip rather than write wrong qty.
    const converted = await resolveCanonicalUnitAndQty(
      companyId,
      demand.resourceId,
      demand.unit,
      shortfall,
    );
    // FIX (R2-12): Log when a demand line is silently skipped because its unit
    // can't be converted to the resource's canonical stock unit. Previously
    // these lines vanished with no trace, hiding data-quality issues.
    if (!converted) {
      logger.warn('Skipped material demand line: incompatible units (no conversion)', {
        resourceId: demand.resourceId,
        demandUnit: demand.unit,
        shortfall,
      });
      continue;
    }
    shortfallLines.push({
      resourceId: demand.resourceId,
      quantity: converted.quantity,
      unit: converted.unit,
      boqItemId: demand.boqItemId,
      expectedRate,
      rateSource,
    });
  }

  const reqNumbers: string[] = [];
  let created = 0;

  if (shortfallLines.length > 0) {
    const reqNumber = await nextAutoReqNumber(companyId);
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
          create: shortfallLines.map((l) => ({
            resourceId: l.resourceId,
            quantity: l.quantity,
            unit: l.unit,
            boqItemId: l.boqItemId ?? null,
            expectedRate: l.expectedRate,
            rateSource: l.rateSource,
          })),
        },
      },
    });
    reqNumbers.push(reqNumber);
    created = 1;
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
    // FIX (VO-B3): Include VARIATION category rows (new-scope lines created on
    // change order approve) alongside MATERIAL rows. Previously these were
    // excluded by the startsWith('MATERIAL') filter, so approved variation
    // quantity was invisible to the shortfall scan.
    where: {
      projectId,
      isSuperseded: false,
      OR: [
        { category: { startsWith: 'MATERIAL' } },
        { category: 'VARIATION' },
      ],
    },
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

    // FIX (VO-B3 + VAR-C6b): For VARIATION rows without an estimateItem link,
    // try to RA-explode using the direct BOQItem.rateAnalysisId (set in VAR-C6
    // when a variation line has an RA pick). Fall back to ChangeOrderLine
    // resourceId lookup, then safety-net description match.
    if (!est && item.category === 'VARIATION') {
      // VAR-C6b: First try direct BOQItem fields (resourceId / rateAnalysisId)
      const demands = await materialDemandsForEstimateItem(
        {
          type: 'MATERIAL',
          resourceId: item.resourceId ?? null,
          rateAnalysisId: item.rateAnalysisId ?? null,
          quantity: remaining,
          unit: item.unit,
          description: item.description,
        },
        item.id,
        companyId,
      );
      if (demands.length > 0) {
        for (const d of demands) {
          if (d.quantity <= 0) continue;
          lines.push({
            ...d,
            itemCode: item.itemCode,
            description: item.description,
          });
        }
        continue;
      }

      // Fall back to ChangeOrderLine resourceId (pre-VAR-C6 path)
      const coLine = await prisma.changeOrderLine.findFirst({
        where: {
          description: item.description,
          changeOrder: { projectId, status: 'APPROVED' },
          resourceId: { not: null },
        },
        select: { resourceId: true, rateAnalysisId: true },
      });
      // Try RA explosion from ChangeOrderLine if direct BOQItem had no RA
      if (coLine?.rateAnalysisId && !item.rateAnalysisId) {
        const coDemands = await materialDemandsForEstimateItem(
          {
            type: 'MATERIAL',
            resourceId: coLine.resourceId ?? null,
            rateAnalysisId: coLine.rateAnalysisId,
            quantity: remaining,
            unit: item.unit,
            description: item.description,
          },
          item.id,
          companyId,
        );
        if (coDemands.length > 0) {
          for (const d of coDemands) {
            if (d.quantity <= 0) continue;
            lines.push({
              ...d,
              itemCode: item.itemCode,
              description: item.description,
            });
          }
          continue;
        }
      }
      if (coLine?.resourceId) {
        lines.push({
          resourceId: coLine.resourceId,
          quantity: remaining,
          unit: item.unit,
          boqItemId: item.id,
          itemCode: item.itemCode,
          description: item.description,
        });
      }
      continue;
    }

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

  // Build preview rows - each demand line shows its proportional shortfall
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