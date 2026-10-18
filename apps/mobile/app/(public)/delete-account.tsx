/**
 * Account deletion request page (Google Play Data safety requirement).
 * URL: https://build-flow-frontend-jet.vercel.app/delete-account
 */
import React from 'react';
import { Linking, Pressable, Text } from 'react-native';
import { MarketingPageShell } from '@/components/marketing/MarketingPageShell';
import { MarketingSection } from '@/components/marketing/MarketingSection';
import { Card } from '@/components/ui';

const MAIL =
  'mailto:vssnreddy1@gmail.com?subject=Account%20deletion%20request%20%E2%80%94%20Jora%20Trade%20%2F%20BuildFlow&body=Please%20delete%20my%20account%20and%20associated%20personal%20data.%0A%0AName%3A%0AApp%20(Jora%20Trade%20or%20BuildFlow)%3A%0AEmail%2Fphone%20on%20account%3A%0AManufacturer%20%2F%20company%3A%0AInvite%20code%20or%20account%20ID%20(if%20known)%3A%0A';

export default function DeleteAccountPage() {
  return (
    <MarketingPageShell>
      <MarketingSection
        title="Delete your account & data"
        subtitle="Jora Trade and BuildFlow — StaffingPros / Jora AI"
      >
        <Card className="mb-4">
          <Text className="text-sm text-muted leading-relaxed">
            Request deletion of your account and associated personal data. This page is for users of
            Jora Trade (buyer app) and BuildFlow products operated by StaffingPros / Jora AI.
          </Text>
        </Card>

        <Card className="mb-4">
          <Text className="text-base font-bold text-text mb-2">How to request deletion</Text>
          <Text className="text-sm text-muted leading-relaxed mb-2">
            1. Email vssnreddy1@gmail.com (developer contact for Jora Trade / BuildFlow).
          </Text>
          <Text className="text-sm text-muted leading-relaxed mb-2">
            2. Subject: Account deletion request — Jora Trade / BuildFlow.
          </Text>
          <Text className="text-sm text-muted leading-relaxed mb-2">
            3. Include your name, email/phone on the account, manufacturer/company, and invite code
            or account ID if known.
          </Text>
          <Text className="text-sm text-muted leading-relaxed mb-3">
            4. We confirm and delete or anonymize personal account data within 30 days, subject to
            legal retention below.
          </Text>
          <Pressable
            onPress={() => void Linking.openURL(MAIL)}
            className="bg-amber-500 rounded-xl py-3 px-4 items-center"
          >
            <Text className="text-navy font-extrabold text-base" style={{ color: '#1E3A5F' }}>
              Email deletion request
            </Text>
          </Pressable>
        </Card>

        <Card className="mb-4">
          <Text className="text-base font-bold text-text mb-2">What is deleted</Text>
          <Text className="text-sm text-muted leading-relaxed">
            Buyer/user profile (name, email, phone, addresses), login/invite association, and
            personal contact details on your buyer profile.
          </Text>
        </Card>

        <Card className="mb-4">
          <Text className="text-base font-bold text-text mb-2">What may be kept</Text>
          <Text className="text-sm text-muted leading-relaxed mb-2">
            Business transaction records (orders, invoices, GST) may be retained as required by tax
            and law; personal identifiers may be anonymized where possible.
          </Text>
          <Text className="text-sm text-muted leading-relaxed mb-2">
            Security/backup logs may be kept up to about 90 days, then purged with normal backup
            cycles.
          </Text>
          <Text className="text-sm text-muted leading-relaxed">
            Party records created by your manufacturer may also need deletion by that admin; we can
            help coordinate when you email us.
          </Text>
        </Card>

        <Card className="mb-4">
          <Text className="text-sm text-muted leading-relaxed">
            Privacy: https://build-flow-frontend-jet.vercel.app/privacy · Terms:
            https://build-flow-frontend-jet.vercel.app/terms · Static page:
            https://build-flow-frontend-jet.vercel.app/delete-account.html
          </Text>
        </Card>
      </MarketingSection>
    </MarketingPageShell>
  );
}
