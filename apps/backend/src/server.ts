/**
 * BuildFlow - HTTP server entry point.
 */
import { app } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { disconnectPrisma } from './lib/prisma';
import { disconnectRedis } from './lib/redis';
import { startSubscriptionCron } from './jobs/subscription.cron';
import { startNotificationWorker } from './jobs/notification.worker';
import { startInvoiceOverdueCron } from './jobs/invoice-overdue.cron';
import { startReportScheduleCron } from './jobs/report-schedule.cron';

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 BuildFlow API listening on http://localhost:${env.PORT}`, {
    env: env.NODE_ENV,
    port: env.PORT,
  });
  startSubscriptionCron();
  startNotificationWorker();
  startInvoiceOverdueCron();
  startReportScheduleCron();
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Received ${signal}, shutting down gracefully...`);
  await new Promise<void>((resolve) => {
    server.close(() => {
      logger.info('HTTP server closed');
      resolve();
    });
  });
  await Promise.allSettled([disconnectPrisma(), disconnectRedis()]);
  // Exit only for interactive stop (Ctrl+C). Under `tsx watch`, SIGTERM is used
  // for hot-reload — calling process.exit here can leave the watcher with no
  // child and nothing listening on :4000 (UI stays up; create-store then fails).
  if (signal === 'SIGINT') {
    process.exit(0);
  }
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  // In development, keep the process alive so `tsx watch` can recover on the
  // next change instead of leaving a dead watcher with no listener on :4000.
  if (env.NODE_ENV === 'production') {
    process.exit(1);
  }
});
