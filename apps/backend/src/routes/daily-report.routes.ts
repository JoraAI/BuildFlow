/**
 * BuildFlow — Daily Report routes.
 *
 * Project-scoped endpoints mounted at /api/projects/:id/reports
 * Report-level endpoints mounted at /api/reports/:id
 */
import { Router } from 'express';
import * as reportController from '../controllers/daily-report.controller';
import * as attendanceController from '../controllers/attendance.controller';
import { authenticateToken } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createDailyReportSchema,
  updateDailyReportSchema,
  projectIdReportDateParamsSchema,
  dailyReportIdParamsSchema,
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