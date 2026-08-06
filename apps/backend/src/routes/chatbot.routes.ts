/**
 * BuildFlow - Chatbot routes.
 */
import { Router } from 'express';
import * as ctrl from '../controllers/chatbot.controller';
import { authenticateToken } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { publicChatMessageSchema, sendMessageSchema } from '@buildflow/shared';

const router = Router();

/** Pre-login product guide — no auth, no tenant data. */
router.post('/public/message', validate({ body: publicChatMessageSchema }), ctrl.publicMessage);

router.use(authenticateToken);

router.post('/message', validate({ body: sendMessageSchema }), ctrl.message);
router.get('/history', ctrl.history);

export default router;
