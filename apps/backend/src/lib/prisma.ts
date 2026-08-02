/**
 * BuildFlow - Prisma client singleton with multi-tenant scoping middleware.
 *
 * The company_id scoping uses AsyncLocalStorage. The `companyContext` middleware
 * (see middleware/company.ts) sets the store per request; this extension auto-
 * injects company_id into BOTH reads AND writes for tenant-scoped models, so
 * that a request authenticated as company A can never read or mutate company B's
 * rows (SEC-C2).
 *
 * IMPORTANT: auto-scoping only activates when `companyALS` has a store set
 * (i.e. inside an authenticated request). Background jobs, seeds, scripts, and
 * platform-admin flows that do not set the store are unaffected.
 */
import { PrismaClient } from '@prisma/client';
import { companyALS } from './als';
import { logger } from '../config/logger';

/**
 * Every Prisma model that carries a direct `companyId` column and is owned by a
 * single tenant. Adding a model here guarantees its reads and writes are scoped.
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
  // FIX: RegionalMaterialRate has no companyId column — scoped via regionId
  // FIX: ProjectMaterialRate has no companyId column — scoped via projectId
  'Invoice',
  'Bill',
  'JournalEntry',
  'ChatMessage',
  // FIX: Notification, StockBalance, StockMovement have no companyId column.
  // Notifications are scoped via userId; stock via StockLocation.companyId.
  'AuditLog',
  'CompanyIntegration',
  'CompanyRolePermission',
  'SupportTicket',
  // FIX: ProjectMember has no companyId column — scoped via projectId+userId
  'ChangeOrder',
  'MaterialRequisition',
  'PurchaseOrder',
  'GoodsReceiptNote',
  'StockLocation',
  'Subcontractor',
  'ReportSchedule',
  // FIX (§2.2C / NR-43): Phase 5 tenant-scoped models. SubcontractWorkOrder
  // gained a direct companyId column via migration 20260731080000.
  'PunchItem',
  'RFI',
  'Submittal',
  'Drawing',
  'PettyCashEntry',
  'SubcontractWorkOrder',
  'DocumentCounter',
]);

// FIX (SEC-C2): include the *OrThrow read variants so they are scoped too.
// Without these, `findUniqueOrThrow({ where: { id } })` could read a row from
// another tenant.
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

/** Write actions that filter via `where` (update/delete) — inject companyId there. */
const WHERE_WRITE_ACTIONS = new Set(['update', 'updateMany', 'delete', 'deleteMany']);

const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

function createPrisma(): PrismaClient {
  const client = new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
  });

  client.$use(async (params, next) => {
    const store = companyALS.getStore();
    const model = params.model ?? '';

    // Only auto-scope when a request context is active AND model is tenant-scoped.
    if (!store?.companyId || !TENANT_SCOPED_MODELS.has(model)) {
      return next(params);
    }

    const companyId = store.companyId;
    const args = (params.args ??= {});

    try {
      if (READ_ACTIONS.has(params.action)) {
        // Reads: merge companyId into the where filter.
        args.where = { ...args.where, companyId };
      } else if (WHERE_WRITE_ACTIONS.has(params.action)) {
        // Writes by-condition (update/updateMany/delete/deleteMany): require the
        // row to belong to the authenticated company.
        args.where = { ...args.where, companyId };
      } else if (params.action === 'create') {
        // Creates: stamp the owning company if not explicitly provided.
        if (args.data && typeof args.data === 'object') {
          if (!('companyId' in args.data) || args.data.companyId === undefined) {
            args.data.companyId = companyId;
          }
        }
      } else if (params.action === 'createMany') {
        // createMany uses `data` as an array; stamp each row.
        if (Array.isArray(args.data)) {
          args.data = args.data.map((row: Record<string, unknown>) =>
            row && (!('companyId' in row) || row.companyId === undefined)
              ? { ...row, companyId }
              : row,
          );
        }
      } else if (params.action === 'upsert') {
        // upsert: scope the where + ensure create carries companyId.
        args.where = { ...args.where, companyId };
        if (args.create && typeof args.create === 'object' && !('companyId' in args.create)) {
          args.create.companyId = companyId;
        }
      }
    } catch (err) {
      // If scoping fails for any reason, fail CLOSED — do not run unscoped.
      logger.error('Tenant scoping middleware failed (failing closed)', {
        model,
        action: params.action,
        error: String(err),
      });
      throw err;
    }

    return next(params);
  });

  return client;
}

export const prisma = globalForPrisma.__prisma ?? createPrisma();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma = prisma;
}

export async function disconnectPrisma(): Promise<void> {
  try {
    await prisma.$disconnect();
  } catch (err) {
    logger.error('Prisma disconnect failed', { error: String(err) });
  }
}