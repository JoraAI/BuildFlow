/**
 * BuildFlow - Inventory stock controller (INVENTORY_HORIZONTAL_PLATFORM Phase 1.3/1.4).
 * Stock adjustments + opening stock import - company-scoped (uses the STORE project).
 */
import { NextFunction, Request, Response } from 'express';
import { adjustStock, importOpeningStock, quickVendorReceipt } from '../services/procurement.service';
import { listResourceBatches, expirySummary, updateBatchMetadata } from '../services/stock-batch.service';
import { created, ok } from '../utils/response';
import { recordAudit } from '../utils/audit';
import { ApiError } from '../utils/errors';

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

export async function receiveQuick(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId, role } = req.user!;
    const data = await quickVendorReceipt(companyId, userId, role, req.body);
    await recordAudit({
      companyId,
      userId,
      action: 'CREATE',
      entityType: 'quick_vendor_receipt',
      entityId: `receipt-${Date.now()}`,
      newValue: {
        vendorName: data.vendorName,
        invoiceNumber: data.invoiceNumber,
        lines: data.received,
      },
      ipAddress: req.ip,
    });
    created(res, data);
  } catch (err) {
    next(err);
  }
}

/**
 * INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.2): per-item lot list + expiry
 * buckets (Kirana-vertical only - route-level `batch_expiry` gate).
 */
export async function batches(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId } = req.user!;
    const { resourceId, locationId } = req.query as { resourceId?: string; locationId?: string };
    if (!resourceId) throw ApiError.badRequest('resourceId is required');
    const rows = await listResourceBatches(companyId, resourceId, locationId);
    ok(res, rows);
  } catch (err) {
    next(err);
  }
}

export async function expiryBuckets(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId } = req.user!;
    const summary = await expirySummary(companyId);
    ok(res, summary);
  } catch (err) {
    next(err);
  }
}

export async function updateBatch(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId } = req.user!;
    const updated = await updateBatchMetadata(companyId, req.params.id, req.body);
    await recordAudit({
      companyId,
      userId,
      action: 'UPDATE',
      entityType: 'stock_batch_metadata',
      entityId: updated.id,
      newValue: {
        manufacturedAt: updated.manufacturedAt,
        expiresAt: updated.expiresAt,
      },
      ipAddress: req.ip,
    });
    ok(res, updated);
  } catch (err) {
    next(err);
  }
}
