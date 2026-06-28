/**
 * BuildFlow — Auth routes.
 *
 *   POST /api/auth/register   (authLimiter) — company + owner setup
 *   POST /api/auth/login      (authLimiter)
 *   POST /api/auth/refresh    (authLimiter)
 *   POST /api/auth/logout     (authenticate)
 *   GET  /api/auth/me         (authenticate)
 */
import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import {
  registerCompanySchema,
  loginSchema,
  refreshSchema,
  acceptInviteSchema,
} from '@buildflow/shared';

export const authRouter = Router();

authRouter.get('/config', authController.config);
authRouter.get('/invite/:token', authLimiter, authController.getInvitePreview);
authRouter.post(
  '/accept-invite',
  authLimiter,
  validate({ body: acceptInviteSchema }),
  authController.acceptInvite,
);
authRouter.post('/register', authLimiter, validate({ body: registerCompanySchema }), authController.register);
authRouter.post('/login', authLimiter, validate({ body: loginSchema }), authController.login);
authRouter.post('/refresh', authLimiter, validate({ body: refreshSchema }), authController.refresh);
authRouter.post('/logout', authenticateToken, authController.logout);
authRouter.get('/me', authenticateToken, authController.me);