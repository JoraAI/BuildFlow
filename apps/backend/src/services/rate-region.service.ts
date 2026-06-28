/**
 * BuildFlow - Regional rate book service.
 */
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { getResource } from './resource.service';
import type {
  CreateRateRegionInput,
  UpdateRateRegionInput,
  UpsertRegionalRateInput,
} from '@buildflow/shared';
import { parseDateOnlyToDate } from '@buildflow/shared';

function mapRegion(row: {
  id: string;
  name: string;
  state: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: { rates: number; projects: number };
}) {
  return {
    id: row.id,
    name: row.name,
    state: row.state,
    ratesCount: row._count?.rates ?? 0,
    projectsCount: row._count?.projects ?? 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapRegionalRate(row: {
  id: string;
  resourceId: string;
  rate: unknown;
  unit: string;
  effectiveDate: Date;
  notes: string | null;
  resource: { id: string; name: string; type: string };
}) {
  return {
    id: row.id,
    resourceId: row.resourceId,
    resourceName: row.resource.name,
    resourceType: row.resource.type,
    rate: Number(row.rate),
    unit: row.unit,
    effectiveDate: row.effectiveDate.toISOString(),
    notes: row.notes,
  };
}

export async function listRateRegions(companyId: string) {
  const rows = await prisma.rateRegion.findMany({
    where: { companyId },
    orderBy: { name: 'asc' },
    include: { _count: { select: { rates: true, projects: true } } },
  });
  return rows.map(mapRegion);
}

export async function getRateRegion(companyId: string, regionId: string) {
  const row = await prisma.rateRegion.findFirst({
    where: { id: regionId, companyId },
    include: { _count: { select: { rates: true, projects: true } } },
  });
  if (!row) throw ApiError.notFound('Rate region not found');
  return mapRegion(row);
}

export async function createRateRegion(companyId: string, input: CreateRateRegionInput) {
  const row = await prisma.rateRegion.create({
    data: {
      companyId,
      name: input.name.trim(),
      state: input.state?.trim() || null,
    },
    include: { _count: { select: { rates: true, projects: true } } },
  });
  return mapRegion(row);
}

export async function updateRateRegion(
  companyId: string,
  regionId: string,
  input: UpdateRateRegionInput,
) {
  await getRateRegion(companyId, regionId);
  const row = await prisma.rateRegion.update({
    where: { id: regionId },
    data: {
      ...(input.name !== undefined && { name: input.name.trim() }),
      ...(input.state !== undefined && { state: input.state?.trim() || null }),
    },
    include: { _count: { select: { rates: true, projects: true } } },
  });
  return mapRegion(row);
}

export async function deleteRateRegion(companyId: string, regionId: string) {
  await getRateRegion(companyId, regionId);
  await prisma.project.updateMany({
    where: { rateRegionId: regionId, companyId },
    data: { rateRegionId: null },
  });
  await prisma.rateRegion.delete({ where: { id: regionId } });
  return { success: true };
}

export async function listRegionalRates(companyId: string, regionId: string) {
  await getRateRegion(companyId, regionId);
  const rows = await prisma.regionalMaterialRate.findMany({
    where: { regionId },
    orderBy: [{ resource: { name: 'asc' } }, { effectiveDate: 'desc' }],
    include: { resource: { select: { id: true, name: true, type: true } } },
  });
  return rows.map(mapRegionalRate);
}

export async function upsertRegionalRates(
  companyId: string,
  regionId: string,
  rates: UpsertRegionalRateInput[],
) {
  await getRateRegion(companyId, regionId);

  for (const r of rates) {
    await getResource(companyId, r.resourceId);
    const effectiveDate = parseDateOnlyToDate(r.effectiveDate);
    await prisma.regionalMaterialRate.upsert({
      where: {
        regionId_resourceId_effectiveDate: {
          regionId,
          resourceId: r.resourceId,
          effectiveDate,
        },
      },
      create: {
        regionId,
        resourceId: r.resourceId,
        rate: r.rate,
        unit: r.unit,
        effectiveDate,
        notes: r.notes ?? null,
      },
      update: {
        rate: r.rate,
        unit: r.unit,
        notes: r.notes ?? null,
      },
    });
  }

  return listRegionalRates(companyId, regionId);
}

export async function resolveRegionalRate(
  companyId: string,
  regionId: string,
  resourceId: string,
): Promise<{ rate: number; regionName: string } | null> {
  const region = await prisma.rateRegion.findFirst({
    where: { id: regionId, companyId },
    select: { id: true, name: true },
  });
  if (!region) return null;

  const today = new Date();
  const row = await prisma.regionalMaterialRate.findFirst({
    where: {
      regionId,
      resourceId,
      effectiveDate: { lte: today },
    },
    orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
  });
  if (!row) return null;
  return { rate: Number(row.rate), regionName: region.name };
}
