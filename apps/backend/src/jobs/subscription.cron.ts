/**
 * Daily subscription / trial reminder job.
 */
import { runSubscriptionCron } from '../services/subscription.service';
import { logger } from '../config/logger';

const DAY_MS = 24 * 60 * 60 * 1000;

export function startSubscriptionCron(): void {
  const run = () => {
    runSubscriptionCron().catch((err) => {
      logger.error('Subscription cron failed', { error: String(err) });
    });
  };

  // Initial run after startup (1 min delay for DB readiness)
  setTimeout(run, 60_000);
  setInterval(run, DAY_MS);
  logger.info('Subscription cron scheduled (daily)');
}
