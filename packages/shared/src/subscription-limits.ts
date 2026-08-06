/**
 * BuildFlow - SaaS plan resource limits.
 *
 * Enforced on the backend (project.service.ts createProject, user invite)
 * and surfaced in the billing UI. `null` means unlimited.
 *
 * During TRIAL status, STARTER limits apply (per §2.20.3 SUB-PLAN1 spec).
 */
export const PLAN_LIMITS = {
  STARTER: { maxProjects: 3, maxUsers: 5 },
  PROFESSIONAL: { maxProjects: 25, maxUsers: 25 },
  ENTERPRISE: { maxProjects: null, maxUsers: null }, // unlimited
} as const;

export type PlanLimitKey = keyof typeof PLAN_LIMITS;

/**
 * Returns the effective limit for a given subscription plan.
 * ENTERPRISE returns null (unlimited) for both dimensions.
 */
export function getPlanLimit(plan: PlanLimitKey): { maxProjects: number | null; maxUsers: number | null } {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.STARTER;
}