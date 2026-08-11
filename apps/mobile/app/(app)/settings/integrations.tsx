/**
 * BuildFlow - Integrations settings (company-scoped credentials, OWNER only).
 */
import React, { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Badge, Button, Input, LoadingSkeleton } from '@/components/ui';
import { SettingsPageLayout } from '@/components/layout/SettingsPageLayout';
import { ResponsiveGrid } from '@/components/layout/ResponsiveGrid';
import { API_BASE_URL } from '@/constants';
import { alertAsync } from '@/utils/confirm';
import {
  useIntegrations,
  useUpdateIntegration,
  type IntegrationProviderStatus,
  type IntegrationSlug,
} from '@/services/settings.queries';

function sourceLabel(source: IntegrationProviderStatus['source']): string {
  if (source === 'company') return 'Your company';
  if (source === 'platform') return 'BuildFlow default';
  return 'Not configured';
}

function sourceColor(source: IntegrationProviderStatus['source']): 'success' | 'primary' | 'neutral' {
  if (source === 'company') return 'success';
  if (source === 'platform') return 'primary';
  return 'neutral';
}

function fullWebhookUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = API_BASE_URL.replace(/\/api$/, '');
  return `${base}${path}`;
}

function IntegrationPanel({
  title,
  description,
  status,
  webhookUrl,
  expanded,
  onToggle,
  children,
  className = '',
}: {
  title: string;
  description: string;
  status: IntegrationProviderStatus;
  webhookUrl?: string | null;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const fullUrl = fullWebhookUrl(webhookUrl);
  return (
    <Card className={`mb-0 ${className}`}>
      <Pressable onPress={onToggle} className="active:opacity-80">
        <View className="flex-row items-start justify-between mb-1">
          <View className="flex-1 mr-2">
            <Text className="text-base font-bold text-text">{title}</Text>
            <Text className="text-xs text-muted mt-0.5">{description}</Text>
          </View>
          <Badge label={sourceLabel(status.source)} color={sourceColor(status.source)} />
        </View>
        <Text className="text-xs text-primary mt-1">{expanded ? '▲ Hide settings' : '▼ Configure'}</Text>
      </Pressable>
      {fullUrl ? (
        <View className="mt-2 p-2 bg-surface rounded-lg">
          <Text className="text-xs font-semibold text-muted mb-0.5">Webhook URL</Text>
          <Text className="text-xs text-text font-mono" selectable>
            {fullUrl}
          </Text>
        </View>
      ) : null}
      {expanded ? <View className="mt-4">{children}</View> : null}
    </Card>
  );
}

function SaveRow({
  slug,
  fields,
  onSaved,
}: {
  slug: IntegrationSlug;
  fields: Record<string, string>;
  onSaved: () => void;
}) {
  const update = useUpdateIntegration(slug);
  return (
    <Button
      label={update.isPending ? 'Saving...' : 'Save'}
      size="sm"
      onPress={() =>
        update.mutate(fields, {
          onSuccess: async () => {
            await alertAsync('Saved', 'Integration settings updated.');
            onSaved();
          },
          onError: async (e: Error) => {
            await alertAsync('Error', e.message);
          },
        })
      }
      disabled={update.isPending}
    />
  );
}

export default function IntegrationsScreen() {
  const router = useRouter();
  const { data, isLoading, refetch } = useIntegrations();
  const [expanded, setExpanded] = useState<string | null>(null);

  const [twilio, setTwilio] = useState({ accountSid: '', authToken: '', whatsappFrom: '', smsFrom: '' });
  const [razorpay, setRazorpay] = useState({ keyId: '', keySecret: '', webhookSecret: '' });
  const [stripe, setStripe] = useState({ secretKey: '', webhookSecret: '' });
  const [tally, setTally] = useState({
    sales: '', purchase: '', cgst: '', sgst: '', igst: '', tdsPayable: '', retention: '', advanceRecovery: '', bank: '',
  });
  const [maps, setMaps] = useState({ apiKey: '' });
  const [llm, setLlm] = useState({ apiUrl: '', apiKey: '', model: '' });
  const [s3, setS3] = useState({ region: '', bucket: '', accessKeyId: '', secretAccessKey: '' });

  useEffect(() => {
    if (!data) return;
    const s = (p: IntegrationProviderStatus) => p.settings as Record<string, string>;
    setTwilio({
      accountSid: String(s(data.twilio).accountSid ?? ''),
      authToken: '',
      whatsappFrom: String(s(data.twilio).whatsappFrom ?? ''),
      smsFrom: String(s(data.twilio).smsFrom ?? ''),
    });
    setRazorpay({
      keyId: String(s(data.razorpay).keyId ?? ''),
      keySecret: '',
      webhookSecret: '',
    });
    setStripe({ secretKey: '', webhookSecret: '' });
    setTally({
      sales: String(s(data.tally).sales ?? ''),
      purchase: String(s(data.tally).purchase ?? ''),
      cgst: String(s(data.tally).cgst ?? ''),
      sgst: String(s(data.tally).sgst ?? ''),
      igst: String(s(data.tally).igst ?? ''),
      tdsPayable: String(s(data.tally).tdsPayable ?? ''),
      retention: String(s(data.tally).retention ?? ''),
      advanceRecovery: String(s(data.tally).advanceRecovery ?? ''),
      bank: String(s(data.tally).bank ?? ''),
    });
    setMaps({ apiKey: '' });
    setLlm({
      apiUrl: String(s(data.llm).apiUrl ?? ''),
      apiKey: '',
      model: String(s(data.llm).model ?? ''),
    });
    setS3({
      region: String(s(data.s3).region ?? ''),
      bucket: String(s(data.s3).bucket ?? ''),
      accessKeyId: String(s(data.s3).accessKeyId ?? ''),
      secretAccessKey: '',
    });
  }, [data]);

  const toggle = (id: string) => setExpanded((e) => (e === id ? null : id));

  const openHelp = () => {
    router.push(
      '/(app)/settings/tickets/create?category=INTEGRATION_SETUP&subject=Help%20setting%20up%20integrations&scope=platform' as never,
    );
  };

  if (isLoading || !data) {
    return (
      <SettingsPageLayout title="Integrations" subtitle="Company-owned API keys & services">
        <LoadingSkeleton className="h-32 mb-3" />
        <LoadingSkeleton className="h-32" />
      </SettingsPageLayout>
    );
  }

  const half = 'h-full';

  return (
    <SettingsPageLayout
      title="Integrations"
      subtitle="Configure your company's WhatsApp, payments, Tally, Maps, AI & storage"
      onRefresh={() => refetch()}
    >
      <Card className="mb-4 bg-primary/5 border-primary/20">
        <Text className="text-sm text-text leading-relaxed">
          These integrations belong to <Text className="font-semibold">your construction company</Text> - not
          BuildFlow. When you enter keys here, invoice payments and client WhatsApp messages use your accounts.
          BuildFlow platform services (hosting, default assistant) use separate infrastructure unless you override
          with BYOK below.
        </Text>
      </Card>

      <ResponsiveGrid gap={16}>
        <IntegrationPanel
          title="WhatsApp & SMS (Twilio)"
          description="Invoice links, payment reminders, and alerts to your clients"
          status={data.twilio}
          expanded={expanded === 'twilio'}
          onToggle={() => toggle('twilio')}
          className={half}
        >
          <Input label="Account SID" value={twilio.accountSid} onChangeText={(v) => setTwilio((f) => ({ ...f, accountSid: v }))} />
          <Input label="Auth Token" value={twilio.authToken} onChangeText={(v) => setTwilio((f) => ({ ...f, authToken: v }))} secureTextEntry placeholder="Leave blank to keep existing" />
          <Input label="WhatsApp From" value={twilio.whatsappFrom} onChangeText={(v) => setTwilio((f) => ({ ...f, whatsappFrom: v }))} placeholder="whatsapp:+14155238886" />
          <Input label="SMS From" value={twilio.smsFrom} onChangeText={(v) => setTwilio((f) => ({ ...f, smsFrom: v }))} />
          <SaveRow slug="twilio" fields={twilio} onSaved={() => refetch()} />
        </IntegrationPanel>

        <IntegrationPanel
          title="Razorpay (India)"
          description="Payment links for your invoices - client pays your company"
          status={data.razorpay}
          webhookUrl={data.razorpay.webhookUrl}
          expanded={expanded === 'razorpay'}
          onToggle={() => toggle('razorpay')}
          className={half}
        >
          <Input label="Key ID" value={razorpay.keyId} onChangeText={(v) => setRazorpay((f) => ({ ...f, keyId: v }))} />
          <Input label="Key Secret" value={razorpay.keySecret} onChangeText={(v) => setRazorpay((f) => ({ ...f, keySecret: v }))} secureTextEntry placeholder="Leave blank to keep existing" />
          <Input label="Webhook Secret" value={razorpay.webhookSecret} onChangeText={(v) => setRazorpay((f) => ({ ...f, webhookSecret: v }))} secureTextEntry placeholder="Leave blank to keep existing" />
          <SaveRow slug="razorpay" fields={razorpay} onSaved={() => refetch()} />
        </IntegrationPanel>

        <IntegrationPanel
          title="Stripe (International)"
          description="International client payments for your invoices"
          status={data.stripe}
          webhookUrl={data.stripe.webhookUrl}
          expanded={expanded === 'stripe'}
          onToggle={() => toggle('stripe')}
          className={half}
        >
          <Input label="Secret Key" value={stripe.secretKey} onChangeText={(v) => setStripe((f) => ({ ...f, secretKey: v }))} secureTextEntry placeholder="Leave blank to keep existing" />
          <Input label="Webhook Secret" value={stripe.webhookSecret} onChangeText={(v) => setStripe((f) => ({ ...f, webhookSecret: v }))} secureTextEntry placeholder="Leave blank to keep existing" />
          <SaveRow slug="stripe" fields={stripe} onSaved={() => refetch()} />
        </IntegrationPanel>

        <IntegrationPanel
          title="Tally Prime Export"
          description="Ledger names for your chart of accounts in Tally XML"
          status={data.tally}
          expanded={expanded === 'tally'}
          onToggle={() => toggle('tally')}
          className={half}
        >
          <Input label="Sales ledger" value={tally.sales} onChangeText={(v) => setTally((f) => ({ ...f, sales: v }))} />
          <Input label="Purchase ledger" value={tally.purchase} onChangeText={(v) => setTally((f) => ({ ...f, purchase: v }))} />
          <Input label="CGST" value={tally.cgst} onChangeText={(v) => setTally((f) => ({ ...f, cgst: v }))} />
          <Input label="SGST" value={tally.sgst} onChangeText={(v) => setTally((f) => ({ ...f, sgst: v }))} />
          <Input label="IGST" value={tally.igst} onChangeText={(v) => setTally((f) => ({ ...f, igst: v }))} />
          <Input label="TDS Payable" value={tally.tdsPayable} onChangeText={(v) => setTally((f) => ({ ...f, tdsPayable: v }))} />
          <Input label="Retention Money" value={tally.retention} onChangeText={(v) => setTally((f) => ({ ...f, retention: v }))} />
          <Input label="Advance Recovery" value={tally.advanceRecovery} onChangeText={(v) => setTally((f) => ({ ...f, advanceRecovery: v }))} />
          <Input label="Bank" value={tally.bank} onChangeText={(v) => setTally((f) => ({ ...f, bank: v }))} />
          <SaveRow slug="tally" fields={tally} onSaved={() => refetch()} />
        </IntegrationPanel>

        <IntegrationPanel
          title="Google Maps"
          description="Site pins, navigation, and geo-fenced check-in"
          status={data.maps}
          expanded={expanded === 'maps'}
          onToggle={() => toggle('maps')}
          className={half}
        >
          <Input label="API Key" value={maps.apiKey} onChangeText={(v) => setMaps({ apiKey: v })} secureTextEntry placeholder="Leave blank to keep existing" />
          <SaveRow slug="google-maps" fields={maps} onSaved={() => refetch()} />
        </IntegrationPanel>

        <IntegrationPanel
          title="AI Assistant (BYOK)"
          description="Bring your own LLM for BuildFlow Assistant - optional override"
          status={data.llm}
          expanded={expanded === 'llm'}
          onToggle={() => toggle('llm')}
          className={half}
        >
          <Input label="API URL" value={llm.apiUrl} onChangeText={(v) => setLlm((f) => ({ ...f, apiUrl: v }))} placeholder="https://api.openai.com/v1" />
          <Input label="API Key" value={llm.apiKey} onChangeText={(v) => setLlm((f) => ({ ...f, apiKey: v }))} secureTextEntry placeholder="Leave blank to keep existing" />
          <Input label="Model" value={llm.model} onChangeText={(v) => setLlm((f) => ({ ...f, model: v }))} placeholder="gpt-4o-mini" />
          <SaveRow slug="llm" fields={llm} onSaved={() => refetch()} />
        </IntegrationPanel>

        <IntegrationPanel
          title="File Storage (S3 BYOK)"
          description="Your own S3 bucket for logos, photos, and uploads"
          status={data.s3}
          expanded={expanded === 's3'}
          onToggle={() => toggle('s3')}
          className={half}
        >
          <Input label="Region" value={s3.region} onChangeText={(v) => setS3((f) => ({ ...f, region: v }))} placeholder="ap-south-1" />
          <Input label="Bucket" value={s3.bucket} onChangeText={(v) => setS3((f) => ({ ...f, bucket: v }))} />
          <Input label="Access Key ID" value={s3.accessKeyId} onChangeText={(v) => setS3((f) => ({ ...f, accessKeyId: v }))} />
          <Input label="Secret Access Key" value={s3.secretAccessKey} onChangeText={(v) => setS3((f) => ({ ...f, secretAccessKey: v }))} secureTextEntry placeholder="Leave blank to keep existing" />
          <SaveRow slug="s3" fields={s3} onSaved={() => refetch()} />
        </IntegrationPanel>
      </ResponsiveGrid>

      <Card className="mt-4">
        <Text className="text-sm font-bold text-text mb-2">Need help?</Text>
        <Text className="text-xs text-muted mb-3">
          WhatsApp Business and payment gateway setup often needs your company&apos;s legal documents.
          Request BuildFlow-assisted setup or ask your team admin.
        </Text>
        <Button label="Request integration setup" variant="secondary" onPress={openHelp} fullWidth />
      </Card>
    </SettingsPageLayout>
  );
}
