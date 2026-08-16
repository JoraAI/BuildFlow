/**
 * BuildFlow - Inventory catalog controller (INVENTORY_KIRANA_RETAIL_WHOLESALE Phase 11.1).
 * OWNER-only Settings surface for vertical starter catalogs (preview + apply).
 */
import { NextFunction, Request, Response } from 'express';
import {
  applyCatalogTemplate,
  importCatalogItems,
  importSelectedCatalogStock,
  listCatalogLibrary,
  previewCatalogTemplate,
  setInventoryVertical,
} from '../services/catalog-template.service';
import { ok } from '../utils/response';
import { recordAudit } from '../utils/audit';
import type { InventoryVertical } from '@buildflow/shared';

function templateFrom(req: Request): InventoryVertical {
  const value = (req.query.template as string | undefined) ?? req.body.template;
  return value as InventoryVertical;
}

export async function importItems(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId } = req.user!;
    const result = await importCatalogItems(companyId, userId, req.body);
    await recordAudit({
      companyId,
      userId,
      action: 'CREATE',
      entityType: 'inventory_item_master',
      entityId: `items-${Date.now()}`,
      newValue: { items: result.imported },
      ipAddress: req.ip,
    });
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function library(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId } = req.user!;
    const result = await listCatalogLibrary(
      companyId,
      req.query as unknown as { search?: string; category?: string; page: number; limit: number },
    );
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function importSelected(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId } = req.user!;
    const result = await importSelectedCatalogStock(companyId, userId, req.body);
    await recordAudit({
      companyId,
      userId,
      action: 'CREATE',
      entityType: 'kirana_sku_stock_intake',
      entityId: `intake-${Date.now()}`,
      newValue: { items: result.imported, locationId: result.locationId },
      ipAddress: req.ip,
    });
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function preview(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId } = req.user!;
    const preview = await previewCatalogTemplate(companyId, templateFrom(req));
    ok(res, preview);
  } catch (err) {
    next(err);
  }
}

export async function apply(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId } = req.user!;
    const result = await applyCatalogTemplate(companyId, templateFrom(req));
    await recordAudit({
      companyId,
      userId,
      action: 'CREATE',
      entityType: 'catalog_template',
      entityId: result.template,
      newValue: { created: result.created, skipped: result.skipped, version: result.version },
    });
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

/**
 * K2 (11.1.5b): OWNER vertical picker (Settings → Shop vertical). Only
 * RETAIL / WHOLESALE profiles may opt into KIRANA; other profiles 422, and
 * non-OWNER roles never reach here (route-level requireRole).
 */
export async function setVertical(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId } = req.user!;
    const vertical = (req.body.vertical ?? null) as InventoryVertical | null;
    const result = await setInventoryVertical(companyId, vertical);
    await recordAudit({
      companyId,
      userId,
      action: 'UPDATE',
      entityType: 'inventory_vertical',
      entityId: result.inventoryVertical ?? 'NONE',
      newValue: { inventoryVertical: result.inventoryVertical },
    });
    ok(res, result);
  } catch (err) {
    next(err);
  }
}
