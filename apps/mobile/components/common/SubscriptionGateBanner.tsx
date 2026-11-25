/**
 * Persistent banner when the company trial/subscription needs renewal.
 * Uses exempt GET /settings/subscription so it still loads after expiry.
 */
import React, { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useAuthStore } from '@/stores/auth.store';
import { useSubscription } from '@/services/settings.queries';
import {
  isOnBillingScreen,
  resolveBillingHref,
} from '@/lib/billing-redirect';

function needsRenewal(status: string | undefined, trialEndsAt: string | null | undefined): boolean {
  if (!status) return false;
  if (status === 'EXPIRED' || status === 'PAST_DUE' || status === 'CANCELLED') return true;
  if ((status === 'TRIAL' || status === 'ACTIVE') && trialEndsAt) {
    return new Date(trialEndsAt).getTime() < Date.now();
  }
  return false;
}

export function SubscriptionGateBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const canPay = useAuthStore(
    (s) => s.user?.role === 'OWNER' || !!s.user?.permissions?.includes('settings.billing'),
  );
  const { data } = useSubscription({ enabled: isAuthenticated });

  const show = useMemo(
    () =>
      isAuthenticated &&
      needsRenewal(data?.status, data?.trialEndsAt) &&
      !isOnBillingScreen(pathname),
    [isAuthenticated, data?.status, data?.trialEndsAt, pathname],
  );

  if (!show) return null;

  const href = resolveBillingHref({ pathname });
  const label =
    data?.status === 'PAST_DUE'
      ? 'Payment past due — renew to keep using BuildFlow.'
      : data?.status === 'CANCELLED'
        ? 'Subscription cancelled — renew to restore access.'
        : 'Trial or subscription expired — renew to keep using BuildFlow.';

  return (
    <View className="bg-warning/15 border-b border-warning/40 px-4 py-2.5 flex-row items-center gap-3 shrink-0">
      <Text className="flex-1 text-sm text-text font-medium" numberOfLines={2}>
        {canPay
          ? label
          : `${label} Ask your account owner to renew.`}
      </Text>
      {canPay ? (
        <Pressable
          onPress={() => router.push(href as never)}
          className="bg-warning px-3 py-1.5 rounded-lg shrink-0"
          accessibilityRole="button"
          accessibilityLabel="Renew subscription"
        >
          <Text className="text-sm font-bold text-text">Renew</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
