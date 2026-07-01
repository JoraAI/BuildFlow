/**
 * Daily report schedule worker.
 *
 * Processes due ReportSchedule rows, notifying recipients that their scheduled
 * report (GST summary, TDS, dashboard, project P&L) is ready.
 */
import { runDueReportSchedules } from '../services/report-schedule.service';
import { logger } from '../config/logger';

const DAY_MS = 24 * 60 * 60 * 1000;

export function startReportScheduleCron(): void {
  const run = () => {
    runDueReportSchedules().catch((err) => {
      logger.error('Report schedule cron failed', { error: String(err) });
    });
  };

  // Initial run after startup (3 min delay for DB readiness)
  setTimeout(run, 180_000);
  setInterval(run, DAY_MS);
  logger.info('Report schedule cron scheduled (daily)');
}