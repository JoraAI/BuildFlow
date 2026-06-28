/**
 * BuildFlow - Alerts when PO rates exceed planned material rates.
 */
import { RATE_VARIANCE_ALERT_PCT } from '@buildflow/shared';
import { prisma } from '../lib/prisma';
import { logger } from '../config/logger';
import { resolvePlannedMaterialRate } from './material-rate.service';
import { notifyMany } from './notification.service';

async function getProjectPmOwnerIds(companyId: string, projectId: string): Promise<string[]> {
  const members = await prisma.projectMember.findMany({
    where: { projectId, role: { in: ['OWNER', 'PM'] } },
    select: { userId: true },
  });
  if (members.length > 0) {
    return [...new Set(members.map((m) => m.userId))];
  }
  const users = await prisma.user.findMany({
    where: { companyId, role: { in: ['OWNER', 'PM'] }, isActive: true },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

export async function alertOnPurchaseOrderRateVariance(
  companyId: string,
  projectId: string,
  poId: string,
  poNumber: string,
  lines: Array<{ resourceId: string; rate: number }>,
): Promise<void> {
  try {
    const project = await prisma.project.findFirst({
      where: { id: projectId, companyId },
      select: { code: true },
    });
    if (!project) return;

    const recipients = await getProjectPmOwnerIds(companyId, projectId);
    if (recipients.length === 0) return;

    for (const line of lines) {
      const planned = await resolvePlannedMaterialRate(companyId, projectId, line.resourceId);
      if (planned.rate <= 0) continue;

      const threshold = planned.rate * (1 + RATE_VARIANCE_ALERT_PCT / 100);
      if (line.rate <= threshold) continue;

      const resource = await prisma.resource.findFirst({
        where: { id: line.resourceId, companyId },
        select: { name: true },
      });
      const variancePct = Math.round(((line.rate - planned.rate) / planned.rate) * 1000) / 10;

      await notifyMany(recipients, {
        companyId,
        title: 'PO rate over plan',
        body: `${resource?.name ?? 'Material'} on ${project.code} (${poNumber}): Rs ${line.rate} is +${variancePct}% vs planned Rs ${planned.rate}.`,
        type: 'MATERIAL_RATE_VARIANCE',
        referenceId: poId,
        channels: ['PUSH'],
      });
    }
  } catch (err) {
    logger.warn('alertOnPurchaseOrderRateVariance failed (non-fatal)', { error: String(err) });
  }
}
