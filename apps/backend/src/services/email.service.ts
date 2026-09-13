/**
 * BuildFlow - Transactional email delivery (OTP, etc.).
 *
 * Providers (first match wins):
 *  1. Resend HTTP API when RESEND_API_KEY + OTP_EMAIL_FROM are set
 *  2. SMTP via nodemailer when SMTP_HOST + OTP_EMAIL_FROM are set
 *  3. Otherwise returns false (caller may expose a dev code)
 */
import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';

export async function sendTransactionalEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> {
  const from = env.OTP_EMAIL_FROM;
  if (!from) {
    logger.debug('Email skipped (OTP_EMAIL_FROM not set)', { to: opts.to });
    return false;
  }

  if (env.RESEND_API_KEY) {
    return sendViaResend({ ...opts, from });
  }

  if (env.SMTP_HOST) {
    return sendViaSmtp({ ...opts, from });
  }

  logger.debug('Email skipped (no Resend or SMTP configured)', { to: opts.to });
  return false;
}

async function sendViaResend(opts: {
  to: string;
  from: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: opts.from,
        to: [opts.to],
        subject: opts.subject,
        text: opts.text,
        ...(opts.html ? { html: opts.html } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      logger.warn('Resend email failed', { to: opts.to, status: res.status, body });
      return false;
    }
    logger.info('Resend email sent', { to: opts.to, subject: opts.subject });
    return true;
  } catch (err) {
    logger.warn('Resend email error', {
      to: opts.to,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

async function sendViaSmtp(opts: {
  to: string;
  from: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> {
  try {
    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth:
        env.SMTP_USER && env.SMTP_PASS
          ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
          : undefined,
    });

    await transporter.sendMail({
      from: opts.from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    logger.info('SMTP email sent', { to: opts.to, subject: opts.subject });
    return true;
  } catch (err) {
    logger.warn('SMTP email error', {
      to: opts.to,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
