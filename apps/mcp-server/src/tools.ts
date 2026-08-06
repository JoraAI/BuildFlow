/**
 * BuildFlow MCP Server - Tool definitions and handlers
 *
 * Each tool is gated by a permission. The handler checks the identity's
 * permissions before executing; if denied, returns a clear error message
 * the LLM can relay to the user.
 */
import { z } from 'zod';
import { prisma } from './prisma';
import { hasPermission } from './permissions';
import type { McpIdentity } from './identity';
import type { Permission } from '@buildflow/shared';

// ─── Types ───────────────────────────────────────────────────────────

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>; // JSON Schema for MCP
  requires: Permission;
  handler: (identity: McpIdentity, args: Record<string, unknown>) => Promise<unknown>;
}

// ─── Permission guard helper ─────────────────────────────────────────

function guard(identity: McpIdentity, perm: Permission): void {
  if (!hasPermission(identity.permissions as Permission[], perm)) {
    throw new PermissionDeniedError(perm);
  }
}

class PermissionDeniedError extends Error {
  constructor(public readonly permission: Permission) {
    super(`Permission denied: you do not have "${permission}". Ask an OWNER/admin to grant this permission.`);
    this.name = 'PermissionDeniedError';
  }
}

// ─── Tool implementations ────────────────────────────────────────────

// Helper to convert Decimal fields to numbers for JSON serialization
function serialize<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (_, v) => (typeof v === 'object' && v !== null && 'toFixed' in v ? Number(v) : v)));
}

