/**
 * BuildFlow - Proposal service (pre-project quoting).
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { recordAudit } from '../utils/audit';
import { invalidateCache, cacheKeys } from '../utils/cache';
import {
  Role,
  EstimateStatus,
  ProposalStatus,
  ProjectStatus,
} from '@buildflow/shared';
import type {
  CreateProposalInput,
  UpdateProposalInput,
  ProposalQueryInput,
  PromoteProposalInput,
} from '@buildflow/shared';

function toDateOrNull(d?: string | null): Date | null {
  if (d === null) return null;
  return d ? new Date(d) : null;
}

function generateProposalCode(): string {
  return `PROP-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

async function getProposalOrThrow(companyId: string, id: string) {
  const proposal = await prisma.proposal.findFirst({
    where: { id, companyId },
    include: {
      temporaryProject: { select: { id: true, isTemporary: true, isDeleted: true } },
    },
  });
  if (!proposal) throw ApiError.notFound('Proposal not found');
  return proposal;
}

export async function listProposals(companyId: string, query: ProposalQueryInput) {
  const { page, limit, status, search } = query;
  const where: Prisma.ProposalWhereInput = { companyId };
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { clientName: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.proposal.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        temporaryProject: {
          select: {
            id: true,
            estimates: {
              orderBy: { version: 'desc' },
              take: 1,
              select: {
                id: true,
                status: true,
                grandTotal: true,
                version: true,
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.proposal.count({ where }),
  ]);

  return { rows, total, page, limit };
}

export async function getProposal(companyId: string, id: string) {
  const proposal = await prisma.proposal.findFirst({
    where: { id, companyId },
    include: {
      temporaryProject: {
        select: {
          id: true,
          code: true,
          name: true,
          isTemporary: true,
          budget: true,
          estimates: {
            orderBy: { version: 'desc' },
            select: {
              id: true,
              name: true,
              version: true,
              status: true,
              grandTotal: true,
              createdAt: true,
              approvedAt: true,
            },
          },
        },
      },
      promotedProject: {
        select: { id: true, code: true, name: true, status: true },
      },
    },
  });
  if (!proposal) throw ApiError.notFound('Proposal not found');
  return proposal;
}

export async function createProposal(
  companyId: string,
  userId: string,
  input: CreateProposalInput,
  ipAddress?: string,
) {
  const code = generateProposalCode();

  const result = await prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        companyId,
        name: input.title,
        code,
        type: input.projectType,
        status: ProjectStatus.PLANNING,
        clientName: input.clientName,
        clientContact: input.clientContact ?? null,
        isTemporary: true,
        createdBy: userId,
      },
    });

    const proposal = await tx.proposal.create({
      data: {
        companyId,
        title: input.title,
        clientName: input.clientName,
        clientContact: input.clientContact ?? null,
        projectType: input.projectType,
        temporaryProjectId: project.id,
        validUntil: toDateOrNull(input.validUntil),
        notes: input.notes ?? null,
        createdBy: userId,
      },
    });

    await tx.project.update({
      where: { id: project.id },
      data: { proposalId: proposal.id },
    });

    return { proposal, temporaryProjectId: project.id };
  });

  const creator = await prisma.user.findFirst({
    where: { id: userId, companyId },
    select: { role: true },
  });
  if (creator) {
    await prisma.projectMember.create({
      data: { projectId: result.temporaryProjectId, userId, role: creator.role },
    });
  }

  await recordAudit({
    companyId,
    userId,
    action: 'CREATE',
    entityType: 'proposal',
    entityId: result.proposal.id,
    newValue: { title: result.proposal.title, temporaryProjectId: result.temporaryProjectId },
    ipAddress,
  });

  await invalidateCache(cacheKeys.dashboard(companyId));

  return getProposal(companyId, result.proposal.id);
}

export async function updateProposal(
  companyId: string,
  userId: string,
  id: string,
  input: UpdateProposalInput,
  ipAddress?: string,
) {
  const existing = await getProposalOrThrow(companyId, id);

  // FIX (EST-M7): Whitelist proposal status transitions to prevent invalid
  // jumps (e.g. DRAFT → WON, LOST → SENT). Each status can only move forward.
  const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    DRAFT: ['IN_REVIEW', 'ARCHIVED'],
    IN_REVIEW: ['APPROVED', 'REJECTED', 'ARCHIVED'],
    APPROVED: ['SENT', 'ARCHIVED'],
    SENT: ['WON', 'LOST', 'ARCHIVED'],
    WON: ['ARCHIVED'],
    LOST: ['ARCHIVED'],
    ARCHIVED: ['DRAFT'],
  };
  if (input.status && input.status !== existing.status) {
    const allowed = ALLOWED_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(input.status)) {
      throw ApiError.badRequest(
        `Invalid status transition: "${existing.status}" → "${input.status}". Allowed: ${allowed.join(', ') || 'none'}.`,
      );
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const proposal = await tx.proposal.update({
      where: { id },
      data: {
        title: input.title,
        clientName: input.clientName,
        clientContact: input.clientContact,
        projectType: input.projectType,
        status: input.status,
        validUntil: input.validUntil !== undefined ? toDateOrNull(input.validUntil) : undefined,
        notes: input.notes,
        rejectionReason: input.rejectionReason,
      },
    });

    if (input.title || input.clientName || input.clientContact || input.projectType) {
      await tx.project.update({
        where: { id: existing.temporaryProjectId },
        data: {
          name: input.title ?? undefined,
          clientName: input.clientName ?? undefined,
          clientContact: input.clientContact ?? undefined,
          type: input.projectType ?? undefined,
        },
      });
    }

    return proposal;
  });

  await recordAudit({
    companyId,
    userId,
    action: 'UPDATE',
    entityType: 'proposal',
    entityId: id,
    newValue: updated,
    ipAddress,
  });

  return getProposal(companyId, id);
}

export async function promoteProposal(
  companyId: string,
  userId: string,
  role: Role,
  id: string,
  input: PromoteProposalInput,
  ipAddress?: string,
) {
  if (role !== Role.OWNER) {
    throw ApiError.forbidden('Only OWNER can promote proposals to projects');
  }

  const proposal = await getProposalOrThrow(companyId, id);

  if (proposal.status === ProposalStatus.WON && proposal.promotedProjectId) {
    return getProposal(companyId, id);
  }

  if (proposal.status !== ProposalStatus.APPROVED && proposal.status !== ProposalStatus.SENT) {
    throw ApiError.conflict('Only approved or sent proposals can be promoted');
  }

  const approvedEstimate = await prisma.estimate.findFirst({
    where: {
      projectId: proposal.temporaryProjectId,
      companyId,
      status: EstimateStatus.APPROVED,
    },
    orderBy: { version: 'desc' },
  });

  if (!approvedEstimate) {
    throw ApiError.conflict('An approved estimate is required before promoting to a project');
  }

  const projectId = proposal.temporaryProjectId;
  const budget = approvedEstimate.grandTotal;

  if (input.code) {
    const clash = await prisma.project.findFirst({
      where: {
        companyId,
        code: input.code,
        id: { not: projectId },
        isDeleted: false,
      },
    });
    if (clash) throw ApiError.conflict('Project code already in use');
  }

  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: projectId },
      data: {
        isTemporary: false,
        code: input.code ?? undefined,
        status: (input.status as ProjectStatus) ?? ProjectStatus.IN_PROGRESS,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        budget,
      },
    });

    await tx.proposal.update({
      where: { id },
      data: {
        status: ProposalStatus.WON,
        promotedProjectId: projectId,
      },
    });
  });

  await recordAudit({
    companyId,
    userId,
    action: 'CUSTOM',
    entityType: 'proposal',
    entityId: id,
    newValue: { action: 'PROMOTE', projectId, budget: budget.toString() },
    ipAddress,
  });

  await invalidateCache(cacheKeys.dashboard(companyId));

  return getProposal(companyId, id);
}

export async function deleteProposal(
  companyId: string,
  userId: string,
  role: Role,
  id: string,
  ipAddress?: string,
) {
  if (role !== Role.OWNER) {
    throw ApiError.forbidden('Only OWNER can delete proposals');
  }

  const proposal = await getProposalOrThrow(companyId, id);

  if (proposal.promotedProjectId && !proposal.temporaryProject.isTemporary) {
    throw ApiError.conflict('Cannot delete a proposal that has been promoted to a project');
  }

  const boqCount = await prisma.bOQItem.count({
    where: { projectId: proposal.temporaryProjectId, isSuperseded: false },
  });
  if (boqCount > 0) {
    throw ApiError.conflict('Cannot delete proposal: temporary project has active BOQ items');
  }

  await prisma.$transaction(async (tx) => {
    await tx.estimate.deleteMany({ where: { projectId: proposal.temporaryProjectId } });
    await tx.project.update({
      where: { id: proposal.temporaryProjectId },
      data: { isDeleted: true, proposalId: null },
    });
    await tx.proposal.delete({ where: { id } });
  });

  await recordAudit({
    companyId,
    userId,
    action: 'DELETE',
    entityType: 'proposal',
    entityId: id,
    ipAddress,
  });

  await invalidateCache(cacheKeys.dashboard(companyId));
}

/** Sync proposal pipeline status when estimate workflow changes. */
export async function syncProposalFromEstimate(
  companyId: string,
  projectId: string,
  estimateStatus: EstimateStatus,
) {
  const proposal = await prisma.proposal.findFirst({
    where: { companyId, temporaryProjectId: projectId },
  });
  if (!proposal) return;

  let nextStatus: ProposalStatus | null = null;
  if (estimateStatus === EstimateStatus.REVIEWED) {
    nextStatus = ProposalStatus.IN_REVIEW;
  } else if (estimateStatus === EstimateStatus.APPROVED) {
    nextStatus = ProposalStatus.APPROVED;
  } else if (estimateStatus === EstimateStatus.REJECTED && proposal.status === ProposalStatus.IN_REVIEW) {
    nextStatus = ProposalStatus.DRAFT;
  }

  if (nextStatus && nextStatus !== proposal.status) {
    await prisma.proposal.update({
      where: { id: proposal.id },
      data: { status: nextStatus },
    });
  }
}
