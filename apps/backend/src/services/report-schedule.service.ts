import { prisma } from '../lib/prisma';
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

/** Called by notification worker cron — marks schedules as run (email when Twilio configured). */
export async function runDueReportSchedules(): Promise<number> {
  const schedules = await prisma.reportSchedule.findMany({ where: { isActive: true } });
  const now = new Date();
  for (const s of schedules) {
    await prisma.reportSchedule.update({
      where: { id: s.id },
      data: { lastRunAt: now },
    });
  }
  return schedules.length;
}
