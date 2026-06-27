/**
 * BuildFlow — Twilio service (WhatsApp Business + SMS).
 *
 * Used by the notification Bull worker. All network calls are wrapped so failures
 * are logged but never crash the job (retries handled by Bull backoff).
 *
 * Credentials come from env (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_FROM / TWILIO_SMS_FROM).
 * If creds are missing, sends are skipped with a debug log — safe for local dev.
 */
import { env } from '../config/env';
import { logger } from '../config/logger';

function authHeader(): string | null {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) return null;
  return 'Basic ' + Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');
}

function normalizePhone(raw: string): string {
  // Twilio expects E.164. Assume India (+91) if no country code.
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return digits.length > 10 ? `+${digits}` : `+91${digits}`;
}

export async function sendWhatsApp(to: string, message: string): Promise<void> {
  const auth = authHeader();
  if (!auth || !env.TWILIO_WHATSAPP_FROM) {
    logger.debug('Twilio WhatsApp skipped (no creds)', { to });
    return;
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
  const body = new URLSearchParams({
    From: env.TWILIO_WHATSAPP_FROM, // e.g. whatsapp:+14155238886 (sandbox) or business number
    To: `whatsapp:${normalizePhone(to)}`,
    Body: message,
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    logger.warn('Twilio WhatsApp send failed', { to, status: res.status, error: text });
    throw new Error(`Twilio WhatsApp error ${res.status}`);
  }
  logger.info('Twilio WhatsApp sent', { to });
}

export async function sendSMS(to: string, message: string): Promise<void> {
  const auth = authHeader();
  if (!auth || !env.TWILIO_SMS_FROM) {
    logger.debug('Twilio SMS skipped (no creds)', { to });
    return;
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
  const body = new URLSearchParams({
    From: env.TWILIO_SMS_FROM,
    To: normalizePhone(to),
    Body: message,
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    logger.warn('Twilio SMS send failed', { to, status: res.status, error: text });
    throw new Error(`Twilio SMS error ${res.status}`);
  }
  logger.info('Twilio SMS sent', { to });
}

export async function sendPush(_userId: string, _title: string, _body: string): Promise<void> {
  // Expo push tokens would be stored per-device; for now we log. Real impl:
  //   await fetch('https://exp.host/--/api/v2/push/send', { ... })
  logger.debug('Push notification (stub)', { userId: _userId, title: _title });
}