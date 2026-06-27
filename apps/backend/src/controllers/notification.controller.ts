/**
 * BuildFlow — Notification controller (user notification center).
 */
import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ok } from '../utils/response';

export async function list(req: Request, res: Response) {
  const { id: userId } = req.user!;
  const unreadOnly = req.query.unreadOnly === 'true';
  const limit = Number(req.query.limit ?? 50);
  const data = await prisma.notification.findMany({
    where: { userId, ...(unreadOnly ? { isRead: false } : {}) },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(limit, 1), 100),
  });
  const unreadCount = await prisma.notification.count({ where: { userId, isRead: false } });
  return ok(res, { items: data, unreadCount });
}

export async function markRead(req: Request, res: Response) {
  const { id: userId } = req.user!;
  const id = req.params.id;
  const data = await prisma.notification.updateMany({
    where: { id, userId },
    data: { isRead: true },
  });
  return ok(res, { id, updated: data.count });
}

export async function markAllRead(req: Request, res: Response) {
  const { id: userId } = req.user!;
  const data = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return ok(res, { updated: data.count });
}

export async function updatePrefs(req: Request, res: Response) {
  const { id: userId } = req.user!;
  const prefs = req.body as Record<string, boolean>;
  const data = await prisma.user.update({
    where: { id: userId },
    data: { notificationPrefs: prefs },
    select: { notificationPrefs: true },
  });
  return ok(res, data);
}