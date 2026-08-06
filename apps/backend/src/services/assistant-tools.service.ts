/**
 * BuildFlow - Assistant tool execution (in-app chatbot + shared with MCP catalog).
 *
 * Mirrors apps/mcp-server/src/tools.ts handlers using backend Prisma/services.
 */
import { prisma } from '../lib/prisma';
import { getRolePermissions } from '../lib/permissions';
import { updateProject } from './project.service';
import {
  getAllowedTools,
  type Permission,
} from '@buildflow/shared';

export interface AssistantIdentity {
  companyId: string;
  userId: string;
  role: string;
  permissions: Permission[];
}

function serialize<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_, v) =>
      typeof v === 'object' && v !== null && 'toFixed' in v ? Number(v) : v,
    ),
  );
}

function guard(identity: AssistantIdentity, perm: Permission): void {
  if (!identity.permissions.includes(perm)) {
    throw new Error(`Permission denied: "${perm}". Ask an OWNER/admin to grant this permission.`);
  }
}

/** OpenAI-compatible JSON schemas for function calling (subset aligned with MCP). */
export const ASSISTANT_TOOL_SCHEMAS: Record<
  string,
  { type: 'object'; properties: Record<string, unknown>; required?: string[] }
> = {
  list_resources: {
    type: 'object',
    properties: {
      search: { type: 'string' },
      type: { type: 'string', enum: ['MATERIAL', 'LABOUR', 'EQUIPMENT', 'SUBCONTRACTOR'] },
      limit: { type: 'number' },
    },
  },
  create_resource: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      type: { type: 'string', enum: ['MATERIAL', 'LABOUR', 'EQUIPMENT', 'SUBCONTRACTOR'] },
      unit: { type: 'string' },
      rate: { type: 'number' },
      gstRate: { type: 'number' },
      hsnSacCode: { type: 'string' },
      category: { type: 'string' },
    },
    required: ['name', 'type', 'unit', 'rate'],
  },
  update_resource_price: {
    type: 'object',
    properties: { resourceId: { type: 'string' }, rate: { type: 'number' }, gstRate: { type: 'number' } },
    required: ['resourceId', 'rate'],
  },
  list_rate_analyses: {
    type: 'object',
    properties: { search: { type: 'string' }, limit: { type: 'number' } },
  },
  duplicate_rate_analysis: {
    type: 'object',
    properties: { rateAnalysisId: { type: 'string' } },
    required: ['rateAnalysisId'],
  },
  list_projects: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'] },
    },
  },
  update_project_status: {
    type: 'object',
    properties: {
      projectId: { type: 'string' },
      status: { type: 'string', enum: ['PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'] },
    },
    required: ['projectId', 'status'],
  },
  list_proposals: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['DRAFT', 'IN_REVIEW', 'APPROVED', 'SENT', 'WON', 'LOST', 'ARCHIVED'] },
    },
  },
  list_estimates: {
    type: 'object',
    properties: { projectId: { type: 'string' } },
    required: ['projectId'],
  },
  list_bills: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['PENDING', 'APPROVED', 'PAID', 'REJECTED'] },
      projectId: { type: 'string' },
    },
  },
  approve_bill: {
    type: 'object',
    properties: { billId: { type: 'string' } },
    required: ['billId'],
  },
  list_invoices: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['DRAFT', 'SENT', 'PAID', 'OVERDUE'] },
      projectId: { type: 'string' },
    },
  },
  list_boq: {
    type: 'object',
    properties: { projectId: { type: 'string' }, category: { type: 'string' } },
    required: ['projectId'],
  },
};

export function buildOpenAiTools(permissions: Permission[]) {
  const allowed = getAllowedTools(permissions);
  return allowed
    .filter((t) => ASSISTANT_TOOL_SCHEMAS[t.id])
    .map((t) => ({
      type: 'function' as const,
      function: {
        name: t.id,
        description: t.description,
        parameters: ASSISTANT_TOOL_SCHEMAS[t.id],
      },
    }));
}

