/**
 * BuildFlow - Inventory AI routes (INVENTORY_HORIZONTAL_PLATFORM Phase 7).
 *
 * Mounted at /api/inventory/ai — company-scoped, gated to the INVENTORY plan via
 * `requireInventoryFeature('stock_adjustments')`; construction tenants get 403.
 * Mutations require OWNER / INVENTORY_MANAGER; the anomalies strip is read-only.
 */
import { Router } from 'express';
import * as aiController from '../controllers/inventory-ai.controller';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { requireInventoryFeature } from '../middleware/module-gate';
import { Role } from '@buildflow/shared';
import {
  invoiceUploadSchema,
  createBillFromDraftSchema,
  importPreviewSchema,
  importConfirmSchema,
} from '@buildflow/shared';

export const inventoryAiRouter = Router();

inventoryAiRouter.use(authenticateToken);
inventoryAiRouter.use(requireInventoryFeature('stock_adjustments'));

const canManage = requireRole(Role.OWNER, Role.INVENTORY_MANAGER);

// 7.3 Anomaly hints (rules-first dashboard strip).
inventoryAiRouter.get('/anomalies', aiController.anomalies);

// 7.1 Document OCR → draft bill (lines + GST/HSN, PO/GRN match).
inventoryAiRouter.post(
  '/bills/extract',
  canManage,
  validate({ body: invoiceUploadSchema }),
  aiController.extract,
);
inventoryAiRouter.post(
  '/bills/create-from-draft',
  canManage,
  validate({ body: createBillFromDraftSchema }),
  aiController.createFromDraft,
);

// 7.2 AI import column mapping.
inventoryAiRouter.post(
  '/import/preview',
  canManage,
  validate({ body: importPreviewSchema }),
  aiController.previewImport,
);
inventoryAiRouter.post(
  '/import/confirm',
  canManage,
  validate({ body: importConfirmSchema }),
  aiController.confirmImportAI,
);
