/**
 * BuildFlow — Notification queue worker (WhatsApp / SMS / push).
 */
import { getQueue } from '../lib/queue';
import { sendWhatsApp, sendSMS, sendPush } from '../services/twilio.service';
import { logger } from '../config/logger';

export function startNotificationWorker(): void {
  const queue = getQueue('notification');

  queue.process('whatsapp', async (job) => {
    const { companyId, to, message } = job.data as { companyId: string; to: string; message: string };
    await sendWhatsApp(companyId, to, message);
  });

  queue.process('sms', async (job) => {
    const { companyId, to, message } = job.data as { companyId: string; to: string; message: string };
    await sendSMS(companyId, to, message);
  });

  queue.process('push', async (job) => {
    const { userId, title, body } = job.data as { userId: string; title: string; body: string };
    await sendPush(userId, title, body);
  });

  queue.process('report-schedule', async () => {
    const { runDueReportSchedules } = await import('../services/report-schedule.service');
    const count = await runDueReportSchedules();
    logger.info('Report schedules processed', { count });
  });

  queue.on('failed', (job, err) => {
    logger.warn('Notification job failed', { job: job?.name, error: err.message });
  });

  logger.info('Notification worker started');
}
