/**
 * BuildFlow — Chatbot routes.
 */
import { Router } from 'express';
import * as ctrl from '../controllers/chatbot.controller';
import { authenticateToken } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { sendMessageSchema } from '@buildflow/shared';

const router = Router();

router.use(authenticateToken);

router.post('/message', validate({ body: sendMessageSchema }), ctrl.message);
router.get('/history', ctrl.history);

export default router;