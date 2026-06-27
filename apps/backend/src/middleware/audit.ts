/**
 * BuildFlow — Audit log middleware.
 *
 * Wraps a controller so that AFTER a successful mutation (2xx) an AuditLog row
 * is written. The controller may attach `res.locals.audit` with:
 *   { entityId, oldValue?, newValue? }
 *
 * Usage:
 *   router.post('/', auditLog('CREATE', 'project'), handler)
 */
import { NextFunction, Request, Response } from 'express';
import { recordAudit } from '../utils/audit';

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT' | 'SEND' | 'CUSTOM';

export interface AuditLocal {
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
}

export function auditLog(action: AuditAction, entityType: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user && res.locals.audit) {
        const rawIp = req.headers['x-forwarded-for'] ?? req.ip;
        const ipAddress = Array.isArray(rawIp) ? rawIp[0] : rawIp?.split(',')[0];
        recordAudit({
          companyId: req.user.companyId,
          userId: req.user.id,
          action,
          entityType,
          entityId: res.locals.audit.entityId,
          oldValue: res.locals.audit.oldValue,
          newValue: res.locals.audit.newValue ?? body,
          ipAddress,
        }).catch(() => void 0);
      }
      return originalJson(body);
    }) as typeof res.json;
    next();
  };
}