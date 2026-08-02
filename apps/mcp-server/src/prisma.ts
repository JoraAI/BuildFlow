/**
 * BuildFlow MCP Server - Prisma client with tenant-scoping middleware.
 *
 * FIX (SEC-H6): Previously had no tenant-scoping layer, relying entirely on
 * each tool hand-writing `companyId`. Now mirrors the backend: an
 * AsyncLocalStorage carries the resolved `companyId` for the active session,
 * and a Prisma `$use` middleware auto-injects it into reads AND writes on
 * tenant-scoped models.
 */
import { PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'async_hooks';

export interface CompanyStore {
  companyId: string;
}

export const companyALS = new AsyncLocalStorage<CompanyStore>();

/**
 * Tenant-scoped models — must match the backend's list. Any model with a
 * direct `companyId` column that is owned by a single tenant.
 *
 * FIX (NR-15): Removed models that do NOT have a direct `companyId` column.
 * Scoping them would inject a nonexistent `companyId` filter and throw
 * `PrismaClientValidationError` for any tool touching them. The removed models
 * are tenant-isolated via a parent relation (e.g. StockBalance →
 * StockLocation.companyId, ProjectMaterialRate → Project.companyId, etc.) and
 * must be scoped explicitly in the tool by filtering on that parent.
 */
const TENANT_SCOPED_MODELS = new Set([
  'User',
  'UserInvite',
  'Project',
  'Proposal',
  'Resource',
  'Estimate',
  'RateAnalysis',
  'MaterialPriceHistory',
  'RateRegion',
  'Invoice',
  'Bill',
  'JournalEntry',
  'ChatMessage',
  'AuditLog',
  'CompanyIntegration',
  'CompanyRolePermission',
  'SupportTicket',
  'ChangeOrder',
  'MaterialRequisition',
  'PurchaseOrder',
  'GoodsReceiptNote',
  'StockLocation',
  'Subcontractor',
  'ReportSchedule',
  'DocumentCounter',
  // FIX (§2.2C / NR-43): Phase 5 models — list MUST match backend lib/prisma.ts.
  'PunchItem',
  'RFI',
  'Submittal',
  'Drawing',
  'PettyCashEntry',
  'SubcontractWorkOrder',
]);

// FIX (SEC-C2): include the *OrThrow read variants so they are scoped too.
const READ_ACTIONS = new Set([
  'findUnique',
  'findFirst',
  'findMany',
  'findUniqueOrThrow',
  'findFirstOrThrow',
  'count',
  'aggregate',
  'groupBy',
]);

const WHERE_WRITE_ACTIONS = new Set(['update', 'updateMany', 'delete', 'deleteMany']);

function createClient(): PrismaClient {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

  client.$use(async (params, next) => {
    const store = companyALS.getStore();
    const model = params.model ?? '';

    if (!store?.companyId || !TENANT_SCOPED_MODELS.has(model)) {
      return next(params);
    }

    const companyId = store.companyId;
    const args = (params.args ??= {});

    if (READ_ACTIONS.has(params.action)) {
      args.where = { ...args.where, companyId };
    } else if (WHERE_WRITE_ACTIONS.has(params.action)) {
      args.where = { ...args.where, companyId };
    } else if (params.action === 'create') {
      if (args.data && typeof args.data === 'object') {
        if (!('companyId' in args.data) || args.data.companyId === undefined) {
          args.data.companyId = companyId;
        }
      }
    } else if (params.action === 'createMany') {
      if (Array.isArray(args.data)) {
        args.data = args.data.map((row: Record<string, unknown>) =>
          row && (!('companyId' in row) || row.companyId === undefined)
            ? { ...row, companyId }
            : row,
        );
      }
    } else if (params.action === 'upsert') {
      args.where = { ...args.where, companyId };
      if (args.create && typeof args.create === 'object' && !('companyId' in args.create)) {
        args.create.companyId = companyId;
      }
    }

    return next(params);
  });

  return client;
}

const globalForPrisma = globalThis as unknown as { __mcpPrisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.__mcpPrisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__mcpPrisma = prisma;
}