const tools: ToolDef[] = [
  // ════════════════════════════════════════════════════════════════
  // RESOURCES
  // ════════════════════════════════════════════════════════════════
  {
    name: 'list_resources',
    description: 'Search and list materials, labour, and equipment from the resource library. Returns id, name, type, unit, rate, gstRate, hsnSacCode.',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Optional search term for resource name' },
        type: { type: 'string', enum: ['MATERIAL', 'LABOUR', 'EQUIPMENT', 'SUBCONTRACTOR'], description: 'Optional filter by resource type' },
        limit: { type: 'number', description: 'Max results (default 50)', default: 50 },
      },
    },
    requires: 'settings.material_prices',
    handler: async (identity, args) => {
      guard(identity, 'settings.material_prices');
      const { search, type, limit = 50 } = args as { search?: string; type?: string; limit?: number };
      const where: Record<string, unknown> = { companyId: identity.companyId, isDeleted: false };
      if (type) where.type = type;
      if (search) where.name = { contains: search, mode: 'insensitive' };
      const resources = await prisma.resource.findMany({
        where,
        select: { id: true, name: true, type: true, unit: true, rate: true, gstRate: true, hsnSacCode: true, category: true },
        take: Math.min(limit, 200),
        orderBy: { name: 'asc' },
      });
      return serialize(resources);
    },
  },
  {
    name: 'create_resource',
    description: 'Create a new resource (material, labour, or equipment). Required: name, type, unit, rate. Optional: gstRate, hsnSacCode, category, brandOrSpec.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Resource name (e.g. "OPC Cement 53 Grade")' },
        type: { type: 'string', enum: ['MATERIAL', 'LABOUR', 'EQUIPMENT', 'SUBCONTRACTOR'] },
        unit: { type: 'string', description: 'Unit of measure (e.g. "bag", "kg", "cum", "day")' },
        rate: { type: 'number', description: 'Rate per unit (pre-GST)' },
        gstRate: { type: 'number', description: 'GST rate % (e.g. 18 for 18%)', default: 0 },
        hsnSacCode: { type: 'string', description: 'HSN code (materials) or SAC code (services)' },
        category: { type: 'string', description: 'Category label (e.g. "Cement", "Steel")' },
        brandOrSpec: { type: 'string', description: 'Brand or specification' },
      },
      required: ['name', 'type', 'unit', 'rate'],
    },
    requires: 'settings.material_prices',
    handler: async (identity, args) => {
      guard(identity, 'settings.material_prices');
      const input = args as {
        name: string; type: 'MATERIAL' | 'LABOUR' | 'EQUIPMENT' | 'SUBCONTRACTOR';
        unit: string; rate: number; gstRate?: number; hsnSacCode?: string;
        category?: string; brandOrSpec?: string;
      };
      // Auto-assign SAC codes for services if not provided (matches seed.ts logic)
      let hsnSacCode = input.hsnSacCode;
      if (!hsnSacCode) {
        if (input.type === 'LABOUR') hsnSacCode = '9954';
        else if (input.type === 'EQUIPMENT') hsnSacCode = '9973';
      }
      const resource = await prisma.resource.create({
        data: {
          companyId: identity.companyId,
          name: input.name,
          type: input.type,
          unit: input.unit,
          rate: input.rate,
          gstRate: input.gstRate ?? 0,
          hsnSacCode: hsnSacCode ?? null,
          category: input.category ?? null,
          brandOrSpec: input.brandOrSpec ?? null,
          lastRateUpdatedAt: new Date(),
        },
      });
      return serialize(resource);
    },
  },
  {
    name: 'update_resource_price',
    description: 'Update the rate (and optionally GST rate) of an existing resource. Requires resource id and new rate.',
    inputSchema: {
      type: 'object',
      properties: {
        resourceId: { type: 'string', description: 'Resource UUID' },
        rate: { type: 'number', description: 'New rate per unit' },
        gstRate: { type: 'number', description: 'Optional new GST rate %' },
      },
      required: ['resourceId', 'rate'],
    },
    requires: 'settings.material_prices',
    handler: async (identity, args) => {
      guard(identity, 'settings.material_prices');
      const { resourceId, rate, gstRate } = args as { resourceId: string; rate: number; gstRate?: number };
      const updated = await prisma.resource.updateMany({
        where: { id: resourceId, companyId: identity.companyId },
        data: { rate, ...(gstRate !== undefined ? { gstRate } : {}), lastRateUpdatedAt: new Date() },
      });
      if (updated.count === 0) throw new Error('Resource not found or does not belong to your company');
      return { success: true, resourceId, newRate: rate };
    },
  },

  // ════════════════════════════════════════════════════════════════
  // RATE ANALYSIS
  // ════════════════════════════════════════════════════════════════
  {
    name: 'list_rate_analyses',
    description: 'List composite rate analyses from the library. Returns id, name, unit, totalRate, and component summary.',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Optional search term' },
        limit: { type: 'number', default: 50 },
      },
    },
    requires: 'settings.rate_analysis',
    handler: async (identity, args) => {
      guard(identity, 'settings.rate_analysis');
      const { search, limit = 50 } = args as { search?: string; limit?: number };
      const where: Record<string, unknown> = { companyId: identity.companyId };
      if (search) where.name = { contains: search, mode: 'insensitive' };
      const analyses = await prisma.rateAnalysis.findMany({
        where,
        select: {
          id: true, name: true, unit: true, totalRate: true, stale: true, updatedAt: true,
          components: { select: { type: true, amount: true, resource: { select: { name: true } } } },
        },
        take: Math.min(limit, 200),
        orderBy: { name: 'asc' },
      });
      return serialize(analyses);
    },
  },
  {
    name: 'duplicate_rate_analysis',
    description: 'Duplicate an existing rate analysis as a starting point. Returns the new rate analysis id.',
    inputSchema: {
      type: 'object',
      properties: {
        rateAnalysisId: { type: 'string', description: 'Source rate analysis UUID' },
      },
      required: ['rateAnalysisId'],
    },
    requires: 'settings.rate_analysis',
    handler: async (identity, args) => {
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
    },
  },

  // ════════════════════════════════════════════════════════════════
  // PROJECTS
  // ════════════════════════════════════════════════════════════════
  {
    name: 'list_projects',
    description: 'List projects with status, budget, and timeline. Returns id, name, code, status, budget, startDate, endDate.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'] },
      },
    },
    requires: 'project.view',
    handler: async (identity, args) => {
      guard(identity, 'project.view');
      const { status } = args as { status?: string };
      const projects = await prisma.project.findMany({
        where: { companyId: identity.companyId, isDeleted: false, ...(status ? { status: status as never } : {}) },
        select: { id: true, name: true, code: true, status: true, budget: true, startDate: true, endDate: true, clientName: true },
        orderBy: { createdAt: 'desc' },
      });
      return serialize(projects);
    },
  },
  {
    name: 'update_project_status',
    description: 'Update project status (e.g. COMPLETED when job is closed). Requires projectId and status.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Project UUID' },
        status: { type: 'string', enum: ['PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'] },
      },
      required: ['projectId', 'status'],
    },
    requires: 'project.edit',
    handler: async (identity, args) => {
      guard(identity, 'project.edit');
      const { projectId, status } = args as { projectId: string; status: string };
      const updated = await prisma.project.updateMany({
        where: { id: projectId, companyId: identity.companyId },
        data: { status: status as never },
      });
      if (updated.count === 0) throw new Error('Project not found');
      return { success: true, projectId, status };
    },
  },
  {
    name: 'list_proposals',
    description: 'List pre-construction proposals. Returns id, title, status, clientName.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['DRAFT', 'IN_REVIEW', 'APPROVED', 'SENT', 'WON', 'LOST', 'ARCHIVED'] },
      },
    },
    requires: 'proposal.view',
    handler: async (identity, args) => {
      guard(identity, 'proposal.view');
      const { status } = args as { status?: string };
      const rows = await prisma.proposal.findMany({
        where: { companyId: identity.companyId, ...(status ? { status: status as never } : {}) },
        select: { id: true, title: true, status: true, clientName: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      return serialize(rows);
    },
  },

  // ════════════════════════════════════════════════════════════════
  // ESTIMATES
  // ════════════════════════════════════════════════════════════════
  {
    name: 'list_estimates',
    description: 'List estimates for a project. Returns id, name, version, status, grandTotal.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Project UUID' },
      },
      required: ['projectId'],
    },
    requires: 'estimate.view',
    handler: async (identity, args) => {
      guard(identity, 'estimate.view');
      const { projectId } = args as { projectId: string };
      const estimates = await prisma.estimate.findMany({
        where: { projectId, companyId: identity.companyId },
        select: { id: true, name: true, version: true, status: true, grandTotal: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      });
      return serialize(estimates);
    },
  },

  // ════════════════════════════════════════════════════════════════
  // BILLS
  // ════════════════════════════════════════════════════════════════
  {
    name: 'list_bills',
    description: 'List vendor bills. Returns id, vendorName, billNumber, category, status, total.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['PENDING', 'APPROVED', 'PAID', 'REJECTED'] },
        projectId: { type: 'string', description: 'Optional project UUID filter' },
      },
    },
    requires: 'bill.view',
    handler: async (identity, args) => {
      guard(identity, 'bill.view');
      const { status, projectId } = args as { status?: string; projectId?: string };
      const bills = await prisma.bill.findMany({
        where: {
          companyId: identity.companyId,
          ...(status ? { status: status as never } : {}),
          ...(projectId ? { projectId } : {}),
        },
        select: { id: true, vendorName: true, billNumber: true, category: true, status: true, total: true, billDate: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      return serialize(bills);
    },
  },
  {
    name: 'approve_bill',
    description: 'Approve a pending vendor bill. Requires bill id.',
    inputSchema: {
      type: 'object',
      properties: {
        billId: { type: 'string', description: 'Bill UUID to approve' },
      },
      required: ['billId'],
    },
    requires: 'bill.approve',
    handler: async (identity, args) => {
      guard(identity, 'bill.approve');
      const { billId } = args as { billId: string };
      const updated = await prisma.bill.updateMany({
        where: { id: billId, companyId: identity.companyId, status: 'PENDING' },
        data: { status: 'APPROVED', approvedBy: identity.userId },
      });
      if (updated.count === 0) throw new Error('Bill not found, already processed, or does not belong to your company');
      return { success: true, billId, newStatus: 'APPROVED' };
    },
  },

  // ════════════════════════════════════════════════════════════════
  // INVOICES
  // ════════════════════════════════════════════════════════════════
  {
    name: 'list_invoices',
    description: 'List client invoices. Returns id, invoiceNumber, clientName, status, total, dueDate.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['DRAFT', 'SENT', 'PAID', 'OVERDUE'] },
        projectId: { type: 'string', description: 'Optional project UUID filter' },
      },
    },
    requires: 'invoice.view',
    handler: async (identity, args) => {
      guard(identity, 'invoice.view');
      const { status, projectId } = args as { status?: string; projectId?: string };
      const invoices = await prisma.invoice.findMany({
        where: {
          companyId: identity.companyId,
          ...(status ? { status: status as never } : {}),
          ...(projectId ? { projectId } : {}),
        },
        select: { id: true, invoiceNumber: true, clientName: true, status: true, total: true, dueDate: true, invoiceDate: true },
        orderBy: { invoiceDate: 'desc' },
        take: 50,
      });
      return serialize(invoices);
    },
  },

  // ════════════════════════════════════════════════════════════════
  // BOQ
  // ════════════════════════════════════════════════════════════════
  {
    name: 'list_boq',
    description: 'List Bill of Quantities items for a project. Returns itemCode, description, unit, quantity, rate, amount, category.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Project UUID' },
        category: { type: 'string', description: 'Optional category filter' },
      },
      required: ['projectId'],
    },
    requires: 'boq.view',
    handler: async (identity, args) => {
      guard(identity, 'boq.view');
      const { projectId, category } = args as { projectId: string; category?: string };
      const items = await prisma.bOQItem.findMany({
        where: {
          projectId,
          project: { companyId: identity.companyId },
          ...(category ? { category } : {}),
          isSuperseded: false,
        },
        select: { id: true, itemCode: true, description: true, unit: true, quantity: true, rate: true, amount: true, category: true, executedQty: true },
        orderBy: { itemCode: 'asc' },
      });
      return serialize(items);
    },
  },
];

export { tools, PermissionDeniedError };