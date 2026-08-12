/**
 * BuildFlow - Inventory AI controller (INVENTORY_HORIZONTAL_PLATFORM Phase 7).
 *
 * 7.1 Document OCR → draft bill (extract + create-from-draft).
 * 7.2 AI import column mapping (preview + confirm).
 * 7.3 Anomaly hints (dashboard strip).
 *
 * Company-scoped - the default STORE project is resolved server-side.
 */
import { NextFunction, Request, Response } from 'express';
import {
  extractInvoiceDraft,
  createBillFromDraft,
  previewImportMapping,
  confirmImport,
  getAnomalyHints,
} from '../services/inventory-ai.service';
import { notifyOverdueInvoices } from '../services/inventory-alerts.service';
import { ok, created } from '../utils/response';
import { recordAudit } from '../utils/audit';

export async function extract(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId, role } = req.user!;
    const result = await extractInvoiceDraft(companyId, userId, role, req.body);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function createFromDraft(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId, role } = req.user!;
    const result = await createBillFromDraft(companyId, userId, role, req.body);
    await recordAudit({
      companyId,
      userId,
      action: 'CREATE',
      entityType: 'Bill',
      entityId: result.bill.id,
      newValue: {
        source: 'AI_EXTRACT',
        billNumber: result.bill.billNumber,
        vendorName: result.bill.vendorName,
        total: Number(result.bill.total),
        linkedVendor: result.linkedVendor,
        linkedPO: result.linkedPO,
        linkedGRN: result.linkedGRN,
      },
      ipAddress: req.ip,
    });
    created(res, { bill: result.bill });
  } catch (err) {
    next(err);
  }
}

export async function previewImport(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId } = req.user!;
    const result = await previewImportMapping(companyId, req.body);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function confirmImportAI(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId, role } = req.user!;
    const result = await confirmImport(companyId, userId, role, req.body);
    await recordAudit({
      companyId,
      userId,
      action: 'CREATE',
      entityType: 'Resource',
      entityId: `import-${Date.now()}`,
      newValue: { mode: req.body.mode, result },
      ipAddress: req.ip,
    });
    created(res, result);
  } catch (err) {
    next(err);
  }
}

export async function anomalies(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId, role } = req.user!;
    const hints = await getAnomalyHints(companyId, userId, role);
    // INVENTORY_HORIZONTAL_PLATFORM (Phase 9.4): overdue-invoice reminders ride
    // along when someone opens the dashboard (deduped to once per week).
    void notifyOverdueInvoices(companyId).catch(() => undefined);
    ok(res, hints);
  } catch (err) {
    next(err);
  }
}
