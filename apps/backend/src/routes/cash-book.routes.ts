/**
 * Inventory cash book routes — all inventory verticals.
 * Mounted at /api/inventory/cash-book
 */
import { Router, NextFunction, Request, Response } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { requireInventoryFeature } from '../middleware/module-gate';
import { Role, createCashBookEntrySchema, cashBookDayQuerySchema } from '@buildflow/shared';
import * as cashBookSvc from '../services/cash-book.service';

export const cashBookRouter = Router();
cashBookRouter.use(authenticateToken);
cashBookRouter.use(requireInventoryFeature('cash_book'));

function companyId(req: Request) {
  return req.user!.companyId;
}
function userId(req: Request) {
  return req.user!.id;
}

cashBookRouter.get('/', validate({ query: cashBookDayQuerySchema }), async (req, res, next) => {
  try {
    const date = String(req.query.date);
    res.json({ success: true, data: await cashBookSvc.listCashBookDay(companyId(req), date) });
  } catch (err) {
    next(err);
  }
});

cashBookRouter.get(
  '/daily-sales-summary',
  validate({ query: cashBookDayQuerySchema }),
  async (req, res, next) => {
    try {
      const date = String(req.query.date);
      res.json({
        success: true,
        data: await cashBookSvc.getDailySalesSummary(companyId(req), date),
      });
    } catch (err) {
      next(err);
    }
  },
);

cashBookRouter.post(
  '/',
  requireRole(Role.OWNER, Role.INVENTORY_MANAGER),
  validate({ body: createCashBookEntrySchema }),
  async (req, res, next) => {
    try {
      res.status(201).json({
        success: true,
        data: await cashBookSvc.createCashBookEntry(companyId(req), userId(req), req.body),
      });
    } catch (err) {
      next(err);
    }
  },
);

cashBookRouter.delete(
  '/:id',
  requireRole(Role.OWNER, Role.INVENTORY_MANAGER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await cashBookSvc.deleteCashBookEntry(companyId(req), req.params.id),
      });
    } catch (err) {
      next(err);
    }
  },
);
