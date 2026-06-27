/**
 * BuildFlow — Estimate service (core cost estimation engine).
 *
 * Summary computation is ALWAYS recomputed on GET — never cached stale.
 * Workflow: DRAFT -> REVIEWED -> APPROVED/REJECTED -> SUPERSEDED
 * Only APPROVED estimates can convert to BOQ.
 * APPROVED estimates are immutable.
 */
import { EstimateStatus, Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { recordAudit } from '../utils/audit';
import { getProject } from './project.service';
import type {
  CreateEstimateInput,
  UpdateEstimateMetaInput,
  CreateEstimateSectionInput,
  UpdateEstimateSectionInput,
  CreateEstimateItemInput,
  UpdateEstimateItemInput,
  RejectEstimateInput,
} from '@buildflow/shared';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface EstimateSummary {
  materialCost: number;
  labourCost: number;
  equipmentCost: number;
  subcontractorCost: number;
  miscCost: number;
  subtotal: number;
  overheadPct: number;
  overheadAmount: number;
  contingencyPct: number;
  contingencyAmount: number;
  profitMarginPct: number;
  profitMarginAmount: number;
  grandTotalBeforeGST: number;
  gstAmount: number;
  grandTotal: number;
  materialPct: number;
  labourPct: number;
  equipmentPct: number;
  subPct: number;
  miscPct: number;
}

export interface SectionWithItems {
  id: string;
  name: string;
  orderIndex: number;
  description: string | null;
  items: Array<{
    id: string;
    description: string;
    unit: string;
    quantity: number;
    rate: number;
    amount: number;
    type: string;
    resourceId: string | null;
    resourceName: string | null;
    itemCode: string | null;
    notes: string | null;
  }>;
  subtotal: number;
}

/* ------------------------------------------------------------------ */
/* Summary computation (pure function)                                */
/* ------------------------------------------------------------------ */

export function computeSummary(
  items: Array<{
    type: string;
    amount: number;
    resourceGstRate?: number | null;
  }>,
  overheadPct: number,
  contingencyPct: number,
  profitMarginPct: number,
): EstimateSummary {
  const materialCost = sumByType(items, 'MATERIAL');
  const labourCost = sumByType(items, 'LABOUR');
  const equipmentCost = sumByType(items, 'EQUIPMENT');
  const subcontractorCost = sumByType(items, 'SUBCONTRACTOR');
  const miscCost = sumByType(items, 'MISC');

  const subtotal = round2(
    materialCost + labourCost + equipmentCost + subcontractorCost + miscCost,
  );

  const overheadAmount = round2((subtotal * overheadPct) / 100);
  const contingencyAmount = round2((subtotal * contingencyPct) / 100);
  const profitMarginAmount = round2((subtotal * profitMarginPct) / 100);

  const grandTotalBeforeGST = round2(
    subtotal + overheadAmount + contingencyAmount + profitMarginAmount,
  );

  // Weighted GST per item
  const gstAmount = round2(
    items.reduce((sum, item) => {
      const gstRate = item.resourceGstRate ?? 0;
      return sum + (item.amount * gstRate) / 100;
    }, 0),
  );

  const grandTotal = round2(grandTotalBeforeGST + gstAmount);

  return {
    materialCost: round2(materialCost),
    labourCost: round2(labourCost),
    equipmentCost: round2(equipmentCost),
    subcontractorCost: round2(subcontractorCost),
    miscCost: round2(miscCost),
    subtotal,
    overheadPct,
    overheadAmount,
    contingencyPct,
    contingencyAmount,
    profitMarginPct,
    profitMarginAmount,
    grandTotalBeforeGST,
    gstAmount,
    grandTotal,
    materialPct: grandTotal > 0 ? pct(materialCost, grandTotal) : 0,
    labourPct: grandTotal > 0 ? pct(labourCost, grandTotal) : 0,
    equipmentPct: grandTotal > 0 ? pct(equipmentCost, grandTotal) : 0,
    subPct: grandTotal > 0 ? pct(subcontractorCost, grandTotal) : 0,
    miscPct: grandTotal > 0 ? pct(miscCost, grandTotal) : 0,
  };
}

function sumByType(
  items: Array<{ type: string; amount: number }>,
  type: string,
): number {
  return items.filter((i) => i.type === type).reduce((s, i) => s + i.amount, 0);
}

function pct(part: number, whole: number): number {
  return round2((part / whole) * 100);
}

function round2(n: number): number {
  return Number(n.toFixed(2));
}

/* ------------------------------------------------------------------ */
/* Fetch full estimate with computed summary (always fresh)           */
/* ------------------------------------------------------------------ */

export async function getEstimateWithSummary(companyId: string, estimateId: string) {
  const estimate = await prisma.estimate.findFirst({
    where: { id: estimateId, companyId },
    include: {
      sections: { orderBy: { orderIndex: 'asc' } },
      items: {
        orderBy: { createdAt: 'asc' },
        include: { resource: { select: { name: true, gstRate: true } } },
      },
      createdByUser: { select: { name: true } },
      approvedByUser: { select: { name: true } },
    },
  });
  if (!estimate) throw ApiError.notFound('Estimate not found');

  const sections: SectionWithItems[] = estimate.sections.map((s) => {
    const sectionItems = estimate.items
      .filter((i) => i.sectionId === s.id)
      .map((i) => ({
        id: i.id,
        description: i.description,
        unit: i.unit,
        quantity: Number(i.quantity),
        rate: Number(i.rate),
        amount: Number(i.amount),
        type: i.type,
        resourceId: i.resourceId,
        resourceName: i.resource?.name ?? null,
        itemCode: i.itemCode,
        notes: i.notes,
      }));
    return {
      id: s.id,
      name: s.name,
      orderIndex: s.orderIndex,
      description: s.description,
      items: sectionItems,
      subtotal: round2(sectionItems.reduce((sum, i) => sum + i.amount, 0)),
    };
  });

  const summary = computeSummary(
    estimate.items.map((i) => ({
      type: i.type,
      amount: Number(i.amount),
      resourceGstRate: i.resource ? Number(i.resource.gstRate) : 0,
    })),
    Number(estimate.overheadPct),
    Number(estimate.contingencyPct),
    Number(estimate.profitMarginPct),
  );

  return {
    id: estimate.id,
    projectId: estimate.projectId,
    name: estimate.name,
    version: estimate.version,
    status: estimate.status,
    notes: estimate.notes,
    rejectionReason: estimate.rejectionReason,
    createdByName: estimate.createdByUser.name,
    approvedByName: estimate.approvedByUser?.name ?? null,
    approvedAt: estimate.approvedAt?.toISOString() ?? null,
    createdAt: estimate.createdAt.toISOString(),
    updatedAt: estimate.updatedAt.toISOString(),
    sections,
    summary,
  };
}

/* ------------------------------------------------------------------ */
/* List estimates for a project                                        */
/* ------------------------------------------------------------------ */

export async function listEstimates(companyId: string, projectId: string) {
  await getProject(companyId, projectId);
  const estimates = await prisma.estimate.findMany({
    where: { projectId, companyId },
    orderBy: { version: 'desc' },
    include: { createdByUser: { select: { name: true } } },
  });

  const items = await prisma.estimateItem.findMany({
    where: { estimateId: { in: estimates.map((e) => e.id) } },
    include: { resource: { select: { gstRate: true } } },
  });

  return estimates.map((e) => {
    const estItems = items.filter((i) => i.estimateId === e.id);
    const summary = computeSummary(
      estItems.map((i) => ({
        type: i.type,
        amount: Number(i.amount),
        resourceGstRate: i.resource ? Number(i.resource.gstRate) : 0,
      })),
      Number(e.overheadPct),
      Number(e.contingencyPct),
      Number(e.profitMarginPct),
    );
    return {
      id: e.id,
      name: e.name,
      version: e.version,
      status: e.status,
      grandTotal: summary.grandTotal,
      createdAt: e.createdAt.toISOString(),
      createdByName: e.createdByUser.name,
      approvedAt: e.approvedAt?.toISOString() ?? null,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Estimate CRUD (metadata)                                            */
/* ------------------------------------------------------------------ */

export async function createEstimate(
  companyId: string,
  userId: string,
  projectId: string,
  input: CreateEstimateInput,
  ipAddress?: string,
) {
  await getProject(companyId, projectId);

  const maxVersion = await prisma.estimate.findFirst({
    where: { projectId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  const estimate = await prisma.estimate.create({
    data: {
      projectId,
      companyId,
      name: input.name,
      version: (maxVersion?.version ?? 0) + 1,
      status: EstimateStatus.DRAFT,
      overheadPct: input.overheadPct,
      contingencyPct: input.contingencyPct,
      profitMarginPct: input.profitMarginPct,
      notes: input.notes ?? null,
      createdBy: userId,
    },
  });

  await recordAudit({
    companyId,
    userId,
    action: 'CREATE',
    entityType: 'estimate',
    entityId: estimate.id,
    newValue: { name: estimate.name, version: estimate.version },
    ipAddress,
  });

  return estimate;
}

export async function updateEstimateMeta(
  companyId: string,
  userId: string,
  estimateId: string,
  input: UpdateEstimateMetaInput,
  ipAddress?: string,
) {
  await getEstimateForEditing(companyId, estimateId);

  const updated = await prisma.estimate.update({
    where: { id: estimateId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.overheadPct !== undefined && { overheadPct: input.overheadPct }),
      ...(input.contingencyPct !== undefined && { contingencyPct: input.contingencyPct }),
      ...(input.profitMarginPct !== undefined && {
        profitMarginPct: input.profitMarginPct,
      }),
    },
  });

  await recordAudit({
    companyId,
    userId,
    action: 'UPDATE',
    entityType: 'estimate_meta',
    entityId: estimateId,
    newValue: { name: updated.name },
    ipAddress,
  });

  return getEstimateWithSummary(companyId, estimateId);
}

export async function deleteEstimate(
  companyId: string,
  userId: string,
  estimateId: string,
  ipAddress?: string,
) {
  const estimate = await getEstimateForEditing(companyId, estimateId);
  if (estimate.status !== EstimateStatus.DRAFT) {
    throw ApiError.conflict('Only DRAFT estimates can be deleted');
  }

  await prisma.estimate.delete({ where: { id: estimateId } });

  await recordAudit({
    companyId,
    userId,
    action: 'DELETE',
    entityType: 'estimate',
    entityId: estimateId,
    ipAddress,
  });
}

/* ------------------------------------------------------------------ */
/* Section CRUD                                                        */
/* ------------------------------------------------------------------ */

export async function createSection(
  companyId: string,
  userId: string,
  estimateId: string,
  input: CreateEstimateSectionInput,
  ipAddress?: string,
) {
  await getEstimateForEditing(companyId, estimateId);

  const section = await prisma.estimateSection.create({
    data: {
      estimateId,
      name: input.name,
      description: input.description ?? null,
      orderIndex: input.orderIndex,
    },
  });

  await recordAudit({
    companyId,
    userId,
    action: 'CREATE',
    entityType: 'estimate_section',
    entityId: section.id,
    newValue: { name: section.name, estimateId },
    ipAddress,
  });

  return section;
}

export async function updateSection(
  companyId: string,
  userId: string,
  estimateId: string,
  sectionId: string,
  input: UpdateEstimateSectionInput,
  ipAddress?: string,
) {
  await getEstimateForEditing(companyId, estimateId);

  const section = await prisma.estimateSection.findFirst({
    where: { id: sectionId, estimateId },
  });
  if (!section) throw ApiError.notFound('Section not found');

  const updated = await prisma.estimateSection.update({
    where: { id: sectionId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.orderIndex !== undefined && { orderIndex: input.orderIndex }),
    },
  });

  await recordAudit({
    companyId,
    userId,
    action: 'UPDATE',
    entityType: 'estimate_section',
    entityId: sectionId,
    newValue: { name: updated.name },
    ipAddress,
  });

  return updated;
}

export async function deleteSection(
  companyId: string,
  userId: string,
  estimateId: string,
  sectionId: string,
  ipAddress?: string,
) {
  await getEstimateForEditing(companyId, estimateId);

  const section = await prisma.estimateSection.findFirst({
    where: { id: sectionId, estimateId },
  });
  if (!section) throw ApiError.notFound('Section not found');

  await prisma.estimateSection.delete({ where: { id: sectionId } });

  await recordAudit({
    companyId,
    userId,
    action: 'DELETE',
    entityType: 'estimate_section',
    entityId: sectionId,
    ipAddress,
  });
}

/* ------------------------------------------------------------------ */
/* Item CRUD                                                           */
/* ------------------------------------------------------------------ */

export async function createItem(
  companyId: string,
  userId: string,
  estimateId: string,
  input: CreateEstimateItemInput,
  ipAddress?: string,
) {
  await getEstimateForEditing(companyId, estimateId);

  const section = await prisma.estimateSection.findFirst({
    where: { id: input.sectionId, estimateId },
  });
  if (!section) throw ApiError.badRequest('Section does not belong to this estimate');

  const amount = round2(input.quantity * input.rate);

  const item = await prisma.estimateItem.create({
    data: {
      estimateId,
      sectionId: input.sectionId,
      description: input.description,
      unit: input.unit,
      quantity: input.quantity,
      rate: input.rate,
      amount,
      type: input.type,
      resourceId: input.resourceId ?? null,
      wbsItemId: input.wbsItemId ?? null,
      itemCode: input.itemCode ?? null,
      notes: input.notes ?? null,
    },
  });

  await recordAudit({
    companyId,
    userId,
    action: 'CREATE',
    entityType: 'estimate_item',
    entityId: item.id,
    newValue: { description: item.description, amount },
    ipAddress,
  });

  return item;
}

export async function updateItem(
  companyId: string,
  userId: string,
  itemId: string,
  input: UpdateEstimateItemInput,
  ipAddress?: string,
) {
  const item = await prisma.estimateItem.findFirst({
    where: { id: itemId, estimate: { companyId } },
  });
  if (!item) throw ApiError.notFound('Estimate item not found');

  await getEstimateForEditing(companyId, item.estimateId);

  const quantity = input.quantity ?? Number(item.quantity);
  const rate = input.rate ?? Number(item.rate);
  const amount = round2(quantity * rate);

  const updated = await prisma.estimateItem.update({
    where: { id: itemId },
    data: {
      ...(input.sectionId !== undefined && { sectionId: input.sectionId }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.unit !== undefined && { unit: input.unit }),
      quantity,
      rate,
      amount,
      ...(input.type !== undefined && { type: input.type }),
      ...(input.resourceId !== undefined && { resourceId: input.resourceId }),
      ...(input.wbsItemId !== undefined && { wbsItemId: input.wbsItemId }),
      ...(input.itemCode !== undefined && { itemCode: input.itemCode }),
      ...(input.notes !== undefined && { notes: input.notes }),
    },
  });

  await recordAudit({
    companyId,
    userId,
    action: 'UPDATE',
    entityType: 'estimate_item',
    entityId: itemId,
    oldValue: { amount: Number(item.amount) },
    newValue: { amount },
    ipAddress,
  });

  return updated;
}

export async function deleteItem(
  companyId: string,
  userId: string,
  itemId: string,
  ipAddress?: string,
) {
  const item = await prisma.estimateItem.findFirst({
    where: { id: itemId, estimate: { companyId } },
  });
  if (!item) throw ApiError.notFound('Estimate item not found');

  await getEstimateForEditing(companyId, item.estimateId);

  await prisma.estimateItem.delete({ where: { id: itemId } });

  await recordAudit({
    companyId,
    userId,
    action: 'DELETE',
    entityType: 'estimate_item',
    entityId: itemId,
    ipAddress,
  });
}

/* ------------------------------------------------------------------ */
/* Workflow: submit, approve, reject, duplicate                        */
/* ------------------------------------------------------------------ */

export async function submitForReview(
  companyId: string,
  userId: string,
  estimateId: string,
  ipAddress?: string,
) {
  const estimate = await getEstimateForEditing(companyId, estimateId);
  if (estimate.status !== EstimateStatus.DRAFT) {
    throw ApiError.conflict('Only DRAFT estimates can be submitted for review');
  }

  const itemCount = await prisma.estimateItem.count({ where: { estimateId } });
  if (itemCount === 0) {
    throw ApiError.badRequest('Cannot submit an estimate with no line items');
  }

  await persistComputedTotals(companyId, estimateId);

  const updated = await prisma.estimate.update({
    where: { id: estimateId },
    data: { status: EstimateStatus.REVIEWED },
  });

  await recordAudit({
    companyId,
    userId,
    action: 'SUBMIT',
    entityType: 'estimate',
    entityId: estimateId,
    newValue: { status: updated.status },
    ipAddress,
  });

  return updated;
}

export async function approveEstimate(
  companyId: string,
  userId: string,
  role: Role,
  estimateId: string,
  ipAddress?: string,
) {
  if (role !== Role.OWNER) {
    throw ApiError.forbidden('Only OWNER role can approve estimates');
  }

  const estimate = await prisma.estimate.findFirst({
    where: { id: estimateId, companyId },
  });
  if (!estimate) throw ApiError.notFound('Estimate not found');
  if (estimate.status !== EstimateStatus.REVIEWED) {
    throw ApiError.conflict('Only REVIEWED estimates can be approved');
  }

  await persistComputedTotals(companyId, estimateId);

  const updated = await prisma.estimate.update({
    where: { id: estimateId },
    data: {
      status: EstimateStatus.APPROVED,
      approvedBy: userId,
      approvedAt: new Date(),
      rejectionReason: null,
    },
  });

  // Supersede previous approved versions
  await prisma.estimate.updateMany({
    where: {
      projectId: estimate.projectId,
      status: EstimateStatus.APPROVED,
      id: { not: estimateId },
    },
    data: { status: EstimateStatus.SUPERSEDED },
  });

  await recordAudit({
    companyId,
    userId,
    action: 'APPROVE',
    entityType: 'estimate',
    entityId: estimateId,
    newValue: { status: updated.status, approvedBy: userId },
    ipAddress,
  });

  return updated;
}

export async function rejectEstimate(
  companyId: string,
  userId: string,
  role: Role,
  estimateId: string,
  input: RejectEstimateInput,
  ipAddress?: string,
) {
  if (role !== Role.OWNER) {
    throw ApiError.forbidden('Only OWNER role can reject estimates');
  }

  const estimate = await prisma.estimate.findFirst({
    where: { id: estimateId, companyId },
  });
  if (!estimate) throw ApiError.notFound('Estimate not found');
  if (estimate.status !== EstimateStatus.REVIEWED) {
    throw ApiError.conflict('Only REVIEWED estimates can be rejected');
  }

  const updated = await prisma.estimate.update({
    where: { id: estimateId },
    data: {
      status: EstimateStatus.REJECTED,
      rejectionReason: input.reason,
    },
  });

  await recordAudit({
    companyId,
    userId,
    action: 'REJECT',
    entityType: 'estimate',
    entityId: estimateId,
    newValue: { status: updated.status, reason: input.reason },
    ipAddress,
  });

  return updated;
}

export async function duplicateEstimate(
  companyId: string,
  userId: string,
  estimateId: string,
  ipAddress?: string,
) {
  const source = await getEstimateWithSummary(companyId, estimateId);

  const maxVersion = await prisma.estimate.findFirst({
    where: { projectId: source.projectId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  const dup = await prisma.estimate.create({
    data: {
      projectId: source.projectId,
      companyId,
      name: `${source.name} (Revision)`,
      version: (maxVersion?.version ?? 0) + 1,
      status: EstimateStatus.DRAFT,
      overheadPct: source.summary.overheadPct,
      contingencyPct: source.summary.contingencyPct,
      profitMarginPct: source.summary.profitMarginPct,
      notes: source.notes,
      createdBy: userId,
    },
  });

  for (const section of source.sections) {
    const newSection = await prisma.estimateSection.create({
      data: {
        estimateId: dup.id,
        name: section.name,
        description: section.description,
        orderIndex: section.orderIndex,
      },
    });
    for (const item of section.items) {
      await prisma.estimateItem.create({
        data: {
          estimateId: dup.id,
          sectionId: newSection.id,
          description: item.description,
          unit: item.unit,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.amount,
          type: item.type as never,
          resourceId: item.resourceId,
          itemCode: item.itemCode,
          notes: item.notes,
        },
      });
    }
  }

  await recordAudit({
    companyId,
    userId,
    action: 'CREATE',
    entityType: 'estimate',
    entityId: dup.id,
    newValue: { duplicatedFrom: estimateId, version: dup.version },
    ipAddress,
  });

  return getEstimateWithSummary(companyId, dup.id);
}

/* ------------------------------------------------------------------ */
/* Compare two estimates                                               */
/* ------------------------------------------------------------------ */

export async function compareEstimates(
  companyId: string,
  idA: string,
  idB: string,
) {
  const [a, b] = await Promise.all([
    getEstimateWithSummary(companyId, idA),
    getEstimateWithSummary(companyId, idB),
  ]);

  const sectionsA = new Map(a.sections.map((s) => [s.name, s]));
  const sectionsB = new Map(b.sections.map((s) => [s.name, s]));
  const allSectionNames = Array.from(
    new Set([...sectionsA.keys(), ...sectionsB.keys()]),
  );

  const sectionComparison = allSectionNames.map((name) => {
    const sA = sectionsA.get(name);
    const sB = sectionsB.get(name);
    const amountA = sA?.subtotal ?? 0;
    const amountB = sB?.subtotal ?? 0;
    const diff = round2(amountB - amountA);
    const changePct = amountA > 0 ? round2((diff / amountA) * 100) : 0;
    return {
      section: name,
      versionA: amountA,
      versionB: amountB,
      diff,
      changePct,
    };
  });

  const grandDiff = round2(b.summary.grandTotal - a.summary.grandTotal);
  const grandChangePct =
    a.summary.grandTotal > 0
      ? round2((grandDiff / a.summary.grandTotal) * 100)
      : 0;

  return {
    estimateA: {
      id: a.id,
      name: a.name,
      version: a.version,
      grandTotal: a.summary.grandTotal,
    },
    estimateB: {
      id: b.id,
      name: b.name,
      version: b.version,
      grandTotal: b.summary.grandTotal,
    },
    sections: sectionComparison,
    grandDiff,
    grandChangePct,
    summary: `Version ${b.version} is Rs ${Math.abs(grandDiff).toLocaleString('en-IN')} (${Math.abs(grandChangePct)}%) ${grandDiff > 0 ? 'higher' : 'lower'} than Version ${a.version}`,
  };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

async function getEstimateForEditing(companyId: string, estimateId: string) {
  const estimate = await prisma.estimate.findFirst({
    where: { id: estimateId, companyId },
  });
  if (!estimate) throw ApiError.notFound('Estimate not found');

  const editable: EstimateStatus[] = [EstimateStatus.DRAFT, EstimateStatus.REJECTED];
  if (!editable.includes(estimate.status)) {
    throw ApiError.conflict(
      `Estimate is ${estimate.status} — only DRAFT or REJECTED estimates are editable. Duplicate to revise.`,
    );
  }
  return estimate;
}

async function persistComputedTotals(companyId: string, estimateId: string) {
  const full = await getEstimateWithSummary(companyId, estimateId);
  await prisma.estimate.update({
    where: { id: estimateId },
    data: {
      totalMaterialCost: full.summary.materialCost,
      totalLabourCost: full.summary.labourCost,
      totalEquipmentCost: full.summary.equipmentCost,
      totalSubcontractorCost: full.summary.subcontractorCost,
      totalMiscCost: full.summary.miscCost,
      subtotal: full.summary.subtotal,
      overheadAmount: full.summary.overheadAmount,
      contingencyAmount: full.summary.contingencyAmount,
      profitMarginAmount: full.summary.profitMarginAmount,
      gstAmount: full.summary.gstAmount,
      grandTotal: full.summary.grandTotal,
    },
  });
}