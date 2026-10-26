/**
 * Inventory activity trail — company audit log without Settings.audit permission.
 * Mounted at /api/inventory/activity
 */
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireInventoryFeature } from '../middleware/module-gate';
import { validate } from '../middleware/validate';
import { auditQuerySchema } from '@buildflow/shared';
import { listAuditLogs } from '../services/settings.service';
import { prisma } from '../lib/prisma';
import { ok, okList } from '../utils/response';

export const inventoryActivityRouter = Router();
inventoryActivityRouter.use(authenticateToken);
inventoryActivityRouter.use(requireInventoryFeature('cash_book'));

inventoryActivityRouter.get('/people', async (req, res, next) => {
  try {
    const people = await prisma.user.findMany({
      where: { companyId: req.user!.companyId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return ok(res, people);
  } catch (err) {
    next(err);
  }
});

inventoryActivityRouter.get('/', validate({ query: auditQuerySchema }), async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const userId = req.query.userId ? String(req.query.userId) : undefined;
    const entityType = req.query.entityType ? String(req.query.entityType) : undefined;
    const action = req.query.action ? String(req.query.action) : undefined;
    const q = req.query.q ? String(req.query.q) : undefined;
    const { rows, total } = await listAuditLogs(req.user!.companyId, {
      page,
      limit,
      userId,
      entityType,
      action,
      q,
    });
    return okList(res, rows, { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});
