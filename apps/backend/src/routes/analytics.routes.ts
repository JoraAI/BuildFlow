/**
 * BuildFlow - Analytics routes (OWNER only).
 */
import { Router } from 'express';
import { getDashboard } from '../controllers/analytics.controller';
import * as scheduleCtrl from '../controllers/report-schedule.controller';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createReportScheduleSchema } from '@buildflow/shared';

const router = Router();

router.use(authenticateToken, requireRole('OWNER'));

router.get('/dashboard', getDashboard);
router.get('/report-schedules', scheduleCtrl.listSchedules);
router.post('/report-schedules', validate({ body: createReportScheduleSchema }), scheduleCtrl.createSchedule);

export default router;