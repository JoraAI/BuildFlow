/**
 * BuildFlow - Notification routes (user notification center).
 */
import { Router } from 'express';
import * as ctrl from '../controllers/notification.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/', ctrl.list);
router.post('/read-all', ctrl.markAllRead);
router.post('/:id/read', ctrl.markRead);
router.put('/preferences', ctrl.updatePrefs);

export default router;