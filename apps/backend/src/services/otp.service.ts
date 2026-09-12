/**
 * BuildFlow - OTP helpers for invite accept & phone login (Redis-backed).
 */
import { createHash, randomInt, randomBytes } from 'crypto';
import { redis } from '../lib/redis';
import { ApiError } from '../utils/errors';
import { env } from '../config/env';
import { sendSMS } from './twilio.service';
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

export async function issueOtp(opts: {
  purpose: 'invite' | 'login';
  key: string;
  phone: string;
  companyId: string;
  messagePrefix: string;
}): Promise<{ sent: true; expiresInSec: number; devCode?: string }> {
  const code = generateOtpCode();
  const redisKey = `otp:${opts.purpose}:${opts.key}`;
  await redis.set(
    redisKey,
    JSON.stringify({ hash: hashOtp(code), attempts: 0, phone: opts.phone }),
    'EX',
    OTP_TTL_SEC,
  );

  const body = `${opts.messagePrefix} ${code}. Valid for 10 minutes.`;
  let delivered = false;
  try {
    delivered = await sendSMS(opts.companyId, opts.phone, body);
  } catch (err) {
    logger.warn('OTP SMS delivery failed', {
      purpose: opts.purpose,
      phone: opts.phone,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // When Twilio is not configured / SMS not delivered, expose code outside production.
  const exposeDevCode = env.NODE_ENV !== 'production' && !delivered;
  if (exposeDevCode) {
    logger.info('OTP (dev/test — SMS not delivered)', { purpose: opts.purpose, phone: opts.phone, code });
  }

  return {
    sent: true,
    expiresInSec: OTP_TTL_SEC,
    ...(exposeDevCode ? { devCode: code } : {}),
  };
}

export async function consumeOtp(opts: {
  purpose: 'invite' | 'login';
  key: string;
  code: string;
  expectedPhone?: string;
}): Promise<void> {
  const redisKey = `otp:${opts.purpose}:${opts.key}`;
  const raw = await redis.get(redisKey);
  if (!raw) throw ApiError.badRequest('OTP expired or not requested. Please send a new code.');

  let payload: { hash: string; attempts: number; phone?: string };
  try {
    payload = JSON.parse(raw) as { hash: string; attempts: number; phone?: string };
  } catch {
    await redis.del(redisKey);
    throw ApiError.badRequest('Invalid OTP session. Please send a new code.');
  }

  if (opts.expectedPhone && payload.phone && payload.phone !== opts.expectedPhone) {
    throw ApiError.badRequest('OTP does not match this mobile number');
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
