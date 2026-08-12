/**
 * BuildFlow - Daily Report routes.
 *
 * Project-scoped endpoints mounted at /api/projects/:id/reports
 * Report-level endpoints mounted at /api/reports/:id
 */
import { Router } from 'express';
import * as reportController from '../controllers/daily-report.controller';
import * as attendanceController from '../controllers/attendance.controller';
import { authenticateToken } from '../middleware/auth';
import { requireModule, requireModuleForPaths } from '../middleware/module-gate';
import { validate } from '../middleware/validate';
import {
  createDailyReportSchema,
  updateDailyReportSchema,
  projectIdReportDateParamsSchema,
  dailyReportIdParamsSchema,
  materialUsageIdParamsSchema,
  reportListQuerySchema,
  photoUploadSchema,
  confirmPhotoUploadSchema,
  checkInSchema,
  attendanceQuerySchema,
} from '@buildflow/shared';

/* ------------------------------------------------------------------ */
/* Project-scoped routes: /api/projects/:id/...                         */
/* ------------------------------------------------------------------ */
export const reportRouter = Router();
reportRouter.use(authenticateToken);
// Mounted at /api/projects - path-aware so only reports/checkin/attendance are gated.
reportRouter.use(
  requireModuleForPaths('reports_ops', [
    /^\/[^/]+\/reports\b/,
    /^\/[^/]+\/checkin\b/,
    /^\/[^/]+\/attendance\b/,
  ]),
);

// Reports
reportRouter.get(
  '/:id/reports',
  validate({ params: projectIdReportDateParamsSchema, query: reportListQuerySchema }),
  reportController.listReports,
);
reportRouter.get('/:id/reports/calendar', reportController.getReportCalendar);
reportRouter.post(
  '/:id/reports',
  validate({ params: projectIdReportDateParamsSchema, body: createDailyReportSchema }),
  reportController.createReport,
);

// Attendance / geo-fence
reportRouter.post(
  '/:id/checkin',
  validate({ params: projectIdReportDateParamsSchema, body: checkInSchema }),
  attendanceController.checkIn,
);
reportRouter.post(
  '/:id/checkout',
  validate({ params: projectIdReportDateParamsSchema }),
  attendanceController.checkOut,
);
reportRouter.get(
  '/:id/attendance',
  validate({ params: projectIdReportDateParamsSchema, query: attendanceQuerySchema }),
  attendanceController.listAttendance,
);

/* ------------------------------------------------------------------ */
/* Report-level routes: /api/reports/:id/...                            */
/* ------------------------------------------------------------------ */
export const reportDetailRouter = Router();
reportDetailRouter.use(authenticateToken);
reportDetailRouter.use(requireModule('reports_ops'));

reportDetailRouter.get('/:id', validate({ params: dailyReportIdParamsSchema }), reportController.getReport);
reportDetailRouter.put(
  '/:id',
  validate({ params: dailyReportIdParamsSchema, body: updateDailyReportSchema }),
  reportController.updateReport,
);
reportDetailRouter.post(
  '/:id/photos',
  validate({ params: dailyReportIdParamsSchema, body: photoUploadSchema }),
  reportController.createPhotoUploadUrl,
);
reportDetailRouter.post(
  '/:id/photos/confirm',
  validate({ params: dailyReportIdParamsSchema, body: confirmPhotoUploadSchema }),
  reportController.confirmPhotoUpload,
);
reportDetailRouter.get('/:id/photos/urls', reportController.resolvePhotos);
reportDetailRouter.post(
  '/material-usages/:usageId/post-boq-measurement',
  validate({ params: materialUsageIdParamsSchema }),
  reportController.postMaterialUsageToBoq,
);