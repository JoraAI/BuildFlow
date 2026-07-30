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
  'RegionalMaterialRate',
  'ProjectMaterialRate',
  'Invoice',
  'Bill',
  'JournalEntry',
  'ChatMessage',
  'Notification',
  'AuditLog',
  'CompanyIntegration',
  'CompanyRolePermission',
  'SupportTicket',
  'ProjectMember',
  'ChangeOrder',
  'MaterialRequisition',
  'PurchaseOrder',
  'GoodsReceiptNote',
  'StockLocation',
  'StockBalance',
  'StockMovement',
  'Subcontractor',
  'ReportSchedule',
]);

const READ_ACTIONS = new Set([
  'findUnique',
  'findFirst',
  'findMany',
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