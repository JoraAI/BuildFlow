/**
 * BuildFlow - Notification service.
 *
 * Creates in-app Notification rows and enqueues delivery jobs (push, WhatsApp, SMS)
 * via the `notification` Bull queue. Trigger points:
 *   - Task overdue (daily 9AM cron)
 *   - Invoice sent (WhatsApp to client)
 *   - Bill approved (SMS to vendor)
 *   - Daily report not submitted by 6PM (push + SMS to supervisor)
 *   - Budget > 80% (push + WhatsApp to PM + OWNER)
 *   - Estimate approved/rejected (push)
 *   - Estimate vs actual variance > 15% (alert PM + OWNER)
 *   - Material price change > 10% (alert PM)
 *   - PO material rate over plan threshold (push to PM + OWNER)
 *   - Razorpay payment captured (push to OWNER + ACCOUNTANT)
 *
 * Channel preference is read from user.notificationPreferences (JSON); defaults to all on.
 */
import { prisma } from '../lib/prisma';
import { getQueue } from '../lib/queue';
import { logger } from '../config/logger';

export type NotificationChannel = 'PUSH' | 'WHATSAPP' | 'SMS';

export interface NotifyPayload {
  userId: string;
  companyId?: string;
  title: string;
  body: string;
  type: string;
  referenceId?: string;
  channels?: NotificationChannel[]; // defaults to ['PUSH']
  // Out-of-band recipients (e.g. client phone for invoice WhatsApp) - bypass user pref lookup
  external?: { channel: 'WHATSAPP' | 'SMS'; to: string; message: string }[];
}

/**
 * Create a notification row + enqueue delivery. Never throws - logging only - so it
 * can't break the parent business flow.
 */
export async function notify(payload: NotifyPayload): Promise<void> {
  try {
    const channels = payload.channels ?? ['PUSH'];

    // Fetch recipient + preferences
    const user = await prisma.user.findFirst({
      where: { id: payload.userId },
      select: { id: true, phone: true, name: true, companyId: true, notificationPrefs: true },
    });

    // In-app row always created (powers the notification center)
    const row = await prisma.notification.create({
      data: {
        userId: payload.userId,
        title: payload.title,
        body: payload.body,
        type: payload.type,
        referenceId: payload.referenceId ?? null,
      },
    });
    void row;

    if (!user) return;

    const companyId = payload.companyId ?? user.companyId;

    // User channel prefs (stored as JSON like { PUSH: true, WHATSAPP: true, SMS: false })
    const prefs = (user.notificationPrefs ?? {}) as Record<NotificationChannel, boolean | undefined>;

    const jobs: Array<{ name: string; data: unknown }> = [];
    for (const ch of channels) {
      if (prefs[ch] === false) continue; // explicitly disabled
      if (ch === 'PUSH') {
        jobs.push({ name: 'push', data: { userId: user.id, title: payload.title, body: payload.body, notificationId: row.id } });
      } else if ((ch === 'WHATSAPP' || ch === 'SMS') && user.phone) {
        jobs.push({
          name: ch.toLowerCase(),
          data: { companyId, to: user.phone, message: `${payload.title}: ${payload.body}`, userId: user.id },
        });
      }
    }
    // External recipients (clients/vendors) - no pref check
    for (const ext of payload.external ?? []) {
      jobs.push({ name: ext.channel.toLowerCase(), data: { companyId, to: ext.to, message: ext.message } });
    }

    if (jobs.length > 0) {
      await getQueue('notification').addBulk(jobs.map((j) => ({ name: j.name, data: j.data })));
    }
  } catch (err) {
    logger.warn('notify() failed (non-fatal)', { error: String(err), type: payload.type });
  }
}

/** Notify multiple users (e.g. PM + OWNER on budget overrun). */
export async function notifyMany(userIds: string[], payload: Omit<NotifyPayload, 'userId'>): Promise<void> {
  await Promise.all(userIds.map((userId) => notify({ ...payload, userId })));
}

/** Find PMs + OWNERs of a project (for project-scoped alerts). */
export async function getProjectAlertRecipients(
  companyId: string,
  projectId: string,
): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { companyId, role: { in: ['OWNER', 'PM'] } },
    select: { id: true },
  });
  // Include the assigned supervisor of the project's tasks, if any
  const supervisors = await prisma.task.findMany({
    where: { projectId, assignedTo: { not: undefined } },
    select: { assignedTo: true },
    distinct: ['assignedTo'],
  });
  void companyId;
  return [...users.map((u) => u.id), ...supervisors.map((s) => s.assignedTo).filter(Boolean)] as string[];
}