/**
 * BuildFlow - Project-aware material rate resolution.
 *
 * Priority: project override → BOQ → estimate → regional → last PO → catalog.
 */
import { EstimateStatus } from '@buildflow/shared';
import type { MaterialRateSource, ResolvedMaterialRate } from '@buildflow/shared';
import { prisma } from '../lib/prisma';
import { getProject } from './project.service';
import { getResource } from './resource.service';
import { resolveProjectOverride } from './project-material-rate.service';
import { resolveRegionalRate } from './rate-region.service';

async function syncEffectiveResourceRate(companyId: string, resourceId: string): Promise<number> {
  const resource = await getResource(companyId, resourceId);
  return Number(resource.rate);
}

async function resolveFromBoq(
  projectId: string,
  resourceId: string,
  boqItemId?: string,
): Promise<ResolvedMaterialRate | null> {
  if (boqItemId) {
    const item = await prisma.bOQItem.findFirst({
      where: { id: boqItemId, projectId, isSuperseded: false },
      include: { estimateItem: true },
    });
    if (item?.estimateItem?.resourceId === resourceId) {
      return {
        rate: Number(item.estimateItem.rate),
        source: 'BOQ',
        sourceRef: item.itemCode,
      };
    }
  }

  const linked = await prisma.bOQItem.findFirst({
    where: {
      projectId,
      isSuperseded: false,
      estimateItem: { resourceId },
    },
    include: { estimateItem: true },
    orderBy: { itemCode: 'asc' },
  });
  if (linked?.estimateItem) {
    return {
      rate: Number(linked.estimateItem.rate),
      source: 'BOQ',
      sourceRef: linked.itemCode,
    };
  }
  return null;
}

async function resolveFromEstimate(
  companyId: string,
  projectId: string,
  resourceId: string,
): Promise<ResolvedMaterialRate | null> {
  const item = await prisma.estimateItem.findFirst({
    where: {
      resourceId,
      estimate: {
        projectId,
        companyId,
        status: EstimateStatus.APPROVED,
      },
    },
    orderBy: [{ estimate: { approvedAt: 'desc' } }, { createdAt: 'desc' }],
    include: { estimate: { select: { name: true } } },
  });
  if (!item) return null;
  return {
    rate: Number(item.rate),
    source: 'ESTIMATE',
    sourceRef: item.estimate.name,
  };
}

async function resolveFromLastPo(
  companyId: string,
  projectId: string,
  resourceId: string,
): Promise<ResolvedMaterialRate | null> {
  // Prefer POs with a GRN (goods actually received) - avoids draft/test POs skewing variance.
  const grns = await prisma.goodsReceiptNote.findMany({
    where: { projectId, companyId },
    select: { purchaseOrderId: true, receivedDate: true },
    orderBy: { receivedDate: 'desc' },
  });

  const seenPo = new Set<string>();
  for (const grn of grns) {
    if (seenPo.has(grn.purchaseOrderId)) continue;
    seenPo.add(grn.purchaseOrderId);

    const line = await prisma.purchaseOrderLine.findFirst({
      where: { purchaseOrderId: grn.purchaseOrderId, resourceId },
      include: { purchaseOrder: { select: { poNumber: true } } },
    });
    if (line) {
      return {
        rate: Number(line.rate),
        source: 'LAST_PO',
        sourceRef: line.purchaseOrder.poNumber,
      };
    }
  }

  const line = await prisma.purchaseOrderLine.findFirst({
    where: {
      resourceId,
      purchaseOrder: { projectId, companyId },
    },
    orderBy: { purchaseOrder: { createdAt: 'desc' } },
    include: { purchaseOrder: { select: { poNumber: true } } },
  });
  if (!line) return null;
  return {
    rate: Number(line.rate),
    source: 'LAST_PO',
    sourceRef: line.purchaseOrder.poNumber,
  };
}

