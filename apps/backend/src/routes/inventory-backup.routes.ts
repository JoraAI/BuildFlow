/**
 * Inventory shop backup — JSON snapshot + ZIP archive.
 * Mounted at /api/inventory/backup
 */
import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { requireInventoryFeature } from '../middleware/module-gate';
import { Role } from '@buildflow/shared';
import { exportCompanyData } from '../services/settings.service';
import { streamCompanyZip } from '../services/export-zip.service';
import { ok } from '../utils/response';
import { recordAudit } from '../utils/audit';

export const inventoryBackupRouter = Router();
inventoryBackupRouter.use(authenticateToken);
inventoryBackupRouter.use(requireInventoryFeature('cash_book'));
inventoryBackupRouter.use(requireRole(Role.OWNER, Role.INVENTORY_MANAGER));

inventoryBackupRouter.get('/', async (req, res, next) => {
  try {
    const { companyId, id: userId } = req.user!;
    const snapshot = await exportCompanyData(companyId);
    await recordAudit({
      companyId,
      userId,
      action: 'CUSTOM',
      entityType: 'inventory_backup',
      entityId: companyId,
      newValue: { format: 'json', summary: 'downloaded shop JSON backup' },
      ipAddress: req.ip,
    });
    return ok(res, snapshot);
  } catch (err) {
    next(err);
  }
});

inventoryBackupRouter.get('/zip', async (req, res, next) => {
  try {
    const { companyId, id: userId } = req.user!;
    await streamCompanyZip(companyId, res);
    await recordAudit({
      companyId,
      userId,
      action: 'CUSTOM',
      entityType: 'inventory_backup',
      entityId: companyId,
      newValue: { format: 'zip', summary: 'downloaded shop ZIP backup' },
      ipAddress: req.ip,
    });
  } catch (err) {
    next(err);
  }
});
