/**
 * BuildFlow - Reorder automation routes (INVENTORY_HORIZONTAL_PLATFORM Phase 4).
 *
 * Mounted at /api/inventory/reorder and gated by `stock_adjustments` - construction
 * tenants get 403 on every route.
 */
import { Router } from 'express';
import * as reorderController from '../controllers/reorder.controller';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { requireInventoryFeature } from '../middleware/module-gate';
import { orderReorderItemsSchema } from '@buildflow/shared';
import { Role } from '@buildflow/shared';

export const reorderRouter = Router();

reorderRouter.use(authenticateToken);
reorderRouter.use(requireInventoryFeature('stock_adjustments'));

const canManage = requireRole(Role.OWNER, Role.INVENTORY_MANAGER);

// 4.2 Reorder suggestions (read for everyone).
reorderRouter.get('/suggestions', reorderController.getSuggestions);

// 4.3 One-click purchase: auto-approved indent + PO from low-stock items.
reorderRouter.post(
  '/suggestions/order',
  canManage,
  validate({ body: orderReorderItemsSchema }),
  reorderController.order,
);
