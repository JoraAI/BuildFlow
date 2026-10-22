/**
 * BuildFlow - MSG91 SMS (India OTP via DLT templates).
 *
 * Setup (control.msg91.com + VILPOWER DLT):
 *  1. Authkey → Settings → Authkey
 *  2. Sender ID (6 chars) approved on DLT — e.g. STAFFP. See docs/SMS_DLT_HEADER.md.
 *  3. OTP → Templates: map the approved DLT body (##OTP##) and copy Template ID
 *     OR One API → Flow mapped to the same DLT template
 *
 * Env: MSG91_AUTH_KEY + (MSG91_TEMPLATE_ID or MSG91_FLOW_ID)
 *      MSG91_SENDER_ID=STAFFP  MSG91_FLOW_OTP_VAR=OTP
 */
import { OTP_DIGITS } from '@buildflow/shared';
import { env } from '../config/env';
import { logger } from '../config/logger';

function hasAuth(): boolean {
  return Boolean(env.MSG91_AUTH_KEY);
}

function hasTemplate(): boolean {
  return Boolean(env.MSG91_TEMPLATE_ID);
}

function hasFlow(): boolean {
  return Boolean(env.MSG91_FLOW_ID && env.MSG91_SENDER_ID);
}

function isConfigured(): boolean {
  return hasAuth() && (hasTemplate() || hasFlow());
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

type Msg91Json = { type?: string; message?: string | string[]; request_id?: string };

async function postMsg91(url: string, body: Record<string, unknown>): Promise<Msg91Json> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      authkey: env.MSG91_AUTH_KEY!,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: Msg91Json = {};
  try {
    parsed = JSON.parse(text) as Msg91Json;
  } catch {
    // keep raw
  }
  if (!res.ok || (parsed.type && parsed.type !== 'success')) {
    logger.warn('MSG91 OTP send failed', {
      status: res.status,
      error: text.slice(0, 500),
    });
    throw new Error(`MSG91 error ${res.status}: ${text.slice(0, 200)}`);
  }
  return parsed;
}

/**
 * Send OTP via MSG91 SendOTP (template_id) or Flow API. Returns false if not configured.
 */
export async function sendMsg91Otp(to: string, otp: string): Promise<boolean> {
  if (!isConfigured()) {
    logger.debug('MSG91 skipped (not configured)', { to });
    return false;
  }

  const mobile = toMsg91Mobile(to);
  const varName = env.MSG91_FLOW_OTP_VAR || 'OTP';

  if (hasTemplate()) {
    const params = new URLSearchParams({
      template_id: env.MSG91_TEMPLATE_ID!,
      mobile,
      otp,
      otp_length: String(OTP_DIGITS),
      otp_expiry: '10',
      realTimeResponse: '1',
    });
    if (env.MSG91_SENDER_ID) params.set('sender', env.MSG91_SENDER_ID);
    const parsed = await postMsg91(
      `https://control.msg91.com/api/v5/otp?${params.toString()}`,
      { [varName]: otp },
    );
    logger.info('MSG91 OTP sent (template)', { to: mobile, type: parsed.type });
    return true;
  }

  const parsed = await postMsg91('https://control.msg91.com/api/v5/flow/', {
    flow_id: env.MSG91_FLOW_ID,
    sender: env.MSG91_SENDER_ID,
    recipients: [
      {
        mobiles: mobile,
        [varName]: otp,
      },
    ],
  });
  logger.info('MSG91 OTP sent (flow)', { to: mobile, type: parsed.type });
  return true;
}
