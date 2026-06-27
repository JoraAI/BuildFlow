/**
 * BuildFlow — Analytics routes (OWNER only).
 */
import { Router } from 'express';
import { getDashboard } from '../controllers/analytics.controller';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/auth';

const router = Router();

router.get('/dashboard', authenticateToken, requireRole('OWNER'), getDashboard);

export default router;