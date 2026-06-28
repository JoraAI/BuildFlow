/**
 * BuildFlow — Company subscription / trial lifecycle.
 */
import { SubscriptionPlan, SubscriptionStatus, Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { notify } from './notification.service';
import { notifyInternalOps } from './ops-notification.service';
import { logger } from '../config/logger';

export const TRIAL_DAYS = env.TRIAL_DAYS;

export interface SubscriptionSummary {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  trialStartsAt: string;
  trialEndsAt: string | null;
  daysRemaining: number | null;
  isTrial: boolean;
  lastPaymentAt: string | null;
}

export function trialEndDate(from: Date = new Date()): Date {
  const end = new Date(from);
  end.setDate(end.getDate() + TRIAL_DAYS);
  return end;
}

export function daysUntil(date: Date | null): number | null {
  if (!date) return null;
  const ms = date.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export async function getSubscriptionSummary(companyId: string): Promise<SubscriptionSummary> {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: {
      subscriptionPlan: true,
      subscriptionStatus: true,
      trialStartsAt: true,
      trialEndsAt: true,
      lastPaymentAt: true,
    },
  });

  const isTrial =
    company.subscriptionStatus === SubscriptionStatus.TRIAL ||
    company.subscriptionStatus === SubscriptionStatus.EXPIRED;

  return {
    plan: company.subscriptionPlan,
    status: company.subscriptionStatus,
    trialStartsAt: company.trialStartsAt.toISOString(),
    trialEndsAt: company.trialEndsAt?.toISOString() ?? null,
    daysRemaining: daysUntil(company.trialEndsAt),
    isTrial,
    lastPaymentAt: company.lastPaymentAt?.toISOString() ?? null,
  };
}

/** Called on public company registration — starts trial window. */
export async function initializeTrial(companyId: string): Promise<void> {
  const now = new Date();
  const ends = trialEndDate(now);
  await prisma.company.update({
    where: { id: companyId },
    data: {
      subscriptionPlan: SubscriptionPlan.STARTER,
      subscriptionStatus: SubscriptionStatus.TRIAL,
      trialStartsAt: now,
      trialEndsAt: ends,
    },
  });
}

export async function notifyNewTrialSignup(companyId: string, companyName: string, ownerEmail: string): Promise<void> {
  await notifyInternalOps({
    event: 'NEW_TRIAL_SIGNUP',
    companyId,
    companyName,
    ownerEmail,
    message: `New trial signup: ${companyName} (${ownerEmail})`,
  });
}

async function alreadyNotified(userId: string, type: string, referenceId: string): Promise<boolean> {
  const row = await prisma.notification.findFirst({
    where: { userId, type, referenceId },
    select: { id: true },
  });
  return !!row;
}

/** Daily job: trial ending reminders + expiry + internal ops alerts. */
export async function runSubscriptionCron(): Promise<void> {
  logger.info('Running subscription trial cron');

  const now = new Date();
  const companies = await prisma.company.findMany({
    where: { subscriptionStatus: SubscriptionStatus.TRIAL },
    select: {
      id: true,
      name: true,
      trialEndsAt: true,
      users: {
        where: { role: Role.OWNER, isActive: true },
        select: { id: true, email: true },
      },
    },
  });

  for (const company of companies) {
    if (!company.trialEndsAt) continue;

    const daysLeft = daysUntil(company.trialEndsAt);
    if (daysLeft === null) continue;

    const ownerIds = company.users.map((u) => u.id);
    const ownerEmail = company.users[0]?.email ?? 'unknown';

    if ([7, 3, 1].includes(daysLeft)) {
      const ref = `trial-${daysLeft}d-${company.id}`;
      for (const userId of ownerIds) {
        if (await alreadyNotified(userId, 'TRIAL_ENDING', ref)) continue;
        await notify({
          userId,
          type: 'TRIAL_ENDING',
          referenceId: ref,
          title: 'Trial ending soon',
          body: `Your BuildFlow trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Visit Settings → Billing to choose a plan.`,
        });
      }
      await notifyInternalOps({
        event: 'TRIAL_EXPIRING',
        companyId: company.id,
        companyName: company.name,
        ownerEmail,
        daysLeft,
        message: `Trial expiring in ${daysLeft}d: ${company.name} (${ownerEmail})`,
      });
    }

    if (company.trialEndsAt <= now) {
      await prisma.company.update({
        where: { id: company.id },
        data: { subscriptionStatus: SubscriptionStatus.EXPIRED },
      });

      const ref = `trial-expired-${company.id}`;
      for (const userId of ownerIds) {
        if (await alreadyNotified(userId, 'TRIAL_EXPIRED', ref)) continue;
        await notify({
          userId,
          type: 'TRIAL_EXPIRED',
          referenceId: ref,
          title: 'Trial ended',
          body: 'Your free trial has ended. Upgrade in Settings → Billing to continue using BuildFlow.',
        });
      }
      await notifyInternalOps({
        event: 'TRIAL_EXPIRED_NO_PAYMENT',
        companyId: company.id,
        companyName: company.name,
        ownerEmail,
        message: `Trial expired (no payment): ${company.name} (${ownerEmail})`,
      });
    }
  }
}
