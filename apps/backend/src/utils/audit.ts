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
  // FIX (§2.3 #2): Add UPLOAD / ANSWER / REVIEW for Phase 5 modules (drawings,
  // RFIs, submittals). AuditLog.action is a free-form String column, so these
  // need no schema migration.
  action:
    | 'CREATE'
    | 'UPDATE'
    | 'DELETE'
    | 'LOGIN'
    | 'LOGOUT'
    | 'APPROVE'
    | 'REJECT'
    | 'SUBMIT'
    | 'SEND'
    | 'CUSTOM'
    | 'RESET'
    | 'UPLOAD'
    | 'ANSWER'
    | 'REVIEW';
  entityType: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
}

function withActorName(newValue: unknown, actorName: string): Prisma.InputJsonValue {
  if (newValue && typeof newValue === 'object' && !Array.isArray(newValue)) {
    const obj = newValue as Record<string, unknown>;
    if (typeof obj.actorName === 'string' && obj.actorName.trim()) {
      return newValue as Prisma.InputJsonValue;
    }
    return { actorName, ...obj } as Prisma.InputJsonValue;
  }
  if (newValue == null) return { actorName };
  return { actorName, value: newValue } as Prisma.InputJsonValue;
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    const user = await prisma.user.findFirst({
      where: { id: entry.userId },
      select: { name: true },
    });
    const actorName = user?.name?.trim() || 'Team member';
    await prisma.auditLog.create({
      data: {
        companyId: entry.companyId,
        userId: entry.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        oldValue: (entry.oldValue ?? null) as Prisma.InputJsonValue,
        newValue: withActorName(entry.newValue, actorName),
        ipAddress: entry.ipAddress ?? null,
      },
    });
  } catch (err) {
    // Never let audit logging crash a request - log and continue.
    logger.error('Audit log write failed', { error: String(err), entry });
  }
}