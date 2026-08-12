/**
 * BuildFlow - Warehouse ops controller (INVENTORY_HORIZONTAL_PLATFORM Phase 3).
 * Thin request handlers for warehouses, stock transfers, stock counts, barcode.
 */
import { NextFunction, Request, Response } from 'express';
import * as warehouseService from '../services/warehouse.service';
import { ok, created } from '../utils/response';

/* ── 3.1 Warehouses ───────────────────────────────────────────────── */
export async function listWarehouses(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await warehouseService.listWarehouses(req.user!.companyId, req.user!.id, req.user!.role));
  } catch (err) {
    next(err);
  }
}
export async function getWarehouse(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await warehouseService.getWarehouse(req.user!.companyId, req.user!.id, req.user!.role, req.params.id));
  } catch (err) {
    next(err);
  }
}
export async function createWarehouse(req: Request, res: Response, next: NextFunction) {
  try {
    created(res, await warehouseService.createWarehouse(req.user!.companyId, req.user!.id, req.user!.role, req.body));
  } catch (err) {
    next(err);
  }
}
export async function updateWarehouse(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await warehouseService.updateWarehouse(req.user!.companyId, req.user!.id, req.user!.role, req.params.id, req.body));
  } catch (err) {
    next(err);
  }
}
export async function deleteWarehouse(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await warehouseService.deactivateWarehouse(req.user!.companyId, req.user!.id, req.user!.role, req.params.id));
  } catch (err) {
    next(err);
  }
}

/* ── 3.2 Stock transfers ──────────────────────────────────────────── */
export async function listTransfers(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await warehouseService.listTransfers(req.user!.companyId, req.user!.id, req.user!.role));
  } catch (err) {
    next(err);
  }
}
export async function createTransfer(req: Request, res: Response, next: NextFunction) {
  try {
    created(res, await warehouseService.createTransferOrder(req.user!.companyId, req.user!.id, req.user!.role, req.body));
  } catch (err) {
    next(err);
  }
}
export async function dispatchTransfer(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await warehouseService.dispatchTransfer(req.user!.companyId, req.user!.id, req.user!.role, req.params.id));
  } catch (err) {
    next(err);
  }
}
export async function receiveTransfer(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await warehouseService.receiveTransfer(req.user!.companyId, req.user!.id, req.user!.role, req.params.id));
  } catch (err) {
    next(err);
  }
}
export async function cancelTransfer(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await warehouseService.cancelTransfer(req.user!.companyId, req.user!.id, req.user!.role, req.params.id));
  } catch (err) {
    next(err);
  }
}

/* ── 3.3 Stock counts ─────────────────────────────────────────────── */
export async function listStockCounts(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await warehouseService.listStockCounts(req.user!.companyId, req.user!.id, req.user!.role));
  } catch (err) {
    next(err);
  }
}
export async function getStockCount(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await warehouseService.getStockCount(req.user!.companyId, req.user!.id, req.user!.role, req.params.id));
  } catch (err) {
    next(err);
  }
}
export async function createStockCount(req: Request, res: Response, next: NextFunction) {
  try {
    created(res, await warehouseService.createStockCount(req.user!.companyId, req.user!.id, req.user!.role, req.body));
  } catch (err) {
    next(err);
  }
}
export async function approveStockCount(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await warehouseService.approveStockCount(req.user!.companyId, req.user!.id, req.user!.role, req.params.id));
  } catch (err) {
    next(err);
  }
}
export async function cancelStockCount(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await warehouseService.cancelStockCount(req.user!.companyId, req.user!.id, req.user!.role, req.params.id));
  } catch (err) {
    next(err);
  }
}

/* ── 3.4 Barcode identify ─────────────────────────────────────────── */
export async function findByBarcode(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await warehouseService.findItemByBarcode(req.user!.companyId, req.params.code));
  } catch (err) {
    next(err);
  }
}
