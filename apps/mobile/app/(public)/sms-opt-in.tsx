/**
 * Public SMS opt-in disclosure page for Twilio A2P review (no login required).
 * URL: https://build-flow-frontend-jet.vercel.app/sms-opt-in
 */
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { MarketingPageShell } from '@/components/marketing/MarketingPageShell';
import { MarketingSection } from '@/components/marketing/MarketingSection';
import { Card } from '@/components/ui';
import { SmsConsentCheckbox } from '@/components/auth/SmsConsentCheckbox';

export default function SmsOptInPage() {
  const [consent, setConsent] = useState(false);

  return (
    <MarketingPageShell>
      <MarketingSection
        title="SMS opt-in (StaffingPros / Jora AI)"
        subtitle="How users consent to authentication texts for the BuildFlow platform."
      >
        <Card className="mb-4">
          <Text className="text-sm text-muted leading-relaxed">
            StaffingPros and Jora AI operate BuildFlow business software at
            https://build-flow-frontend-jet.vercel.app/ . End users consent to receive transactional
            SMS one-time passcodes when they provide a mobile number and check the SMS consent box
            before requesting an OTP on login or invite acceptance.
          </Text>
        </Card>

        <Card className="mb-4">
          <Text className="text-base font-bold text-text mb-2">Example consent checkbox</Text>
          <Text className="text-sm text-muted leading-relaxed mb-3">
            The same disclosure appears on{' '}
            <Text className="text-primary">https://build-flow-frontend-jet.vercel.app/login</Text>
            {' '}and{' '}
            <Text className="text-primary">
              https://build-flow-frontend-jet.vercel.app/signup/invite
            </Text>
            {' '}before “Send OTP”.
          </Text>
          <SmsConsentCheckbox checked={consent} onCheckedChange={setConsent} />
          <Text className="text-xs text-muted mt-3">
            Status: {consent ? 'Consent selected (demo only on this page).' : 'Consent not selected.'}
          </Text>
        </Card>

        <Card className="mb-4">
          <Text className="text-base font-bold text-text mb-2">Message types</Text>
          <Text className="text-sm text-muted leading-relaxed">
            Authentication OTPs only (login and invite verification). No promotional or marketing
            SMS. Message frequency is low and user-initiated. Reply STOP to opt out; reply HELP for
            help. Privacy: https://build-flow-frontend-jet.vercel.app/privacy · Terms:
            https://build-flow-frontend-jet.vercel.app/terms
          </Text>
        </Card>
      </MarketingSection>
    </MarketingPageShell>
  );
}
