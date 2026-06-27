/**
 * BuildFlow — Attendance service (geo-fence check-in / check-out).
 */
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { recordAudit } from '../utils/audit';
import { isWithinGeofence } from '../utils/geo';
import { getProject } from './project.service';
import type { CheckInInput } from '@buildflow/shared';

/**
 * Check in to a project site. Validates the device location against the
 * project's geo-fence (default 500m). Records distance + withinFence flag.
 */
export async function checkIn(
  companyId: string,
  userId: string,
  projectId: string,
  input: CheckInInput,
  ipAddress?: string,
) {
  const project = await getProject(companyId, projectId);

  // Prevent double check-in without check-out (today)
  const openCheckIn = await prisma.attendance.findFirst({
    where: {
      userId,
      projectId,
      checkOutAt: null,
    },
    orderBy: { checkInAt: 'desc' },
  });
  if (openCheckIn) {
    throw ApiError.conflict('You are already checked in. Please check out first.');
  }

  const { within, distance } = isWithinGeofence({
    siteLat: project.locationLat,
    siteLng: project.locationLng,
    lat: input.lat,
    lng: input.lng,
  });

  const attendance = await prisma.attendance.create({
    data: {
      projectId,
      userId,
      checkInAt: new Date(),
      checkInLat: input.lat,
      checkInLng: input.lng,
      distanceFromSite: distance,
      withinFence: within,
      notes: input.notes,
    },
    include: { user: { select: { id: true, name: true } } },
  });

  await recordAudit({
    companyId,
    userId,
    action: 'CREATE',
    entityType: 'attendance',
    entityId: attendance.id,
    newValue: { projectId, withinFence: within, distance },
    ipAddress,
  });

  return serialize(attendance);
}

/**
 * Check out of a project site — sets checkOutAt on the most recent open record.
 */
export async function checkOut(companyId: string, userId: string, projectId: string, ipAddress?: string) {
  const open = await prisma.attendance.findFirst({
    where: { userId, projectId, checkOutAt: null, project: { companyId } },
    orderBy: { checkInAt: 'desc' },
  });
  if (!open) throw ApiError.notFound('No open check-in found for this project');

  const updated = await prisma.attendance.update({
    where: { id: open.id },
    data: { checkOutAt: new Date() },
    include: { user: { select: { id: true, name: true } } },
  });

  await recordAudit({
    companyId,
    userId,
    action: 'UPDATE',
    entityType: 'attendance',
    entityId: open.id,
    newValue: { checkOutAt: updated.checkOutAt },
    ipAddress,
  });

  return serialize(updated);
}

/**
 * List attendance for a project, optionally filtered by date or user.
 */
export async function listAttendance(
  companyId: string,
  projectId: string,
  opts: { date?: string; userId?: string } = {},
) {
  await getProject(companyId, projectId);

  const where: Record<string, unknown> = { projectId };
  if (opts.userId) where.userId = opts.userId;
  if (opts.date) {
    const day = new Date(opts.date);
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    where.checkInAt = { gte: day, lt: next };
  }

  const records = await prisma.attendance.findMany({
    where: where as never,
    include: { user: { select: { id: true, name: true } } },
    orderBy: { checkInAt: 'desc' },
  });

  return records.map(serialize);
}

function serialize<T extends { checkInAt: Date; checkOutAt: Date | null }>(
  r: T,
): Omit<T, 'checkInAt' | 'checkOutAt'> & { checkInAt: string; checkOutAt: string | null } {
  return {
    ...r,
    checkInAt: r.checkInAt.toISOString(),
    checkOutAt: r.checkOutAt ? r.checkOutAt.toISOString() : null,
  };
}