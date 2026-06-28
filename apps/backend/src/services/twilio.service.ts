/**
 * BuildFlow — Twilio service (WhatsApp Business + SMS).
 *
 * Credentials resolve per company via integration.service with platform fallback.
 */
import { resolveTwilioConfig, type TwilioConfig } from './integration.service';
import { logger } from '../config/logger';

function authHeader(config: TwilioConfig): string {
  return 'Basic ' + Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64');
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return digits.length > 10 ? `+${digits}` : `+91${digits}`;
}

export async function sendWhatsApp(companyId: string, to: string, message: string): Promise<void> {
  const config = await resolveTwilioConfig(companyId);
  if (!config?.whatsappFrom) {
    logger.debug('Twilio WhatsApp skipped (no creds)', { companyId, to });
    return;
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;
  const body = new URLSearchParams({
    From: config.whatsappFrom,
    To: `whatsapp:${normalizePhone(to)}`,
    Body: message,
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: authHeader(config), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    logger.warn('Twilio WhatsApp send failed', { companyId, to, status: res.status, error: text });
    throw new Error(`Twilio WhatsApp error ${res.status}`);
  }
  logger.info('Twilio WhatsApp sent', { companyId, to });
}

export async function sendSMS(companyId: string, to: string, message: string): Promise<void> {
  const config = await resolveTwilioConfig(companyId);
  if (!config?.smsFrom) {
    logger.debug('Twilio SMS skipped (no creds)', { companyId, to });
    return;
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;
  const body = new URLSearchParams({
    From: config.smsFrom,
    To: normalizePhone(to),
    Body: message,
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: authHeader(config), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    logger.warn('Twilio SMS send failed', { companyId, to, status: res.status, error: text });
    throw new Error(`Twilio SMS error ${res.status}`);
  }
  logger.info('Twilio SMS sent', { companyId, to });
}

export async function sendPush(_userId: string, _title: string, _body: string): Promise<void> {
  logger.debug('Push notification (stub)', { userId: _userId, title: _title });
}