export async function resolveMaterialRate(
  companyId: string,
  projectId: string,
  resourceId: string,
  opts?: { boqItemId?: string },
): Promise<ResolvedMaterialRate> {
  await getProject(companyId, projectId);
  await getResource(companyId, resourceId);

  const projectOverride = await resolveProjectOverride(projectId, resourceId);
  if (projectOverride) {
    return { rate: projectOverride.rate, source: 'PROJECT', sourceRef: 'Project override' };
  }

  const fromBoq = await resolveFromBoq(projectId, resourceId, opts?.boqItemId);
  if (fromBoq) return fromBoq;

  const fromEstimate = await resolveFromEstimate(companyId, projectId, resourceId);
  if (fromEstimate) return fromEstimate;

  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId },
    select: { rateRegionId: true },
  });
  if (project?.rateRegionId) {
    const regional = await resolveRegionalRate(companyId, project.rateRegionId, resourceId);
    if (regional) {
      return {
        rate: regional.rate,
        source: 'REGION',
        sourceRef: regional.regionName,
      };
    }
  }

  const fromPo = await resolveFromLastPo(companyId, projectId, resourceId);
  if (fromPo) return fromPo;

  // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.7): the inventory catalog rate
  // for purchase planning is the VENDOR COST (costPrice, else WAC), never the
  // selling `rate`. Construction keeps `rate` (estimate catalog rate).
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { subscriptionPlan: true },
  });
  if (company?.subscriptionPlan === 'INVENTORY') {
    const res = await prisma.resource.findUnique({
      where: { id: resourceId },
      select: { costPrice: true, avgCost: true },
    });
    const cost = Number(res?.costPrice ?? 0);
    const wac = Number(res?.avgCost ?? 0);
    return { rate: cost > 0 ? cost : wac, source: 'CATALOG' satisfies MaterialRateSource };
  }

  const catalogRate = await syncEffectiveResourceRate(companyId, resourceId);
  return { rate: catalogRate, source: 'CATALOG' satisfies MaterialRateSource };
}

/** Planned rate chain - excludes last PO (budget/planning source of truth). */
export async function resolvePlannedMaterialRate(
  companyId: string,
  projectId: string,
  resourceId: string,
  opts?: { boqItemId?: string },
): Promise<ResolvedMaterialRate> {
  await getProject(companyId, projectId);
  await getResource(companyId, resourceId);

  const projectOverride = await resolveProjectOverride(projectId, resourceId);
  if (projectOverride) {
    return { rate: projectOverride.rate, source: 'PROJECT', sourceRef: 'Project override' };
  }

  const fromBoq = await resolveFromBoq(projectId, resourceId, opts?.boqItemId);
  if (fromBoq) return fromBoq;

  const fromEstimate = await resolveFromEstimate(companyId, projectId, resourceId);
  if (fromEstimate) return fromEstimate;

  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId },
    select: { rateRegionId: true },
  });
  if (project?.rateRegionId) {
    const regional = await resolveRegionalRate(companyId, project.rateRegionId, resourceId);
    if (regional) {
      return { rate: regional.rate, source: 'REGION', sourceRef: regional.regionName };
    }
  }

  const catalogRate = await syncEffectiveResourceRate(companyId, resourceId);
  return { rate: catalogRate, source: 'CATALOG' satisfies MaterialRateSource };
}

export async function getLastPoMaterialRate(
  companyId: string,
  projectId: string,
  resourceId: string,
): Promise<ResolvedMaterialRate | null> {
  return resolveFromLastPo(companyId, projectId, resourceId);
}

export interface RequisitionLineRateInput {
  // FIX (NR-13): resourceId can be undefined for BOQ-only lines.
  resourceId?: string;
  boqItemId?: string | null;
  expectedRate?: number;
  rateSource?: MaterialRateSource;
}

export interface EnrichedRequisitionLineRate {
  expectedRate: number;
  rateSource: MaterialRateSource;
}

/** Resolve expected rate for a requisition line (honours explicit override). */
export async function resolveRequisitionLineRate(
  companyId: string,
  projectId: string,
  line: RequisitionLineRateInput,
): Promise<EnrichedRequisitionLineRate> {
  if (line.expectedRate !== undefined) {
    return {
      expectedRate: line.expectedRate,
      rateSource: line.rateSource ?? ('MANUAL' as MaterialRateSource),
    };
  }
  // FIX (NR-13): BOQ-only lines (no resourceId) can't resolve from the resource
  // rate chain - return a zero default; the caller should require an explicit
  // expectedRate for such lines.
  if (!line.resourceId) {
    return { expectedRate: 0, rateSource: 'CATALOG' as MaterialRateSource };
  }
  const resolved = await resolveMaterialRate(companyId, projectId, line.resourceId, {
    boqItemId: line.boqItemId ?? undefined,
  });
  return { expectedRate: resolved.rate, rateSource: resolved.source };
}
