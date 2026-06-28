/**
 * BuildFlow - Material rate variance (planned vs last PO vs catalog).
 */
import { RATE_VARIANCE_ALERT_PCT, type MaterialRateVarianceRow } from '@buildflow/shared';
import { prisma } from '../lib/prisma';
import { getProject } from './project.service';
import {
  getLastPoMaterialRate,
  resolvePlannedMaterialRate,
} from './material-rate.service';
import { getResource } from './resource.service';

async function collectProjectMaterialIds(companyId: string, projectId: string): Promise<string[]> {
  const [poLines, reqLines, overrides, estItems] = await Promise.all([
    prisma.purchaseOrderLine.findMany({
      where: { purchaseOrder: { projectId, companyId } },
      select: { resourceId: true },
      distinct: ['resourceId'],
    }),
    prisma.materialRequisitionLine.findMany({
      where: { requisition: { projectId, companyId } },
      select: { resourceId: true },
      distinct: ['resourceId'],
    }),
    prisma.projectMaterialRate.findMany({
      where: { projectId },
      select: { resourceId: true },
    }),
    prisma.estimateItem.findMany({
      where: {
        resourceId: { not: null },
        type: 'MATERIAL',
        estimate: { projectId, companyId, status: 'APPROVED' },
      },
      select: { resourceId: true },
      distinct: ['resourceId'],
    }),
  ]);

  const ids = new Set<string>();
  for (const row of [...poLines, ...reqLines, ...overrides, ...estItems]) {
    if (row.resourceId) ids.add(row.resourceId);
  }
  return [...ids];
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export async function listMaterialRateVariance(
  companyId: string,
  projectId: string,
): Promise<MaterialRateVarianceRow[]> {
  await getProject(companyId, projectId);
  const resourceIds = await collectProjectMaterialIds(companyId, projectId);
  if (resourceIds.length === 0) return [];

  const resources = await prisma.resource.findMany({
    where: { id: { in: resourceIds }, companyId, type: 'MATERIAL', isDeleted: false },
    select: { id: true, name: true, unit: true },
    orderBy: { name: 'asc' },
  });

  const rows: MaterialRateVarianceRow[] = [];

  for (const resource of resources) {
    const [planned, lastPo, catalog] = await Promise.all([
      resolvePlannedMaterialRate(companyId, projectId, resource.id),
      getLastPoMaterialRate(companyId, projectId, resource.id),
      getResource(companyId, resource.id),
    ]);

    const plannedRate = planned.rate;
    const lastPoRate = lastPo ? lastPo.rate : null;
    const catalogRate = Number(catalog.rate);

    let variancePct: number | null = null;
    if (lastPoRate != null && plannedRate > 0) {
      variancePct = round1(((lastPoRate - plannedRate) / plannedRate) * 100);
    }

    const threshold = plannedRate * (1 + RATE_VARIANCE_ALERT_PCT / 100);
    const overThreshold = lastPoRate != null && lastPoRate > threshold;

    rows.push({
      resourceId: resource.id,
      name: resource.name,
      unit: resource.unit,
      plannedRate,
      plannedSource: planned.source,
      catalogRate,
      lastPoRate,
      lastPoRef: lastPo?.sourceRef ?? null,
      variancePct,
      overThreshold,
    });
  }

  return rows;
}
