/**
 * BuildFlow - Inventory stock controller (INVENTORY_HORIZONTAL_PLATFORM Phase 1.3/1.4).
 * Stock adjustments + opening stock import — company-scoped (uses the STORE project).
 */
import { NextFunction, Request, Response } from 'express';
import { adjustStock, importOpeningStock } from '../services/procurement.service';
import { created } from '../utils/response';
import { recordAudit } from '../utils/audit';

export async function adjust(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId, role } = req.user!;
    const data = await adjustStock(companyId, userId, role, req.body);
    await recordAudit({
      companyId,
      userId,
      action: 'CREATE',
      entityType: 'StockMovement',
      entityId: data.movementId,
      newValue: { type: 'ADJUST', resourceId: data.resourceId, delta: data.delta, reason: data.reason, notes: data.notes },
      ipAddress: req.ip,
    });
    created(res, data);
  } catch (err) {
    next(err);
  }
}

export async function importOpening(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId, role } = req.user!;
    const data = await importOpeningStock(companyId, userId, role, req.body);
    await recordAudit({
      companyId,
      userId,
      action: 'CREATE',
      entityType: 'StockMovement',
      entityId: `opening-${Date.now()}`,
      newValue: { applied: data.applied, missed: data.missed },
      ipAddress: req.ip,
    });
    created(res, data);
  } catch (err) {
    next(err);
  }
}
