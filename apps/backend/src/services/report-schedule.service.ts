/**
 * BuildFlow - Report schedule service.
 *
 * Manages scheduled report configs and executes due schedules by notifying
 * recipients that their report is ready (in-app). PDF/email delivery can be
 * layered on when transport is configured.
 */
import { prisma } from '../lib/prisma';
import { logger } from '../config/logger';
import { notify } from './notification.service';
import type { CreateReportScheduleInput } from '@buildflow/shared';

export async function listReportSchedules(companyId: string) {
  return prisma.reportSchedule.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createReportSchedule(companyId: string, input: CreateReportScheduleInput) {
  return prisma.reportSchedule.create({
    data: {
      companyId,
      reportType: input.reportType,
      cronExpr: input.cronExpr,
      recipients: input.recipients,
    },
  });
}

/**
 * Process due report schedules. Runs each active schedule at most once per day
 * (heuristic), updates lastRunAt, and notifies recipient users in-app.
 */
export async function runDueReportSchedules(): Promise<number> {
  const schedules = await prisma.reportSchedule.findMany({ where: { isActive: true } });
  const now = new Date();
  let processed = 0;

  for (const s of schedules) {
    const shouldRun = !s.lastRunAt || now.getTime() - s.lastRunAt.getTime() > 23 * 60 * 60 * 1000;
    if (!shouldRun) continue;

    await prisma.reportSchedule.update({
      where: { id: s.id },
      data: { lastRunAt: now },
    });
    processed += 1;

    try {
      const recipientUsers = await prisma.user.findMany({
        where: { email: { in: s.recipients }, isActive: true },
        select: { id: true },
      });
      await Promise.all(
        recipientUsers.map((u) =>
          notify({
            userId: u.id,
            companyId: s.companyId,
            title: 'Scheduled report ready',
            body: 'Your scheduled ' + s.reportType + ' report is ready. Open the Reports hub to download.',
            type: 'REPORT_SCHEDULE',
            referenceId: s.id,
          }),
        ),
      );
    } catch (err) {
      logger.warn('Scheduled report notification failed (non-fatal)', {
        scheduleId: s.id,
        error: String(err),
      });
    }
  }

  if (processed > 0) {
    logger.info('Report schedule worker processed ' + processed + ' schedule(s)');
  }

  return processed;
}