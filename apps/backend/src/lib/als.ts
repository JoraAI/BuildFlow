/**
 * BuildFlow - AsyncLocalStorage for multi-tenant request context.
 *
 * The `companyContext` middleware sets { companyId, userId } per request.
 * Prisma middleware (lib/prisma.ts) reads `companyId` to auto-scope queries.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export interface CompanyContext {
  companyId: string;
  userId?: string;
}

export const companyALS = new AsyncLocalStorage<CompanyContext>();

/** Run a callback within a company context (used by middleware & jobs). */
export function runInCompanyContext<T>(
  ctx: CompanyContext,
  fn: () => Promise<T>,
): Promise<T> {
  return companyALS.run(ctx, fn);
}

/** Get the current company id (throws if not in a request context). */
export function getCompanyId(): string {
  const id = companyALS.getStore()?.companyId;
  if (!id) throw new Error('Company context not set');
  return id;
}