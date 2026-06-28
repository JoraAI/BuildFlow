/**
 * Internal ops notifications for BuildFlow / Jora AI team.
 * Logs always; optional webhook POST when INTERNAL_OPS_WEBHOOK_URL is set.
 */
import { env } from '../config/env';
import { logger } from '../config/logger';

export interface OpsEvent {
  event: string;
  companyId?: string;
  companyName?: string;
  ownerEmail?: string;
  daysLeft?: number;
  message: string;
}

export async function notifyInternalOps(payload: OpsEvent): Promise<void> {
  logger.info('[ops-notification]', payload);

  if (!env.INTERNAL_OPS_WEBHOOK_URL) return;

  try {
    await fetch(env.INTERNAL_OPS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: payload.message,
        ...payload,
      }),
    });
  } catch (err) {
    logger.warn('Internal ops webhook failed', { error: String(err) });
  }
}
