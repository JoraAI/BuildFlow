/**
 * BuildFlow - Warehouse ops routes (INVENTORY_HORIZONTAL_PLATFORM Phase 3).
 *
 * Mounted at /api/inventory — warehouses / transfers / stock-counts gated by
 * `multi_warehouse`, barcode identify gated by `barcode`. Construction tenants
 * get 403 on every route.
 */
import { Router } from 'express';
import * as warehouseController from '../controllers/warehouse.controller';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { requireInventoryFeature } from '../middleware/module-gate';
import { idSchema } from '@buildflow/shared';
import {
  warehouseSchema,
  updateWarehouseSchema,
  createTransferOrderSchema,
  createStockCountSchema,
  barcodeParamsSchema,
} from '@buildflow/shared';
import { Role } from '@buildflow/shared';
import { z } from 'zod';

export const warehouseRouter = Router();

warehouseRouter.use(authenticateToken);
warehouseRouter.use(requireInventoryFeature('multi_warehouse'));

const canManage = requireRole(Role.OWNER, Role.INVENTORY_MANAGER);
const idParams = z.object({ id: idSchema });

/* ── 3.1 Warehouses ───────────────────────────────────────────────── */
warehouseRouter.get('/warehouses', warehouseController.listWarehouses);
warehouseRouter.post('/warehouses', canManage, validate({ body: warehouseSchema }), warehouseController.createWarehouse);
warehouseRouter.get('/warehouses/:id', validate({ params: idParams }), warehouseController.getWarehouse);
warehouseRouter.put('/warehouses/:id', canManage, validate({ params: idParams, body: updateWarehouseSchema }), warehouseController.updateWarehouse);
warehouseRouter.delete('/warehouses/:id', canManage, validate({ params: idParams }), warehouseController.deleteWarehouse);

/* ── 3.2 Stock transfers ──────────────────────────────────────────── */
warehouseRouter.get('/transfers', warehouseController.listTransfers);
warehouseRouter.post('/transfers', canManage, validate({ body: createTransferOrderSchema }), warehouseController.createTransfer);
warehouseRouter.post('/transfers/:id/dispatch', canManage, validate({ params: idParams }), warehouseController.dispatchTransfer);
warehouseRouter.post('/transfers/:id/receive', canManage, validate({ params: idParams }), warehouseController.receiveTransfer);
warehouseRouter.post('/transfers/:id/cancel', canManage, validate({ params: idParams }), warehouseController.cancelTransfer);

/* ── 3.3 Stock counts ─────────────────────────────────────────────── */
warehouseRouter.get('/stock-counts', warehouseController.listStockCounts);
warehouseRouter.post('/stock-counts', canManage, validate({ body: createStockCountSchema }), warehouseController.createStockCount);
warehouseRouter.get('/stock-counts/:id', validate({ params: idParams }), warehouseController.getStockCount);
warehouseRouter.post('/stock-counts/:id/approve', canManage, validate({ params: idParams }), warehouseController.approveStockCount);
warehouseRouter.post('/stock-counts/:id/cancel', canManage, validate({ params: idParams }), warehouseController.cancelStockCount);

/* ── 3.4 Barcode identify ─────────────────────────────────────────── */
warehouseRouter.get(
  '/items/by-barcode/:code',
  requireInventoryFeature('barcode'),
  validate({ params: barcodeParamsSchema }),
  warehouseController.findByBarcode,
);
