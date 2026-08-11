/**
 * BuildFlow - Subscription plan limit enforcement.
 *
 * Enforces PLAN_LIMITS from @buildflow/shared on project creation and user invites.
 * During TRIAL, STARTER limits apply (per §2.20.3 SUB-PLAN1 spec), EXCEPT for
 * the INVENTORY plan (INVENTORY_PRODUCT) which always keeps its own limits
 * (1 project / 10 users) so a trial inventory tenant can never spin up extra
 * construction projects.
 */
import { prisma } from '../lib/prisma';
import { getPlanLimit, type PlanLimitKey } from '@buildflow/shared';
import { ApiError } from '../utils/errors';

/** Resolve the effective limit key for a company (INVENTORY never falls back to STARTER). */
async function effectivePlanKey(companyId: string): Promise<{ planKey: PlanLimitKey; plan: string }> {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { subscriptionPlan: true, subscriptionStatus: true },
  });
  const plan = company.subscriptionPlan;
  if (plan === 'INVENTORY') return { planKey: 'INVENTORY', plan };
  const planKey: PlanLimitKey =
    company.subscriptionStatus === 'TRIAL' ? 'STARTER' : (plan as PlanLimitKey);
  return { planKey, plan };
}

/**
 * Assert that the company's plan allows creating a new project.
 * Throws ApiError (402) if the project limit is reached.
 */
export async function assertPlanAllowsProject(companyId: string): Promise<void> {
  const { planKey, plan } = await effectivePlanKey(companyId);

  const limit = getPlanLimit(planKey);
  if (limit.maxProjects === null) return; // unlimited

  const projectCount = await prisma.project.count({
    where: { companyId, isDeleted: false },
  });

  if (projectCount >= limit.maxProjects) {
    throw new ApiError(
      'PAYMENT_REQUIRED',
      plan === 'INVENTORY'
        ? `Inventory plan includes one store; upgrade to a construction plan (Starter/Professional) for multi-project construction.`
        : `Your ${planKey} plan allows up to ${limit.maxProjects} projects. ` +
            `You currently have ${projectCount}. Upgrade your plan to create more projects.`,
    );
  }
}

/**
 * Assert that the company's plan allows inviting a new user.
 * Throws ApiError (402) if the user limit is reached.
 */
export async function assertPlanAllowsUser(companyId: string): Promise<void> {
  const { planKey } = await effectivePlanKey(companyId);

  const limit = getPlanLimit(planKey);
  if (limit.maxUsers === null) return; // unlimited

  const userCount = await prisma.user.count({
    where: { companyId, isActive: true },
  });

  if (userCount >= limit.maxUsers) {
    throw new ApiError(
      'PAYMENT_REQUIRED',
      `Your ${planKey} plan allows up to ${limit.maxUsers} users. ` +
        `You currently have ${userCount}. Upgrade your plan to invite more users.`,
    );
  }
}