/**
 * BuildFlow — HTTP server entry point.
 */
import { app } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { disconnectPrisma } from './lib/prisma';
import { disconnectRedis } from './lib/redis';
import { startSubscriptionCron } from './jobs/subscription.cron';
import { startNotificationWorker } from './jobs/notification.worker';

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 BuildFlow API listening on http://localhost:${env.PORT}`, {
    env: env.NODE_ENV,
    port: env.PORT,
  });
  startSubscriptionCron();
  startNotificationWorker();
});

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  server.close(() => logger.info('HTTP server closed'));
  await Promise.allSettled([disconnectPrisma(), disconnectRedis()]);
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});