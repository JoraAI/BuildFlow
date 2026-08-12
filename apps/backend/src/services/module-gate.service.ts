/**
 * BuildFlow - Product module gate.
 *
 * INVENTORY_PRODUCT: inventory tenants are restricted to the inventory shell
 * modules (stock, procurement, invoices, bills, tally, assistant, settings).
 * Construction-only routes (estimates, proposals, planning, reports, subcontracts,
 * change orders, extra projects) must return 403 for INVENTORY companies.
 *
 * Construction plans (STARTER / PROFESSIONAL / ENTERPRISE) are never blocked.
 */
import { prisma } from '../lib/prisma';
import {
  hasInventoryFeature,
  isModuleEnabled,
  type AppModule,
  type InventoryFeatureFlag,
  type SubscriptionPlanKey,
} from '@buildflow/shared';
import { ApiError } from '../utils/errors';

/**
 * Assert the company's plan enables the given module.
 * Throws ApiError (403) when the module is disabled for the plan.
 */
export async function assertModuleEnabled(
  companyId: string,
  module: AppModule,
): Promise<void> {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { subscriptionPlan: true },
  });
  if (!isModuleEnabled(company.subscriptionPlan, module)) {
    throw new ApiError(
      'FORBIDDEN',
      `This feature is not included in your ${company.subscriptionPlan} plan. ` +
        `Upgrade to a construction plan to use ${module.replace(/_/g, ' ')}.`,
    );
  }
}

/**
 * INVENTORY_HORIZONTAL_PLATFORM: assert a phase-gated inventory feature is
 * enabled for the company's plan (see `hasInventoryFeature`). Throws 403 when
 * the feature has not shipped for the plan (construction always blocked).
 */
export async function assertInventoryFeature(
  companyId: string,
  flag: InventoryFeatureFlag,
): Promise<void> {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { subscriptionPlan: true },
  });
  const plan = company.subscriptionPlan as SubscriptionPlanKey;
  if (!hasInventoryFeature(plan, flag)) {
    throw new ApiError(
      'FORBIDDEN',
      `This inventory feature is not available on your ${plan} plan yet.`,
    );
  }
}

/**
 * Resolve the default project id for an inventory company (null for construction).
 * Used by inventory endpoints to auto-scope requests to the STORE project.
 */
export async function getDefaultProjectId(
  companyId: string,
): Promise<string | null> {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { subscriptionPlan: true, defaultProjectId: true },
  });
  if (company.subscriptionPlan !== 'INVENTORY') return null;
  return company.defaultProjectId;
}
