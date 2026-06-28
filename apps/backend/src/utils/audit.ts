/**
 * BuildFlow - Audit log helper.
 *
 * Used by the `auditLog` middleware to record mutations (create/update/delete).
 * Stored in the AuditLog table with company_id scoping and Prisma JSON values.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../config/logger';

export interface AuditEntry {
  companyId: string;
  userId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'APPROVE' | 'REJECT' | 'SUBMIT' | 'SEND' | 'CUSTOM';
  entityType: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        companyId: entry.companyId,
        userId: entry.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        oldValue: (entry.oldValue ?? null) as Prisma.InputJsonValue,
        newValue: (entry.newValue ?? null) as Prisma.InputJsonValue,
        ipAddress: entry.ipAddress ?? null,
      },
    });
  } catch (err) {
    // Never let audit logging crash a request - log and continue.
    logger.error('Audit log write failed', { error: String(err), entry });
  }
}