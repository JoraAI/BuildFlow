/**
 * BuildFlow - MSG91 SMS (India OTP via Flow / DLT templates).
 *
 * Setup (control.msg91.com):
 *  1. Authkey → Settings → Authkey
 *  2. Sender ID (6 chars) approved on DLT + MSG91
 *  3. One API → Flow with DLT template, e.g.
 *     StaffingPros: Your BuildFlow login code is ##OTP##. Valid for 10 minutes. Do not share this code.
 *  4. Map the flow to your DLT template ID
 *
 * Env: MSG91_AUTH_KEY, MSG91_SENDER_ID, MSG91_FLOW_ID, MSG91_FLOW_OTP_VAR (default OTP)
 */
import { env } from '../config/env';
import { logger } from '../config/logger';

function isConfigured(): boolean {
  return Boolean(env.MSG91_AUTH_KEY && env.MSG91_SENDER_ID && env.MSG91_FLOW_ID);
}

/** International digits without +: 9198XXXXXXXX */
export function toMsg91Mobile(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length > 10) return digits;
  return `91${digits}`;
}

export function isMsg91Configured(): boolean {
  return isConfigured();
}

/**
 * Send OTP via MSG91 Flow API (DLT-compliant). Returns false if not configured.
 */
export async function sendMsg91Otp(to: string, otp: string): Promise<boolean> {
  if (!isConfigured()) {
    logger.debug('MSG91 skipped (not configured)', { to });
    return false;
  }

  const mobile = toMsg91Mobile(to);
  const varName = env.MSG91_FLOW_OTP_VAR || 'OTP';
  const url = 'https://control.msg91.com/api/v5/flow/';
  const payload = {
    flow_id: env.MSG91_FLOW_ID,
    sender: env.MSG91_SENDER_ID,
    recipients: [
      {
        mobiles: mobile,
        [varName]: otp,
      },
    ],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      authkey: env.MSG91_AUTH_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let parsed: { type?: string; message?: string | string[] } = {};
  try {
    parsed = JSON.parse(text) as { type?: string; message?: string | string[] };
  } catch {
    // keep raw text
  }

  if (!res.ok || (parsed.type && parsed.type !== 'success')) {
    logger.warn('MSG91 OTP send failed', {
      to: mobile,
      status: res.status,
      error: text.slice(0, 500),
    });
    throw new Error(`MSG91 error ${res.status}: ${text.slice(0, 200)}`);
  }

  logger.info('MSG91 OTP sent', { to: mobile, type: parsed.type });
  return true;
}
