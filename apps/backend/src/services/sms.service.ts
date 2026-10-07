/**
 * BuildFlow - SMS delivery facade.
 * Prefers MSG91 (India DLT Flow) when configured; falls back to Twilio.
 */
import { env } from '../config/env';
import { logger } from '../config/logger';
import { isMsg91Configured, sendMsg91Otp } from './msg91.service';
import { sendSMS as sendTwilioSms } from './twilio.service';

export type SmsProviderPreference = 'auto' | 'msg91' | 'twilio';

function preference(): SmsProviderPreference {
  const raw = (env.SMS_PROVIDER ?? 'auto').toLowerCase();
  if (raw === 'msg91' || raw === 'twilio' || raw === 'auto') return raw;
  return 'auto';
}

/** OTP SMS — MSG91 Flow when available (required for India DLT templates). */
export async function sendOtpSms(
  companyId: string,
  to: string,
  otp: string,
  /** Free-text body used only for Twilio fallback. */
  twilioBody: string,
): Promise<boolean> {
  const pref = preference();
  const tryMsg91 = pref === 'msg91' || (pref === 'auto' && isMsg91Configured());
  const tryTwilio = pref === 'twilio' || pref === 'auto';

  if (tryMsg91 && isMsg91Configured()) {
    try {
      return await sendMsg91Otp(to, otp);
    } catch (err) {
      if (pref === 'msg91') throw err;
      logger.warn('MSG91 failed; trying Twilio fallback', {
        companyId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (tryTwilio) {
    return sendTwilioSms(companyId, to, twilioBody);
  }

  logger.debug('SMS OTP skipped (no provider configured)', { companyId, to });
  return false;
}

/** Generic SMS (notifications). Twilio free-text; MSG91 not used unless Flow supports it later. */
export async function sendSMS(companyId: string, to: string, message: string): Promise<boolean> {
  return sendTwilioSms(companyId, to, message);
}