export async function resolveAssistantIdentity(
  companyId: string,
  userId: string,
): Promise<AssistantIdentity> {
  const user = await prisma.user.findFirstOrThrow({
    where: { id: userId, companyId },
    select: { role: true },
  });
  const permissions = await getRolePermissions(companyId, user.role);
  return { companyId, userId, role: user.role, permissions };
}

export async function executeAssistantTool(
  identity: AssistantIdentity,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const cap = getAllowedTools(identity.permissions).find((t) => t.id === toolName);
  if (!cap) {
    throw new Error(`Tool "${toolName}" is not allowed for your role.`);
  }

  switch (toolName) {
    case 'list_resources': {
      guard(identity, 'settings.material_prices');
      const { search, type, limit = 50 } = args as { search?: string; type?: string; limit?: number };
      const where: Record<string, unknown> = { companyId: identity.companyId, isDeleted: false };
      if (type) where.type = type;
      if (search) where.name = { contains: search, mode: 'insensitive' };
      return serialize(
        await prisma.resource.findMany({
          where,
          select: { id: true, name: true, type: true, unit: true, rate: true, gstRate: true, hsnSacCode: true },
          take: Math.min(Number(limit) || 50, 200),
          orderBy: { name: 'asc' },
        }),
      );
    }
    case 'create_resource': {
      guard(identity, 'settings.material_prices');
      const input = args as {
        name: string;
        type: 'MATERIAL' | 'LABOUR' | 'EQUIPMENT' | 'SUBCONTRACTOR';
        unit: string;
        rate: number;
        gstRate?: number;
        hsnSacCode?: string;
        category?: string;
      };
      let hsnSacCode = input.hsnSacCode;
      if (!hsnSacCode) {
        if (input.type === 'LABOUR') hsnSacCode = '9954';
        else if (input.type === 'EQUIPMENT') hsnSacCode = '9973';
      }
      return serialize(
        await prisma.resource.create({
          data: {
            companyId: identity.companyId,
            name: input.name,
            type: input.type,
            unit: input.unit,
            rate: input.rate,
            gstRate: input.gstRate ?? 0,
            hsnSacCode: hsnSacCode ?? null,
            category: input.category ?? null,
            lastRateUpdatedAt: new Date(),
          },
        }),
      );
    }
    case 'update_resource_price': {
      guard(identity, 'settings.material_prices');
      const { resourceId, rate, gstRate } = args as { resourceId: string; rate: number; gstRate?: number };
      const updated = await prisma.resource.updateMany({
        where: { id: resourceId, companyId: identity.companyId },
        data: { rate, ...(gstRate !== undefined ? { gstRate } : {}), lastRateUpdatedAt: new Date() },
      });
      if (updated.count === 0) throw new Error('Resource not found');
      return { success: true, resourceId, newRate: rate };
    }
    case 'list_rate_analyses': {
      guard(identity, 'settings.rate_analysis');
      const { search, limit = 50 } = args as { search?: string; limit?: number };
      const where: Record<string, unknown> = { companyId: identity.companyId };
      if (search) where.name = { contains: search, mode: 'insensitive' };
      return serialize(
        await prisma.rateAnalysis.findMany({
          where,
          select: { id: true, name: true, unit: true, totalRate: true, stale: true },
          take: Math.min(Number(limit) || 50, 200),
          orderBy: { name: 'asc' },
        }),
      );
    }
    case 'duplicate_rate_analysis': {
      guard(identity, 'settings.rate_analysis');
      const { rateAnalysisId } = args as { rateAnalysisId: string };
      const source = await prisma.rateAnalysis.findFirstOrThrow({
        where: { id: rateAnalysisId, companyId: identity.companyId },
        include: { components: true },
      });
      const dup = await prisma.rateAnalysis.create({
        data: {
          companyId: identity.companyId,
          name: `${source.name} (Copy)`,
          unit: source.unit,
          description: source.description,
          totalRate: source.totalRate,
          stale: source.stale,
          components: {
            create: source.components.map((c) => ({
              resourceId: c.resourceId,
              miscName: c.miscName,
              quantityPerUnit: c.quantityPerUnit,
              unit: c.unit,
              rate: c.rate,
              amount: c.amount,
              type: c.type,
            })),
          },
        },
      });
      return { success: true, id: dup.id, name: dup.name };
    }
    case 'list_projects': {
      guard(identity, 'project.view');
      const { status } = args as { status?: string };
      return serialize(
        await prisma.project.findMany({
          where: {
            companyId: identity.companyId,
            isDeleted: false,
            ...(status ? { status: status as never } : {}),
          },
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
            budget: true,
            startDate: true,
            endDate: true,
            clientName: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
      );
    }
    case 'update_project_status': {
      guard(identity, 'project.edit');
      const { projectId, status } = args as { projectId: string; status: string };
      const updated = await updateProject(identity.companyId, identity.userId, projectId, {
        status: status as never,
      });
      return serialize({ success: true, projectId: updated.id, name: updated.name, status: updated.status });
    }
    case 'list_proposals': {
      guard(identity, 'proposal.view');
      const { status } = args as { status?: string };
      return serialize(
        await prisma.proposal.findMany({
          where: {
            companyId: identity.companyId,
            ...(status ? { status: status as never } : {}),
          },
          select: {
            id: true,
            title: true,
            status: true,
            clientName: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
      );
    }
    case 'list_estimates': {
      guard(identity, 'estimate.view');
      const { projectId } = args as { projectId: string };
      return serialize(
        await prisma.estimate.findMany({
          where: { projectId, companyId: identity.companyId },
          select: { id: true, name: true, version: true, status: true, grandTotal: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        }),
      );
    }
    case 'list_bills': {
      guard(identity, 'bill.view');
      const { status, projectId } = args as { status?: string; projectId?: string };
      return serialize(
        await prisma.bill.findMany({
          where: {
            companyId: identity.companyId,
            ...(status ? { status: status as never } : {}),
            ...(projectId ? { projectId } : {}),
          },
          select: {
            id: true,
            vendorName: true,
            billNumber: true,
            category: true,
            status: true,
            total: true,
            billDate: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
      );
    }
    case 'approve_bill': {
      guard(identity, 'bill.approve');
      const { billId } = args as { billId: string };
      const updated = await prisma.bill.updateMany({
        where: { id: billId, companyId: identity.companyId, status: 'PENDING' },
        data: { status: 'APPROVED', approvedBy: identity.userId },
      });
      if (updated.count === 0) throw new Error('Bill not found or already processed');
      return { success: true, billId, newStatus: 'APPROVED' };
    }
    case 'list_invoices': {
      guard(identity, 'invoice.view');
      const { status, projectId } = args as { status?: string; projectId?: string };
      return serialize(
        await prisma.invoice.findMany({
          where: {
            companyId: identity.companyId,
            ...(status ? { status: status as never } : {}),
            ...(projectId ? { projectId } : {}),
          },
          select: {
            id: true,
            invoiceNumber: true,
            clientName: true,
            status: true,
            total: true,
            dueDate: true,
          },
          orderBy: { invoiceDate: 'desc' },
          take: 50,
        }),
      );
    }
    case 'list_boq': {
      guard(identity, 'boq.view');
      const { projectId, category } = args as { projectId: string; category?: string };
      return serialize(
        await prisma.bOQItem.findMany({
          where: {
            projectId,
            project: { companyId: identity.companyId },
            ...(category ? { category } : {}),
            isSuperseded: false,
          },
          select: {
            id: true,
            itemCode: true,
            description: true,
            unit: true,
            quantity: true,
            rate: true,
            amount: true,
            category: true,
          },
          orderBy: { itemCode: 'asc' },
        }),
      );
    }
    default:
      throw new Error(`Tool "${toolName}" is not implemented on the server yet.`);
  }
}
