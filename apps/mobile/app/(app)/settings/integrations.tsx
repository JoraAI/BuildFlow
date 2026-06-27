/**
 * BuildFlow — Integrations settings screen.
 *
 * Owner-only. Shows integration status and setup instructions.
 *
 * All API keys/secrets live in the backend .env (never in the DB). Tally
 * ledger mapping uses sensible defaults in tally.service.ts. This screen
 * gives owners a clear checklist of what to configure.
 */
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Badge } from '@/components/ui';
import { useEnvStatus } from '@/services/settings.queries';

function IntegrationCard({
  title,
  description,
  status,
  envVars,
}: {
  title: string;
  description: string;
  status: 'connected' | 'not_configured';
  envVars: string[];
}) {
  return (
    <Card className="mb-3">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-base font-bold text-text">{title}</Text>
        <Badge
          label={status === 'connected' ? 'Connected' : 'Not configured'}
          color={status === 'connected' ? 'success' : 'neutral'}
        />
      </View>
      <Text className="text-xs text-text-muted mb-3">{description}</Text>
      <Text className="text-xs font-semibold text-text-muted mb-1">Required env vars:</Text>
      {envVars.map((v) => (
        <Text key={v} className="text-xs text-text font-mono py-0.5">
          • {v}
        </Text>
      ))}
    </Card>
  );
}

export default function IntegrationsScreen() {
  const { data: status, isLoading } = useEnvStatus();

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center">
        <Text className="text-text-muted">Loading...</Text>
      </SafeAreaView>
    );
  }

  const s = status ?? {
    tally: false,
    twilio: false,
    maps: false,
    razorpay: false,
    stripe: false,
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-6">
        <Text className="text-2xl font-bold text-text pt-4 pb-1">Integrations</Text>
        <Text className="text-sm text-text-muted mb-4">
          API keys are configured by your administrator in the backend .env file.
        </Text>

        <IntegrationCard
          title="Tally Prime Export"
          description="Export sales/purchase vouchers as Tally-compatible XML with ledger mapping."
          status={s.tally ? 'connected' : 'not_configured'}
          envVars={['TALLY_LEDGER_SALES (default: Sales)', 'TALLY_LEDGER_PURCHASE (default: Purchases)']}
        />

        <IntegrationCard
          title="WhatsApp & SMS (Twilio)"
          description="Send invoice links, payment reminders, and alerts via WhatsApp Business API and SMS."
          status={s.twilio ? 'connected' : 'not_configured'}
          envVars={[
            'TWILIO_ACCOUNT_SID',
            'TWILIO_AUTH_TOKEN',
            'TWILIO_WHATSAPP_FROM',
            'TWILIO_SMS_FROM',
          ]}
        />

        <IntegrationCard
          title="Google Maps"
          description="Site pins, navigation, and geo-fenced attendance check-in."
          status={s.maps ? 'connected' : 'not_configured'}
          envVars={['GOOGLE_MAPS_API_KEY', '+ googleMapsApiKey in app.config.ts']}
        />

        <IntegrationCard
          title="Razorpay (India)"
          description="Generate payment links for invoices. Webhook auto-marks invoices as PAID."
          status={s.razorpay ? 'connected' : 'not_configured'}
          envVars={['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET']}
        />

        <IntegrationCard
          title="Stripe (International)"
          description="International payment gateway for clients outside India."
          status={s.stripe ? 'connected' : 'not_configured'}
          envVars={['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']}
        />

        <Card>
          <Text className="text-xs text-text-muted">
            ℹ️ Status reflects whether the corresponding env vars are set on the server. Restart
            the backend after updating .env. Never commit .env to git.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}