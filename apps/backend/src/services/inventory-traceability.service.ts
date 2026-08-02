/**
 * BuildFlow - Inventory traceability loop (Phase 5 §8.5).
 *
 * Provides end-to-end material traceability: requisition → PO → GRN → stock →
 * daily report usage → BOQ execution. The existing procurement and stock
 * modules already track movements; this service adds a unified traceability
 * view that chains all touchpoints for a given resource in a project.
 */
import { prisma } from '../lib/prisma';
import { assertProjectAccess } from '../middleware/project-access.middleware';

export interface TraceabilityEntry {
  date: string;
  type: string;
  reference: string;
  referenceId: string;
  quantity: number;
  unit: string;
  balanceAfter: number | null;
}

export async function getResourceTraceability(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
  resourceId: string,
): Promise<{ resource: { id: string; name: string; unit: string }; entries: TraceabilityEntry[]; currentBalance: number }> {
  // FIX (NR-33): Verify the caller has access to this project before returning
  // any traceability data. Previously companyId/projectId were accepted
  // unverified, so a cross-tenant requisition line could leak.
  await assertProjectAccess(companyId, userId, role as never, projectId);

  const resource = await prisma.resource.findFirst({
    where: { id: resourceId, companyId, isDeleted: false },
    select: { id: true, name: true, unit: true },
  });
  if (!resource) return { resource: { id: resourceId, name: 'Unknown', unit: '' }, entries: [], currentBalance: 0 };

  // Get all stock movements for this resource in this project's locations
  const locations = await prisma.stockLocation.findMany({
    where: { companyId, projectId },
    select: { id: true },
  });
  const locationIds = locations.map((l) => l.id);

  const movements = await prisma.stockMovement.findMany({
    where: { locationId: { in: locationIds }, resourceId },
    orderBy: { createdAt: 'asc' },
    include: { resource: { select: { unit: true } } },
  });

  let runningBalance = 0;
  const entries: TraceabilityEntry[] = movements.map((m) => {
    const qty = Number(m.quantity);
    if (m.type === 'IN') runningBalance += qty;
    else if (m.type === 'OUT') runningBalance -= qty;
    return {
      date: m.createdAt.toISOString(),
      type: m.type,
      reference: m.referenceType ?? 'UNKNOWN',
      referenceId: m.referenceId ?? '',
      quantity: m.type === 'IN' ? qty : -qty,
      unit: m.resource.unit,
      balanceAfter: Math.round(runningBalance * 1000) / 1000,
    };
  });

  // FIX (NR-33): Scope requisition lines by companyId too (via the requisition
  // relation) so cross-tenant lines can't leak. Removed the .catch(() => [])
  // swallow — failures now propagate as real errors.
  const requisitions = await prisma.materialRequisitionLine.findMany({
    where: { requisition: { projectId, companyId }, resourceId },
    include: { requisition: { select: { reqNumber: true, createdAt: true, status: true } } },
    orderBy: { requisition: { createdAt: 'asc' } },
  });

  for (const rl of requisitions) {
    entries.push({
      date: rl.requisition.createdAt.toISOString(),
      type: 'REQUISITION',
      reference: rl.requisition.reqNumber,
      referenceId: rl.requisitionId,
      quantity: Number(rl.quantity),
      unit: rl.unit,
      balanceAfter: null,
    });
  }

  // Sort by date descending
  entries.sort((a, b) => b.date.localeCompare(a.date));

  // FIX (NR-47): Sum stock across ALL of the project's locations, not just the
  // first one (findFirst returned only a single location's balance).
  const balances = await prisma.stockBalance.findMany({
    where: { locationId: { in: locationIds }, resourceId },
    select: { quantity: true },
  });
  const totalBalance = balances.reduce((s, b) => s + Number(b.quantity), 0);

  return {
    resource: { id: resource.id, name: resource.name, unit: resource.unit ?? '' },
    entries,
    currentBalance: Math.round(totalBalance * 1000) / 1000,
  };
}
