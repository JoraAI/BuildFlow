-- FIX (NR-18/DAT-4.5): The schema comments on tasks.progress_pct and
-- daily_report_task_updates.progress_pct claimed "0–100 enforced via DB CHECK
-- constraint" but no such constraint existed. This adds the real constraints so
-- the comments are truthful and out-of-range progress is rejected at the DB
-- layer (defense in depth alongside the Zod validators).
ALTER TABLE "tasks"
  ADD CONSTRAINT tasks_progress_pct_check CHECK (progress_pct >= 0 AND progress_pct <= 100);

ALTER TABLE "daily_report_task_updates"
  ADD CONSTRAINT drtu_progress_pct_check CHECK (progress_pct >= 0 AND progress_pct <= 100);