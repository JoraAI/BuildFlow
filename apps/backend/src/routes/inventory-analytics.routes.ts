/**
 * BuildFlow - Inventory analytics routes (INVENTORY_HORIZONTAL_PLATFORM Phase 6).
 *
 * Mounted at /api/inventory/analytics and gated by `stock_adjustments` — the
 * analytics build on low-stock (Phase 1.5) + WAC (Phase 5) data. Construction
 * tenants get 403 on every route.
 */
import { Router } from 'express';
import * as analyticsController from '../controllers/inventory-analytics.controller';
import { authenticateToken } from '../middleware/auth';
import { requireInventoryFeature } from '../middleware/module-gate';

export const inventoryAnalyticsRouter = Router();

inventoryAnalyticsRouter.use(authenticateToken);
inventoryAnalyticsRouter.use(requireInventoryFeature('stock_adjustments'));

// 6.1 Executive dashboard.
inventoryAnalyticsRouter.get('/dashboard', analyticsController.getDashboard);

// 6.2 Stock health + warehouse value.
inventoryAnalyticsRouter.get('/reports/stock-health', analyticsController.getStockHealth);
inventoryAnalyticsRouter.get('/reports/warehouse', analyticsController.getWarehouseValue);

// 6.3 Margins + purchase history.
inventoryAnalyticsRouter.get('/reports/margin', analyticsController.getMargin);
inventoryAnalyticsRouter.get('/reports/purchase-history', analyticsController.getPurchaseHistory);
