/**
 * BuildFlow - Project material rate override service.
 */
import { EstimateStatus } from '@buildflow/shared';
import type { UpsertProjectMaterialRateInput } from '@buildflow/shared';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { getProject } from './project.service';
import { getResource } from './resource.service';
import { getRateRegion, listRegionalRates } from './rate-region.service';

function mapProjectRate(row: {
  id: string;
  resourceId: string;
  rate: unknown;
  unit: string;
  notes: string | null;
  updatedAt: Date;
  resource: { id: string; name: string; type: string; unit: string };
}) {
  return {
    id: row.id,
    resourceId: row.resourceId,
    resourceName: row.resource.name,
    resourceType: row.resource.type,
    rate: Number(row.rate),
    unit: row.unit,
    notes: row.notes,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listProjectMaterialRates(companyId: string, projectId: string) {
  await getProject(companyId, projectId);
  const rows = await prisma.projectMaterialRate.findMany({
    where: { projectId },
    orderBy: { resource: { name: 'asc' } },
    include: { resource: { select: { id: true, name: true, type: true, unit: true } } },
  });
  return rows.map(mapProjectRate);
}

export async function upsertProjectMaterialRates(
  companyId: string,
  projectId: string,
  rates: UpsertProjectMaterialRateInput[],
) {
  await getProject(companyId, projectId);

  for (const r of rates) {
    await getResource(companyId, r.resourceId);
    await prisma.projectMaterialRate.upsert({
      where: { projectId_resourceId: { projectId, resourceId: r.resourceId } },
      create: {
        projectId,
        resourceId: r.resourceId,
        rate: r.rate,
        unit: r.unit,
        notes: r.notes ?? null,
      },
      update: {
        rate: r.rate,
        unit: r.unit,
        notes: r.notes ?? null,
      },
    });
  }

  return listProjectMaterialRates(companyId, projectId);
}

export async function copyProjectRatesFromRegion(companyId: string, projectId: string) {
  const project = await getProject(companyId, projectId);
  if (!project.rateRegionId) {
    throw ApiError.badRequest('Assign a rate region to this project first');
  }

  const regionalRates = await listRegionalRates(companyId, project.rateRegionId);
  const latestByResource = new Map<string, (typeof regionalRates)[number]>();
  for (const row of regionalRates) {
    if (!latestByResource.has(row.resourceId)) {
      latestByResource.set(row.resourceId, row);
    }
  }

  const payload = [...latestByResource.values()].map((r) => ({
    resourceId: r.resourceId,
    rate: r.rate,
    unit: r.unit,
    notes: r.notes ? `From region: ${r.notes}` : 'Copied from regional rate book',
  }));

  if (payload.length === 0) return listProjectMaterialRates(companyId, projectId);
  return upsertProjectMaterialRates(companyId, projectId, payload);
}

export async function copyProjectRatesFromEstimate(companyId: string, projectId: string) {
  await getProject(companyId, projectId);

  const items = await prisma.estimateItem.findMany({
    where: {
      resourceId: { not: null },
      type: 'MATERIAL',
      estimate: {
        projectId,
        companyId,
        status: EstimateStatus.APPROVED,
      },
    },
    orderBy: [{ estimate: { approvedAt: 'desc' } }, { createdAt: 'desc' }],
    include: {
      resource: { select: { id: true, unit: true } },
      estimate: { select: { name: true } },
    },
  });

  const latestByResource = new Map<string, (typeof items)[number]>();
  for (const item of items) {
    if (!item.resourceId || latestByResource.has(item.resourceId)) continue;
    latestByResource.set(item.resourceId, item);
  }

  const payload = [...latestByResource.values()].map((item) => ({
    resourceId: item.resourceId!,
    rate: Number(item.rate),
    unit: item.unit || item.resource?.unit || 'unit',
    notes: `From estimate: ${item.estimate.name}`,
  }));

  if (payload.length === 0) return listProjectMaterialRates(companyId, projectId);
  return upsertProjectMaterialRates(companyId, projectId, payload);
}

export async function resolveProjectOverride(
  projectId: string,
  resourceId: string,
): Promise<{ rate: number } | null> {
  const row = await prisma.projectMaterialRate.findUnique({
    where: { projectId_resourceId: { projectId, resourceId } },
  });
  if (!row) return null;
  return { rate: Number(row.rate) };
}

/** Validate rate region belongs to company when assigning to project. */
export async function assertRateRegionForProject(companyId: string, rateRegionId: string | null | undefined) {
  if (!rateRegionId) return;
  await getRateRegion(companyId, rateRegionId);
}
