/**
 * BuildFlow - Billing & subscription (OWNER only).
 */
import React from 'react';
import { View, Text, ActivityIndicator, Alert, Linking, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Badge, Button } from '@/components/ui';
import { SettingsPageLayout } from '@/components/layout/SettingsPageLayout';
import { useViewport } from '@/hooks/useViewport';
import { useSubscription, useCreateSubscriptionCheckout } from '@/services/settings.queries';

const PLAN_LABELS: Record<string, string> = {
  STARTER: 'Starter',
  PROFESSIONAL: 'Professional',
  ENTERPRISE: 'Enterprise',
};

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'neutral'> = {
  TRIAL: 'primary',
  ACTIVE: 'success',
  PAST_DUE: 'warning',
  CANCELLED: 'neutral',
  EXPIRED: 'danger',
};

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-2 border-b border-border">
      <Text className="text-sm text-muted">{label}</Text>
      <Text className="text-sm font-medium text-text">{value}</Text>
    </View>
  );
}

export default function BillingScreen() {
  const router = useRouter();
  const { isDesktop } = useViewport();
  const { data, isLoading, isError, refetch } = useSubscription();
  const checkout = useCreateSubscriptionCheckout();

  const startCheckout = (plan: string, gateway: 'razorpay' | 'stripe') => {
    checkout.mutate(
      { plan, gateway },
      {
        onSuccess: async (result) => {
          if (typeof window !== 'undefined') {
            window.open(result.paymentUrl, '_blank');
          } else {
            const ok = await Linking.canOpenURL(result.paymentUrl);
            if (ok) await Linking.openURL(result.paymentUrl);
            else Alert.alert('Checkout', result.paymentUrl);
          }
        },
        onError: (e: Error) =>
          Alert.alert(
            'Checkout unavailable',
            e.message.includes('not available')
              ? 'Online payment is not configured on this server. Submit a billing request instead.'
              : e.message,
            [{ text: 'Submit request', onPress: () => router.push('/(app)/settings/tickets/create?category=BILLING' as never) }],
          ),
      },
    );
  };

  const content = isLoading ? (
    <View className="mt-8 items-center">
      <ActivityIndicator size="large" color="#1E3A5F" />
    </View>
  ) : isError || !data ? (
    <Card>
      <Text className="text-muted text-sm">Could not load subscription details.</Text>
    </Card>
  ) : (
    <View className={isDesktop ? 'flex-row gap-4 items-start' : ''}>
      <View className={isDesktop ? 'flex-1' : ''}>
        <Card className="mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-bold text-text">
              {PLAN_LABELS[data.plan] ?? data.plan}
            </Text>
            <Badge
              label={data.status.replace('_', ' ')}
              color={STATUS_COLOR[data.status] ?? 'neutral'}
            />
          </View>

          {data.status === 'TRIAL' && data.daysRemaining !== null ? (
            <>
              <Text className="text-sm text-muted leading-relaxed">
                Free trial - no credit card required at signup. Upgrade when ready.
              </Text>
              <Text className="text-2xl font-bold text-primary mt-3">
                {data.daysRemaining} day{data.daysRemaining === 1 ? '' : 's'} left
              </Text>
              <Text className="text-xs text-muted mt-1">
                Trial ends {formatDate(data.trialEndsAt)}
              </Text>
            </>
          ) : data.status === 'EXPIRED' ? (
            <Text className="text-sm text-danger leading-relaxed">
              Your trial has ended. Choose a plan below to continue using BuildFlow.
            </Text>
          ) : data.status === 'ACTIVE' ? (
            <Text className="text-sm text-muted leading-relaxed">
              Your BuildFlow subscription is active.
              {data.lastPaymentAt ? ` Last payment: ${formatDate(data.lastPaymentAt)}.` : ''}
            </Text>
          ) : (
            <Text className="text-sm text-muted leading-relaxed">
              Status: {data.status.replace('_', ' ')}
            </Text>
          )}
        </Card>

        {(data.status === 'TRIAL' || data.status === 'EXPIRED' || data.status === 'PAST_DUE') && (
          <Card className="mb-4">
            <Text className="text-sm font-bold text-text mb-2">Upgrade your plan</Text>
            <Text className="text-xs text-muted mb-4">
              Pay BuildFlow for your SaaS subscription (separate from client invoice payments in Integrations).
            </Text>
            {(['STARTER', 'PROFESSIONAL', 'ENTERPRISE'] as const).map((plan) => {
              const price = data.billing?.plans?.[plan];
              return (
                <View key={plan} className="flex-row items-center justify-between py-3 border-b border-border">
                  <View>
                    <Text className="text-sm font-semibold text-text">{PLAN_LABELS[plan]}</Text>
                    {price ? (
                      <Text className="text-xs text-muted">₹{price.toLocaleString('en-IN')}/month</Text>
                    ) : null}
                  </View>
                  <View className="flex-row gap-2">
                    {data.billing?.razorpay ? (
                      <Button
                        label="Pay (IN)"
                        size="sm"
                        onPress={() => startCheckout(plan, 'razorpay')}
                        disabled={checkout.isPending}
                      />
                    ) : null}
                    {data.billing?.stripe ? (
                      <Button
                        label="Stripe"
                        size="sm"
                        variant="secondary"
                        onPress={() => startCheckout(plan, 'stripe')}
                        disabled={checkout.isPending}
                      />
                    ) : null}
                  </View>
                </View>
              );
            })}
            {!data.billing?.razorpay && !data.billing?.stripe ? (
              <Text className="text-xs text-muted mt-2">
                Online checkout is not configured on this server. Use the billing request below.
              </Text>
            ) : null}
          </Card>
        )}

        <Card className="bg-primary/5 border-primary/20">
          <Text className="text-sm font-bold text-text mb-2">Billing support</Text>
          <Text className="text-sm text-muted leading-relaxed mb-4">
            Questions about plans, invoices, or enterprise pricing? Our team can help.
          </Text>
          <Button
            label="Submit billing request"
            variant="secondary"
            onPress={() => router.push('/(app)/settings/tickets/create?category=BILLING' as never)}
            fullWidth
          />
          <View className="h-2" />
          <Button
            label="View pricing plans"
            variant="ghost"
            onPress={() => router.push('/pricing' as never)}
            fullWidth
          />
        </Card>
      </View>

      <Card className={isDesktop ? 'flex-1 max-w-md' : 'mt-0'}>
        <Text className="text-sm font-bold text-text mb-2">Subscription details</Text>
        <DetailRow label="Started" value={formatDate(data.trialStartsAt)} />
        <DetailRow label="Renews / ends" value={formatDate(data.trialEndsAt)} />
        <DetailRow label="Plan tier" value={PLAN_LABELS[data.plan] ?? data.plan} />
        <DetailRow label="Last payment" value={formatDate(data.lastPaymentAt)} />
      </Card>
    </View>
  );

  return (
    <SettingsPageLayout title="Billing & plan" subtitle="Your BuildFlow SaaS subscription" onRefresh={() => refetch()}>
      {content}
    </SettingsPageLayout>
  );
}
