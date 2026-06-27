/**
 * BuildFlow — Prisma client singleton with multi-tenant scoping middleware.
 *
 * The company_id scoping uses AsyncLocalStorage. The `companyContext` middleware
 * (see middleware/company.ts) sets the store per request; this extension auto-
 * injects company_id into findMany/findFirst/count/aggregate for tenant models.
 */
import { PrismaClient } from '@prisma/client';
import { companyALS } from './als';
import { logger } from '../config/logger';

const TENANT_SCOPED_MODELS = new Set([
  'User',
  'Project',
  'Resource',
  'RateAnalysis',
  'MaterialPriceHistory',
  'Invoice',
  'Bill',
  'JournalEntry',
  'ChatMessage',
  'AuditLog',
  'Estimate',
]);

const READ_ACTIONS = new Set(['findMany', 'findFirst', 'count', 'aggregate', 'groupBy']);

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
    // Only auto-scope when a request context is active AND model is tenant-scoped.
    if (store?.companyId && TENANT_SCOPED_MODELS.has(params.model ?? '') && READ_ACTIONS.has(params.action)) {
      const args = (params.args ??= {});
      args.where = { ...args.where, companyId: store.companyId };
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