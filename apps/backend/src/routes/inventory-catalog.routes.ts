/**
 * BuildFlow - Inventory catalog routes (INVENTORY_KIRANA_RETAIL_WHOLESALE Phase 11.1).
 *
 * Mounted at /api/inventory - every route is gated by
 * `requireInventoryFeature('kirana_catalog')` so construction tenants get 403.
 * Both preview and apply are OWNER-only (Settings surface).
 */
import { Router } from 'express';
import * as catalog from '../controllers/inventory-catalog.controller';
import { authenticateToken, requireRole } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { validate } from '../middleware/validate';
import { requireInventoryFeature } from '../middleware/module-gate';
import { Role } from '@buildflow/shared';
import {
  catalogApplySchema,
  catalogImportItemsSchema,
  catalogImportSelectedSchema,
  catalogLibraryQuerySchema,
  catalogPreviewSchema,
  catalogVerticalSchema,
} from '@buildflow/shared';

export const inventoryCatalogRouter = Router();

inventoryCatalogRouter.use(authenticateToken);
inventoryCatalogRouter.use(requireInventoryFeature('kirana_catalog'));

const ownerOnly = requireRole(Role.OWNER);

// 11.1.5b K2: OWNER vertical picker (opt RETAIL/WHOLESALE shop into KIRANA).
inventoryCatalogRouter.put('/catalog/vertical', ownerOnly, validate({ body: catalogVerticalSchema }), catalog.setVertical);

// 11.5: manager-friendly selective library and quantity intake.
inventoryCatalogRouter.get(
  '/catalog/library',
  requirePermission('stock.manage'),
  validate({ query: catalogLibraryQuerySchema }),
  catalog.library,
);
inventoryCatalogRouter.post(
  '/catalog/import-items',
  requirePermission('stock.manage'),
  validate({ body: catalogImportItemsSchema }),
  catalog.importItems,
);
inventoryCatalogRouter.post(
  '/catalog/import-selected',
  requirePermission('stock.manage'),
  validate({ body: catalogImportSelectedSchema }),
  catalog.importSelected,
);

// 11.1 Settings preview (pack sizes, category counts, already-applied count).
inventoryCatalogRouter.get('/catalog/preview', ownerOnly, validate({ query: catalogPreviewSchema }), catalog.preview);

// 11.1 Apply / add-missing (insert-only, idempotent).
inventoryCatalogRouter.post('/catalog/apply', ownerOnly, validate({ body: catalogApplySchema }), catalog.apply);
