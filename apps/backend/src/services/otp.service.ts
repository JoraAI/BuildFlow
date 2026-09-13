/**
 * BuildFlow - OTP helpers for invite accept & login (Redis-backed).
 * Supports SMS (Twilio) and email (Resend / SMTP). Master code bypass for seed/dev.
 */
import { createHash, randomInt, randomBytes } from 'crypto';
import { redis } from '../lib/redis';
import { ApiError } from '../utils/errors';
import { env } from '../config/env';
import { sendSMS } from './twilio.service';
import { sendTransactionalEmail } from './email.service';
import { logger } from '../config/logger';

const OTP_TTL_SEC = 10 * 60;
const OTP_MAX_ATTEMPTS = 5;

function hashOtp(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function generateOtpCode(): string {
  return String(randomInt(100000, 999999));
}

/** Strong random password used when joining via OTP (user may set one later). */
export function generateRandomPassword(): string {
  const raw = randomBytes(18).toString('base64url');
  return `Aa1!${raw}`;
}

export function isMasterOtpEnabled(): boolean {
  if (env.OTP_MASTER_ENABLED !== undefined) return env.OTP_MASTER_ENABLED;
  return env.NODE_ENV !== 'production';
}

export function isMasterOtpCode(code: string): boolean {
  return isMasterOtpEnabled() && Boolean(env.OTP_MASTER_CODE) && code === env.OTP_MASTER_CODE;
}

export async function issueOtp(opts: {
  purpose: 'invite' | 'login';
  key: string;
  channel: 'sms' | 'email';
  /** Destination stored for verification (normalized phone or lowercase email). */
  destination: string;
  companyId: string;
  messagePrefix: string;
  /** Subject line for email channel. */
  emailSubject?: string;
}): Promise<{ sent: true; expiresInSec: number; destinationMasked: string; devCode?: string }> {
  const code = generateOtpCode();
  const redisKey = `otp:${opts.purpose}:${opts.key}`;
  await redis.set(
    redisKey,
    JSON.stringify({
      hash: hashOtp(code),
      attempts: 0,
      channel: opts.channel,
      destination: opts.destination,
      // legacy field kept for older invite consumers
      phone: opts.channel === 'sms' ? opts.destination : undefined,
    }),
    'EX',
    OTP_TTL_SEC,
  );

  const body = `${opts.messagePrefix} ${code}. Valid for 10 minutes.`;
  let delivered = false;
  try {
    if (opts.channel === 'sms') {
      delivered = await sendSMS(opts.companyId, opts.destination, body);
    } else {
      delivered = await sendTransactionalEmail({
        to: opts.destination,
        subject: opts.emailSubject ?? 'Your BuildFlow login code',
        text: body,
      });
    }
  } catch (err) {
    logger.warn('OTP delivery failed', {
      purpose: opts.purpose,
      channel: opts.channel,
      destination: opts.destination,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // When delivery is not configured / failed, expose code outside production.
  const exposeDevCode = env.NODE_ENV !== 'production' && !delivered;
  if (exposeDevCode) {
    logger.info('OTP (dev/test — not delivered)', {
      purpose: opts.purpose,
      channel: opts.channel,
      destination: opts.destination,
      code,
    });
  }

  return {
    sent: true,
    expiresInSec: OTP_TTL_SEC,
    destinationMasked: maskDestination(opts.channel, opts.destination),
    ...(exposeDevCode ? { devCode: code } : {}),
  };
}

export async function consumeOtp(opts: {
  purpose: 'invite' | 'login';
  key: string;
  code: string;
  expectedDestination?: string;
  /** @deprecated use expectedDestination */
  expectedPhone?: string;
}): Promise<void> {
  // Seed / staging bypass until real SMS/email credentials are wired.
  if (isMasterOtpCode(opts.code)) {
    const redisKey = `otp:${opts.purpose}:${opts.key}`;
    await redis.del(redisKey);
    return;
  }

  const redisKey = `otp:${opts.purpose}:${opts.key}`;
  const raw = await redis.get(redisKey);
  if (!raw) throw ApiError.badRequest('OTP expired or not requested. Please send a new code.');

  let payload: {
    hash: string;
    attempts: number;
    phone?: string;
    destination?: string;
    channel?: string;
  };
  try {
    payload = JSON.parse(raw) as {
      hash: string;
      attempts: number;
      phone?: string;
      destination?: string;
      channel?: string;
    };
  } catch {
    await redis.del(redisKey);
    throw ApiError.badRequest('Invalid OTP session. Please send a new code.');
  }

  const expected = opts.expectedDestination ?? opts.expectedPhone;
  const stored = payload.destination ?? payload.phone;
  if (expected && stored && stored !== expected) {
    throw ApiError.badRequest(
      payload.channel === 'email'
        ? 'OTP does not match this email'
        : 'OTP does not match this mobile number',
    );
  }

  if (payload.attempts >= OTP_MAX_ATTEMPTS) {
    await redis.del(redisKey);
    throw ApiError.badRequest('Too many invalid OTP attempts. Please send a new code.');
  }

  if (hashOtp(opts.code) !== payload.hash) {
    payload.attempts += 1;
    const ttl = await redis.ttl(redisKey);
    await redis.set(redisKey, JSON.stringify(payload), 'EX', ttl > 0 ? ttl : OTP_TTL_SEC);
    throw ApiError.badRequest('Invalid OTP');
  }

  await redis.del(redisKey);
}

function maskDestination(channel: 'sms' | 'email', destination: string): string {
  if (channel === 'email') {
    const [local, domain] = destination.split('@');
    if (!domain || !local) return '***';
    const visible = local.slice(0, Math.min(2, local.length));
    return `${visible}***@${domain}`;
  }
  const digits = destination.replace(/\D/g, '');
  return digits.length >= 4 ? `******${digits.slice(-4)}` : '******';
}
