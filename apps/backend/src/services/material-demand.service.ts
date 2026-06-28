/**
 * Material demand engine — compute shortfalls and create DRAFT indents for PM review.
 */
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
  const lines = await prisma.materialRequisitionLine.findMany({
    where: {
      resourceId,
      requisition: {
        companyId,
        projectId,
        status: { in: ['DRAFT', 'SUBMITTED'] },
      },
    },
  });
  return lines.reduce((s, l) => s + Number(l.quantity), 0);
}

async function nextAutoReqNumber(companyId: string): Promise<string> {
  const count = await prisma.materialRequisition.count({ where: { companyId } });
  const ts = Date.now().toString(36).toUpperCase();
  return `IND-AUTO-${ts}-${count + 1}`;
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
    const key = line.resourceId;
    const existing = grouped.get(key);
    if (existing) {
      existing.quantity = round3(existing.quantity + line.quantity);
      if (!existing.boqItemId && line.boqItemId) existing.boqItemId = line.boqItemId;
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

/** Build material demand lines from approved estimate items (MATERIAL type only). */
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
